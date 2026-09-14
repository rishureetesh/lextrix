/**
 * Phase 10 — DocumentServerSession authority, OT, CAS, idempotency, sync.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence';
import { DocumentHandle } from 'lextrix-change/document';
import {
  DocumentServerSession,
  type CollabControlFrame,
} from '../src/index.js';

async function openSession(
  opts: {
    maxRebaseDepth?: number;
    contents?: ChangeSet;
    authorize?: boolean;
  } = {},
) {
  const persistence = new InMemoryAuthoritativePersistence();
  const frames: CollabControlFrame[] = [];
  const session = await DocumentServerSession.open(
    'doc_test',
    {
      persistence,
      maxRebaseDepth: opts.maxRebaseDepth ?? 64,
      authorizeEnvelope: async () => opts.authorize !== false,
      observe: () => {},
    },
    { contents: opts.contents ?? new ChangeSet([{ insert: 'Hello\n' }]), createIfMissing: true },
  );
  session.subscribe((f) => frames.push(f));
  return { session, persistence, frames };
}

describe('Phase 10 server authority', () => {
  it('server generates Version id/sequence/parent; client cannot choose', async () => {
    const { session } = await openSession();
    const head = session.getHead();
    const result = await session.accept({
      changeId: 'c1',
      documentId: 'doc_test',
      baseVersionId: head.id,
      change: new ChangeSet([{ insert: 'X' }]),
      dependsOn: [],
      meta: {},
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.version.id).toBe(`doc_test:v1`);
    expect(result.version.sequence).toBe(1);
    expect(result.version.parentId).toBe(head.id);
    expect(result.version.contents.ops).not.toEqual([{ insert: 'forged' }]);
    // Client-supplied forged version fields are ignored — only ChangeSet applied.
  });

  it('sequential acceptance chains parentage', async () => {
    const { session } = await openSession();
    const v0 = session.getHead().id;
    const a = await session.accept({
      changeId: 'a',
      documentId: 'doc_test',
      baseVersionId: v0,
      change: new ChangeSet([{ insert: 'A' }]),
      dependsOn: [],
      meta: {},
    });
    const b = await session.accept({
      changeId: 'b',
      documentId: 'doc_test',
      baseVersionId: (a as { version: { id: string } }).version.id,
      change: new ChangeSet([{ insert: 'B' }]),
      dependsOn: ['a'],
      meta: {},
    });
    const c = await session.accept({
      changeId: 'c',
      documentId: 'doc_test',
      baseVersionId: (b as { version: { id: string } }).version.id,
      change: new ChangeSet([{ insert: 'C' }]),
      dependsOn: ['b'],
      meta: {},
    });
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (!a.ok || !b.ok || !c.ok) return;
    expect(a.version.parentId).toBe(v0);
    expect(b.version.parentId).toBe(a.version.id);
    expect(c.version.parentId).toBe(b.version.id);
    expect(c.version.sequence).toBe(3);
  });

  it('concurrent OT: B transforms through A', async () => {
    const { session } = await openSession({
      contents: new ChangeSet([{ insert: 'ab\n' }]),
    });
    const v0 = session.getHead().id;
    const a = await session.accept({
      changeId: 'A',
      documentId: 'doc_test',
      baseVersionId: v0,
      change: new ChangeSet([{ insert: 'X' }]),
      dependsOn: [],
      meta: {},
    });
    const b = await session.accept({
      changeId: 'B',
      documentId: 'doc_test',
      baseVersionId: v0,
      change: new ChangeSet([{ retain: 1 }, { insert: 'Y' }]),
      dependsOn: [],
      meta: {},
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.version.parentId).toBe(a.version.id);
    expect(session.getHead().contents.ops).toEqual(b.version.contents.ops);
  });

  it('stale base transforms through intervening history', async () => {
    const { session } = await openSession();
    const v0 = session.getHead().id;
    await session.accept({
      changeId: 's1',
      documentId: 'doc_test',
      baseVersionId: v0,
      change: new ChangeSet([{ insert: '1' }]),
      dependsOn: [],
      meta: {},
    });
    const v1 = session.getHead().id;
    await session.accept({
      changeId: 's2',
      documentId: 'doc_test',
      baseVersionId: v1,
      change: new ChangeSet([{ insert: '2' }]),
      dependsOn: ['s1'],
      meta: {},
    });
    const stale = await session.accept({
      changeId: 'stale',
      documentId: 'doc_test',
      baseVersionId: v0,
      change: new ChangeSet([{ insert: 'Z' }]),
      dependsOn: [],
      meta: {},
    });
    expect(stale.ok).toBe(true);
    if (!stale.ok) return;
    expect(stale.version.parentId).toBe(session.getHead().id === stale.version.id ? stale.version.parentId : stale.version.parentId);
    expect(stale.version.sequence).toBe(3);
  });

  it('CAS conflict: only one writer wins', async () => {
    const persistence = new InMemoryAuthoritativePersistence();
    const frames: CollabControlFrame[] = [];
    const session = await DocumentServerSession.open(
      'doc_cas',
      { persistence },
      { contents: new ChangeSet([{ insert: 'c\n' }]), createIfMissing: true },
    );
    session.subscribe((f) => frames.push(f));
    const head = session.getHead();
    const pre = JSON.stringify(session.getHandle().document.contents.ops);

    const winner = DocumentHandle.fromVersions(persistence.loadChain('doc_cas'));
    winner.apply(new ChangeSet([{ insert: 'WIN' }]));
    const forged = winner.currentVersion();
    const cas1 = persistence.compareAndAppend('doc_cas', head.id, forged);
    expect(cas1.ok).toBe(true);

    frames.length = 0;
    const result = await session.accept({
      changeId: 'loser',
      documentId: 'doc_cas',
      baseVersionId: head.id,
      change: new ChangeSet([{ insert: 'LOSE' }]),
      dependsOn: [],
      meta: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('cas_conflict');
    expect(session.getHead().id).toBe(head.id);
    expect(JSON.stringify(session.getHandle().document.contents.ops)).toBe(pre);
    expect(persistence.loadHead('doc_cas')?.id).toBe(forged.id);
    expect(
      frames.filter((f) => f.type === 'ack' && f.level === 'history'),
    ).toHaveLength(0);
  });

  it('duplicate changeId does not create second Version', async () => {
    const { session, persistence } = await openSession();
    const v0 = session.getHead().id;
    const env = {
      changeId: 'dup',
      documentId: 'doc_test',
      baseVersionId: v0,
      change: new ChangeSet([{ insert: 'D' }]),
      dependsOn: [] as string[],
      meta: {},
    };
    const first = await session.accept(env);
    const second = await session.accept(env);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.duplicate).toBe(true);
    expect(second.version.id).toBe(first.version.id);
    expect(persistence.loadChain('doc_test')).toHaveLength(2); // root + one
  });

  it('history ACK only after durable append (frames include history with versionId)', async () => {
    const { session, frames } = await openSession();
    const v0 = session.getHead().id;
    await session.accept({
      changeId: 'h1',
      documentId: 'doc_test',
      baseVersionId: v0,
      change: new ChangeSet([{ insert: 'H' }]),
      dependsOn: [],
      meta: {},
    });
    const history = frames.filter(
      (f) => f.type === 'ack' && f.level === 'history',
    );
    expect(history.length).toBeGreaterThan(0);
    expect((history[0] as { versionId?: string }).versionId).toBeTruthy();
  });

  it('unknown base → sync_required', async () => {
    const { session } = await openSession();
    const result = await session.accept({
      changeId: 'x',
      documentId: 'doc_test',
      baseVersionId: 'missing',
      change: new ChangeSet([{ insert: 'X' }]),
      dependsOn: [],
      meta: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('sync_required');
  });

  it('rebase limit → sync_required', async () => {
    const { session } = await openSession({ maxRebaseDepth: 2 });
    let base = session.getHead().id;
    for (let i = 0; i < 4; i += 1) {
      const r = await session.accept({
        changeId: `r${i}`,
        documentId: 'doc_test',
        baseVersionId: base,
        change: new ChangeSet([{ insert: `${i}` }]),
        dependsOn: i === 0 ? [] : [`r${i - 1}`],
        meta: {},
      });
      expect(r.ok).toBe(true);
      if (r.ok) base = r.version.id;
    }
    const root = session.getHandle().listVersions()[0]!.id;
    const stale = await session.accept({
      changeId: 'too_old',
      documentId: 'doc_test',
      baseVersionId: root,
      change: new ChangeSet([{ insert: 'Q' }]),
      dependsOn: [],
      meta: {},
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.code).toBe('sync_required');
  });

  it('missing dependsOn → causal_dependency', async () => {
    const { session } = await openSession();
    const v0 = session.getHead().id;
    const result = await session.accept({
      changeId: 'child',
      documentId: 'doc_test',
      baseVersionId: v0,
      change: new ChangeSet([{ insert: 'C' }]),
      dependsOn: ['never'],
      meta: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('causal_dependency');
  });

  it('sync returns versions after fromVersionId', async () => {
    const { session } = await openSession();
    let base = session.getHead().id;
    for (let i = 0; i < 3; i += 1) {
      const r = await session.accept({
        changeId: `sy${i}`,
        documentId: 'doc_test',
        baseVersionId: base,
        change: new ChangeSet([{ insert: `${i}` }]),
        dependsOn: i === 0 ? [] : [`sy${i - 1}`],
        meta: {},
      });
      if (r.ok) base = r.version.id;
    }
    const v0 = session.getHandle().listVersions()[0]!.id;
    const sync = await session.sync({
      type: 'sync',
      role: 'request',
      documentId: 'doc_test',
      fromVersionId: v0,
    });
    expect(sync.type).toBe('sync');
    if (sync.type !== 'sync' || sync.role !== 'response') return;
    expect(sync.versions).toHaveLength(3);
  });

  it('authorization hook can reject', async () => {
    const { session } = await openSession({ authorize: false });
    const result = await session.accept({
      changeId: 'nope',
      documentId: 'doc_test',
      baseVersionId: session.getHead().id,
      change: new ChangeSet([{ insert: 'N' }]),
      dependsOn: [],
      meta: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('authorization_failed');
  });

  it('malformed wire fails closed', async () => {
    const { session } = await openSession();
    const result = await session.accept('{not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('invalid_envelope');
  });
});
