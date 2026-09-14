/**
 * Phase 12 host: presence AuthZ + lifecycle wiring smoke.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  InMemoryAuthoritativePersistence,
  InMemorySnapshotPersistence,
  CompactionController,
  InMemoryVersionArchive,
  createSnapshotFromVersion,
  DEFAULT_SNAPSHOT_EVERY_N_VERSIONS,
} from 'lextrix-change/persistence';
import {
  InMemoryDocumentOwnership,
  DocumentServerSession,
} from 'lextrix-collab';
import { CollabHost } from '../src/host.js';
import { allowAllAuth } from '../src/auth.js';
import { createCountingObserver } from '../src/observe.js';

describe('Phase 12 server foundations', () => {
  it('default snapshot cadence is 100', () => {
    expect(DEFAULT_SNAPSHOT_EVERY_N_VERSIONS).toBe(100);
  });

  it('presence actor is stamped by session (never client-forged)', async () => {
    const persist = new InMemoryAuthoritativePersistence();
    const session = await DocumentServerSession.open(
      'doc_actor',
      { persistence: persist },
      { contents: new ChangeSet([{ insert: '\n' }]), createIfMissing: true },
    );
    const out = session.publishPresence('trusted-principal', 1, {
      status: 'online',
    });
    expect(out.type).toBe('presence');
    if (out.type === 'presence') {
      expect(out.actorId).toBe('trusted-principal');
    }
  });

  it('host AuthZ can deny presence without mutating document', async () => {
    const persist = new InMemoryAuthoritativePersistence();
    const ownership = new InMemoryDocumentOwnership({ ownerId: 'host' });
    const host = new CollabHost({
      persistence: persist,
      ownership,
      auth: {
        authenticate: ({ token, connectionId }) => ({
          principalId: token || connectionId,
        }),
        authorize: ({ op }) => op !== 'presence_publish',
      },
      ownerId: 'host',
    });
    const frames: unknown[] = [];
    const conn = {
      id: 'c1',
      send: (f: unknown) => frames.push(f),
      close: () => undefined,
    };
    await host.onConnect(conn, { token: 'bob', headers: {} });
    await host.onMessage(conn, {
      type: 'presence',
      role: 'update',
      documentId: 'doc_deny',
      generation: 1,
      payload: {},
    });
    expect(frames.some((f) => (f as { code?: string }).code === 'authorization_failed')).toBe(
      true,
    );
    expect(persist.loadHead('doc_deny')).toBeNull();
  });

  it('compaction + session sync emits snapshot path', async () => {
    const persist = new InMemoryAuthoritativePersistence();
    const snapshots = new InMemorySnapshotPersistence();
    const archive = new InMemoryVersionArchive();
    const session = await DocumentServerSession.open(
      'doc_pg12',
      { persistence: persist, snapshots },
      { contents: new ChangeSet([{ insert: 'z\n' }]), createIfMissing: true },
    );
    for (let i = 0; i < 3; i += 1) {
      const r = await session.accept({
        changeId: `c${i}`,
        documentId: 'doc_pg12',
        baseVersionId: session.getHead().id,
        change: new ChangeSet([{ insert: String(i) }]),
        dependsOn: [],
        meta: {},
      });
      expect(r.ok).toBe(true);
    }
    const chain = persist.loadChain('doc_pg12');
    const sealed = chain[1]!;
    snapshots.createSnapshot(createSnapshotFromVersion(sealed));
    const ctrl = new CompactionController({
      persistence: persist,
      snapshots,
      archive,
      removeHotBeforeSeal: (d, b) => persist.removeHotBeforeSequence(d, b),
    });
    await ctrl.compactTo('doc_pg12', sealed.id, { purge: false });
    const session2 = await DocumentServerSession.open('doc_pg12', {
      persistence: persist,
      snapshots,
    });
    const resp = await session2.sync({
      type: 'sync',
      role: 'request',
      documentId: 'doc_pg12',
      fromVersionId: chain[0]!.id,
    });
    expect(resp.type).toBe('sync');
    if (resp.type === 'sync' && resp.role === 'response') {
      expect(resp.baseSnapshot).toBeTruthy();
    }
    void createCountingObserver;
    void allowAllAuth;
  });
});
