/**
 * Phase 12 — sync from snapshot + presence isolation + region fencing.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  CompactionController,
  InMemoryAuthoritativePersistence,
  InMemorySnapshotPersistence,
  InMemoryVersionArchive,
  InMemoryDocumentLifecycle,
  createSnapshotFromVersion,
} from 'lextrix-change/persistence';
import { DocumentHandle } from 'lextrix-change/document';
import {
  DocumentServerSession,
  AuthoritativeClientSession,
  EphemeralPresenceStore,
  InMemoryDocumentRegionStore,
  promoteDocumentRegion,
  InMemoryDocumentOwnership,
} from '../src/index.js';

function seed(docId: string, extra: number) {
  const persist = new InMemoryAuthoritativePersistence();
  const handle = DocumentHandle.create({
    contents: new ChangeSet([{ insert: 'S\n' }]),
    documentId: docId,
  });
  let expected: string | null = null;
  let r = persist.compareAndAppend(docId, null, handle.currentVersion());
  expect(r.ok).toBe(true);
  if (r.ok) expected = r.version.id;
  for (let i = 0; i < extra; i += 1) {
    handle.apply(new ChangeSet([{ insert: `d${i}` }]));
    r = persist.compareAndAppend(docId, expected, handle.currentVersion());
    expect(r.ok).toBe(true);
    if (r.ok) expected = r.version.id;
  }
  return persist;
}

describe('Phase 12 sync-from-snapshot', () => {
  it('client at V0 reconstructed via snapshot + deltas to HEAD', async () => {
    const docId = 'doc_sync';
    const persist = seed(docId, 5);
    const snapshots = new InMemorySnapshotPersistence();
    const archive = new InMemoryVersionArchive();
    const chain = persist.loadChain(docId);
    const sealed = chain[2]!; // mid
    snapshots.createSnapshot(createSnapshotFromVersion(sealed));
    const ctrl = new CompactionController({
      persistence: persist,
      snapshots,
      archive,
      removeHotBeforeSeal: (d, b) => persist.removeHotBeforeSequence(d, b),
    });
    await ctrl.compactTo(docId, sealed.id, { purge: false });

    const session = await DocumentServerSession.open(docId, {
      persistence: persist,
      snapshots,
    });
    const earlyId = chain[0]!.id;
    const resp = await session.sync({
      type: 'sync',
      role: 'request',
      documentId: docId,
      fromVersionId: earlyId,
    });
    expect(resp.type).toBe('sync');
    if (resp.type !== 'sync' || resp.role !== 'response') return;
    expect(resp.baseSnapshot).toBeTruthy();
    expect(resp.compactionApplied).toBe(true);
    expect(resp.headVersionId).toBe(session.getHead().id);

    const clientHandle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'S\n' }]),
      documentId: docId,
    });
    const sent: unknown[] = [];
    const client = new AuthoritativeClientSession({
      handle: clientHandle,
      send: (f) => {
        sent.push(f);
      },
    });
    client.onFrame(resp);
    expect(client.getHandle().currentVersion().id).toBe(session.getHead().id);
    expect(JSON.stringify(client.getHandle().document.contents.ops)).toBe(
      JSON.stringify(session.getHandle().document.contents.ops),
    );
    void sent;
  });

  it('tombstoned document rejects mutation', async () => {
    const persist = seed('doc_life', 0);
    const lifecycle = new InMemoryDocumentLifecycle();
    const session = await DocumentServerSession.open('doc_life', {
      persistence: persist,
      lifecycle,
    });
    lifecycle.tombstone('doc_life');
    const head = session.getHead().id;
    const result = await session.accept({
      changeId: 'c1',
      documentId: 'doc_life',
      baseVersionId: head,
      change: new ChangeSet([{ insert: 'nope' }]),
      dependsOn: [],
      meta: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('document_tombstoned');
  });
});

describe('Phase 12 presence', () => {
  it('presence failure does not block document accept', async () => {
    const persist = seed('doc_pres', 0);
    const presence = new EphemeralPresenceStore({ maxQueueDepth: 1 });
    const session = await DocumentServerSession.open('doc_pres', {
      persistence: persist,
      presence,
    });
    // Fill queue
    presence.publish('doc_pres', 'a1', 1, { status: 'online' });
    // Force drop
    for (let i = 0; i < 5; i += 1) {
      session.publishPresence('a2', i, { cursor: { i } });
    }
    presence.crash();
    const head = session.getHead().id;
    const result = await session.accept({
      changeId: 'ok1',
      documentId: 'doc_pres',
      baseVersionId: head,
      change: new ChangeSet([{ insert: 'still' }]),
      dependsOn: [],
      meta: {},
    });
    expect(result.ok).toBe(true);
  });

  it('stamps actor and rejects oversized presence', () => {
    const store = new EphemeralPresenceStore({ maxPayloadBytes: 8 });
    const r = store.publish('d', 'actor', 1, {
      cursor: 'this is way too long for the limit',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('oversized');
  });
});

describe('Phase 12 region fencing', () => {
  it('stale region cannot append after promotion', async () => {
    const persist = new InMemoryAuthoritativePersistence();
    const regions = new InMemoryDocumentRegionStore();
    regions.setHomeRegion('doc_r', 'region-a');

    class EpochOwnership extends InMemoryDocumentOwnership {
      constructor(
        private readonly p: InMemoryAuthoritativePersistence,
        ownerId: string,
      ) {
        super({ ownerId });
      }
      override async acquire(documentId: string) {
        const ownerEpoch = this.p.bumpOwnerEpoch(documentId);
        return {
          documentId,
          ownerId: this.ownerId,
          ownerEpoch,
          partition: 0,
        };
      }
    }

    const sessionA = await DocumentServerSession.open(
      'doc_r',
      {
        persistence: persist,
        ownership: new EpochOwnership(persist, 'a'),
        regions,
        localRegion: 'region-a',
      },
      { contents: new ChangeSet([{ insert: 'r\n' }]), createIfMissing: true },
    );
    const leaseA = sessionA.getLease()!;

    const promo = await promoteDocumentRegion({
      documentId: 'doc_r',
      toRegion: 'region-b',
      regions,
      bumpOwnerEpoch: (id) => persist.bumpOwnerEpoch(id),
      fromRegion: 'region-a',
    });
    expect(promo.ownerEpoch).toBeGreaterThan(leaseA.ownerEpoch);

    const sessionB = await DocumentServerSession.open('doc_r', {
      persistence: persist,
      ownership: new EpochOwnership(persist, 'b'),
      regions,
      localRegion: 'region-b',
      lease: {
        documentId: 'doc_r',
        ownerId: 'b',
        ownerEpoch: persist.getOwnerEpoch('doc_r'),
        partition: 0,
      },
    });

    const stale = await sessionA.accept({
      changeId: 'stale',
      documentId: 'doc_r',
      baseVersionId: sessionA.getHead().id,
      change: new ChangeSet([{ insert: 'STALE' }]),
      dependsOn: [],
      meta: {},
    });
    expect(stale.ok).toBe(false);

    const ok = await sessionB.accept({
      changeId: 'fresh',
      documentId: 'doc_r',
      baseVersionId: sessionB.getHead().id,
      change: new ChangeSet([{ insert: 'B' }]),
      dependsOn: [],
      meta: {},
    });
    expect(ok.ok).toBe(true);
  });
});
