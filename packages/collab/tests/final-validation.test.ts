/**
 * Final system validation — danger-zone integration (in-memory).
 * Adversarial proofs for CAS-after-apply, snapshot∘reconnect, presence isolation.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/document';
import {
  CompactionController,
  InMemoryAuthoritativePersistence,
  InMemorySnapshotPersistence,
  InMemoryVersionArchive,
  createSnapshotFromVersion,
  parseDocumentSnapshot,
  serializeDocumentSnapshot,
  PersistenceError,
} from 'lextrix-change/persistence';
import {
  AuthoritativeClientSession,
  DocumentServerSession,
  EphemeralPresenceStore,
} from '../src/index.js';

async function openDoc(docId: string) {
  const persistence = new InMemoryAuthoritativePersistence();
  const snapshots = new InMemorySnapshotPersistence();
  const frames: unknown[] = [];
  const session = await DocumentServerSession.open(
    docId,
    {
      persistence,
      snapshots,
      observe: () => undefined,
    },
    { contents: new ChangeSet([{ insert: 'V\n' }]), createIfMissing: true },
  );
  session.subscribe((f) => frames.push(f));
  return { persistence, snapshots, session, frames };
}

describe('Final validation — CAS-after-apply recovery', () => {
  it('CAS conflict: no history ACK, durable HEAD unchanged by loser, contents rehydrated', async () => {
    const { persistence, session, frames } = await openDoc('doc_cas_fv');
    const preContents = JSON.stringify(session.getHandle().document.contents.ops);
    const head = session.getHead();

    // Compose-valid competing Version via Handle (not a raw invalid forge)
    const winnerHandle = DocumentHandle.fromVersions(
      persistence.loadChain(head.documentId),
      { validate: true },
    );
    winnerHandle.apply(new ChangeSet([{ insert: 'WIN' }]));
    const forged = winnerHandle.currentVersion();
    expect(
      persistence.compareAndAppend(head.documentId, head.id, forged).ok,
    ).toBe(true);

    frames.length = 0;
    const result = await session.accept({
      changeId: 'loser_fv',
      documentId: head.documentId,
      baseVersionId: head.id,
      change: new ChangeSet([{ insert: 'LOSE' }]),
      dependsOn: [],
      meta: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('cas_conflict');

    const historyAcks = frames.filter(
      (f) =>
        f &&
        typeof f === 'object' &&
        (f as { type?: string; level?: string }).type === 'ack' &&
        (f as { level?: string }).level === 'history',
    );
    expect(historyAcks).toHaveLength(0);

    expect(persistence.loadHead(head.documentId)?.id).toBe(forged.id);
    expect(persistence.loadChain(head.documentId)).toHaveLength(2);

    // Session must not keep loser's applied state as HEAD
    expect(JSON.stringify(session.getHandle().document.contents.ops)).toBe(
      preContents,
    );

    // Reopen from durable → converge on winner
    const session2 = await DocumentServerSession.open(head.documentId, {
      persistence,
    });
    expect(session2.getHead().id).toBe(forged.id);
    expect(JSON.stringify(session2.getHandle().document.contents.ops)).toBe(
      JSON.stringify(forged.contents.ops),
    );
  });
});

describe('Final validation — snapshot sync ∘ reconnect', () => {
  it('offline pending survives compaction; sync snapshot+deltas; same changeId idempotent', async () => {
    const docId = 'doc_rc_snap';
    const persistence = new InMemoryAuthoritativePersistence();
    const snapshots = new InMemorySnapshotPersistence();
    const archive = new InMemoryVersionArchive();

    const session = await DocumentServerSession.open(
      docId,
      { persistence, snapshots },
      { contents: new ChangeSet([{ insert: 'S\n' }]), createIfMissing: true },
    );

    for (let i = 0; i < 6; i += 1) {
      const r = await session.accept({
        changeId: `srv_${i}`,
        documentId: docId,
        baseVersionId: session.getHead().id,
        change: new ChangeSet([{ insert: `s${i}` }]),
        dependsOn: [],
        meta: {},
      });
      expect(r.ok).toBe(true);
    }

    const clientHandle = DocumentHandle.fromVersions(
      persistence.loadChain(docId),
      { validate: true },
    );
    const outbound: unknown[] = [];
    const client = new AuthoritativeClientSession({
      handle: clientHandle,
      send: (f) => {
        outbound.push(f);
      },
    });
    // Confirm at mid-chain
    const mid = persistence.loadChain(docId)[2]!;
    client.onFrame({
      type: 'ack',
      documentId: docId,
      changeId: 'bootstrap',
      level: 'history',
      versionId: mid.id,
    });

    // Local pending while "offline"
    client.submitLocal(new ChangeSet([{ insert: 'PENDING' }]), {
      changeId: 'pending_same',
    });
    expect(client.getPending().length).toBe(1);

    // Server advances + compacts
    for (let i = 0; i < 3; i += 1) {
      await session.accept({
        changeId: `adv_${i}`,
        documentId: docId,
        baseVersionId: session.getHead().id,
        change: new ChangeSet([{ insert: `a${i}` }]),
        dependsOn: [],
        meta: {},
      });
    }
    const chain = persistence.loadChain(docId);
    const sealed = chain[4]!;
    snapshots.createSnapshot(createSnapshotFromVersion(sealed));
    const ctrl = new CompactionController({
      persistence,
      snapshots,
      archive,
      removeHotBeforeSeal: (d, b) => persistence.removeHotBeforeSequence(d, b),
    });
    await ctrl.compactTo(docId, sealed.id, { purge: false });

    // Reconnect sync from compacted early base
    const earlyId = chain[0]!.id;
    const syncResp = await session.sync({
      type: 'sync',
      role: 'request',
      documentId: docId,
      fromVersionId: earlyId,
    });
    expect(syncResp.type).toBe('sync');
    if (syncResp.type !== 'sync' || syncResp.role !== 'response') return;
    expect(syncResp.baseSnapshot).toBeTruthy();

    client.onFrame(syncResp);
    // After snapshot hydrate, confirmed matches server HEAD; pending may be
    // optimistically applied locally (local head can be ahead of server).
    expect(client.getConfirmedVersion()?.id).toBe(session.getHead().id);
    expect(client.getServerHeadId()).toBe(session.getHead().id);
    expect(client.getPending().some((p) => p.changeId === 'pending_same')).toBe(
      true,
    );

    // Resubmit same changeId through server
    const accept1 = await session.accept({
      changeId: 'pending_same',
      documentId: docId,
      baseVersionId: session.getHead().id,
      change: new ChangeSet([{ insert: 'PENDING' }]),
      dependsOn: [],
      meta: {},
    });
    expect(accept1.ok).toBe(true);
    const accept2 = await session.accept({
      changeId: 'pending_same',
      documentId: docId,
      baseVersionId: session.getHead().id,
      change: new ChangeSet([{ insert: 'PENDING' }]),
      dependsOn: [],
      meta: {},
    });
    expect(accept2.ok && accept2.duplicate).toBe(true);
    if (accept1.ok && accept2.ok) {
      expect(accept2.version.id).toBe(accept1.version.id);
    }
  });
});

describe('Final validation — presence isolation', () => {
  it('presence storm / crash does not prevent authoritative accept', async () => {
    const persistence = new InMemoryAuthoritativePersistence();
    const presence = new EphemeralPresenceStore({
      maxUpdatesPerSecondPerActor: 1000,
      maxQueueDepth: 8,
    });
    const session = await DocumentServerSession.open(
      'doc_pres_fv',
      { persistence, presence },
      { contents: new ChangeSet([{ insert: 'P\n' }]), createIfMissing: true },
    );

    for (let i = 0; i < 50; i += 1) {
      session.publishPresence(`u${i % 5}`, i, { cursor: { i } });
    }
    presence.crash();

    const before = persistence.loadChain('doc_pres_fv').length;
    const r = await session.accept({
      changeId: 'after_storm',
      documentId: 'doc_pres_fv',
      baseVersionId: session.getHead().id,
      change: new ChangeSet([{ insert: 'OK' }]),
      dependsOn: [],
      meta: {},
    });
    expect(r.ok).toBe(true);
    expect(persistence.loadChain('doc_pres_fv').length).toBe(before + 1);
  });
});

describe('Final validation — corrupt snapshot fail-closed', () => {
  it('parseDocumentSnapshot rejects tampered hash', () => {
    const h = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'x\n' }]),
    });
    const snap = createSnapshotFromVersion(h.currentVersion());
    const wire = serializeDocumentSnapshot(snap);
    wire.integrity = { ...wire.integrity, contentHash: '00'.repeat(32) };
    expect(() => parseDocumentSnapshot(wire)).toThrow(PersistenceError);
  });
});
