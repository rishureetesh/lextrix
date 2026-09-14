/**
 * Phase 11 benches (in-memory fencing path; PG when LEXTRIX_PG_URL set).
 */
import { performance } from 'node:perf_hooks';
import ChangeSet from 'lextrix-change';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence';
import {
  DocumentServerSession,
  InMemoryDocumentOwnership,
} from 'lextrix-collab';

class SyncedOwnership extends InMemoryDocumentOwnership {
  constructor(
    private p: InMemoryAuthoritativePersistence,
    opts: ConstructorParameters<typeof InMemoryDocumentOwnership>[0],
  ) {
    super(opts);
  }
  override async acquire(documentId: string) {
    const lease = await super.acquire(documentId);
    this.p.setOwnerEpoch(documentId, lease.ownerEpoch);
    return lease;
  }
}

async function timeMs(fn: () => Promise<void>, n: number): Promise<number> {
  for (let i = 0; i < Math.min(3, n); i += 1) await fn();
  const t0 = performance.now();
  for (let i = 0; i < n; i += 1) await fn();
  return (performance.now() - t0) / n;
}

const results: Array<Record<string, string | number>> = [];

{
  const persist = new InMemoryAuthoritativePersistence();
  const ownership = new SyncedOwnership(persist, { ownerId: 'bench' });
  const session = await DocumentServerSession.open(
    'bench_doc',
    { persistence: persist, ownership },
    { contents: new ChangeSet([{ insert: 'b\n' }]), createIfMissing: true },
  );
  let i = 0;
  const acceptMs = await timeMs(async () => {
    i += 1;
    const head = session.getHead().id;
    await session.accept({
      changeId: `b_${i}`,
      documentId: 'bench_doc',
      baseVersionId: head,
      change: new ChangeSet([{ insert: 'x' }]),
      dependsOn: [],
      meta: {},
    });
  }, 30);
  results.push({ metric: 'server_accept_fenced', ms: Number(acceptMs.toFixed(4)) });

  const ownMs = await timeMs(async () => {
    await ownership.acquire(`bench_own_${Math.random()}`);
  }, 40);
  results.push({ metric: 'ownership_acquisition', ms: Number(ownMs.toFixed(4)) });

  const idempMs = await timeMs(async () => {
    await session.accept({
      changeId: 'dup_bench',
      documentId: 'bench_doc',
      baseVersionId: session.getHead().id,
      change: new ChangeSet([{ insert: 'd' }]),
      dependsOn: [],
      meta: {},
    });
  }, 20);
  results.push({ metric: 'durable_idempotency_lookup', ms: Number(idempMs.toFixed(4)) });
}

// Phase 12: snapshot + presence fanout
{
  const {
    InMemorySnapshotPersistence,
    InMemoryVersionArchive,
    CompactionController,
    createSnapshotFromVersion,
  } = await import('lextrix-change/persistence');
  const persist = new InMemoryAuthoritativePersistence();
  const snapshots = new InMemorySnapshotPersistence();
  const archive = new InMemoryVersionArchive();
  const session = await DocumentServerSession.open(
    'bench_snap',
    { persistence: persist, snapshots },
    { contents: new ChangeSet([{ insert: 's\n' }]), createIfMissing: true },
  );
  for (let i = 0; i < 20; i += 1) {
    await session.accept({
      changeId: `s_${i}`,
      documentId: 'bench_snap',
      baseVersionId: session.getHead().id,
      change: new ChangeSet([{ insert: 'y' }]),
      dependsOn: [],
      meta: {},
    });
  }
  const sealed = persist.loadChain('bench_snap')[10]!;
  const snapMs = await timeMs(async () => {
    snapshots.createSnapshot(createSnapshotFromVersion(sealed));
  }, 10);
  results.push({ metric: 'snapshot_create', ms: Number(snapMs.toFixed(4)) });

  const ctrl = new CompactionController({
    persistence: persist,
    snapshots,
    archive,
    removeHotBeforeSeal: (d, b) => persist.removeHotBeforeSequence(d, b),
  });
  await ctrl.createSnapshotAt('bench_snap', sealed);
  const compactMs = await timeMs(async () => {
    await ctrl.compactTo('bench_snap', sealed.id, { purge: false });
  }, 1);
  results.push({ metric: 'compaction', ms: Number(compactMs.toFixed(4)) });

  const presenceMs = await timeMs(async () => {
    session.publishPresence('u1', Date.now(), { cursor: { x: 1 } });
  }, 100);
  results.push({ metric: 'presence_fanout', ms: Number(presenceMs.toFixed(4)) });

  const acceptDuringPresence = await timeMs(async () => {
    await session.accept({
      changeId: `ap_${Math.random()}`,
      documentId: 'bench_snap',
      baseVersionId: session.getHead().id,
      change: new ChangeSet([{ insert: 'z' }]),
      dependsOn: [],
      meta: {},
    });
    session.publishPresence('u1', Date.now(), { cursor: { x: 2 } });
  }, 20);
  results.push({
    metric: 'presence_vs_accept',
    ms: Number(acceptDuringPresence.toFixed(4)),
  });
}

console.log(JSON.stringify({ bench: 'lextrix-server-phase12', results }, null, 2));
for (const row of results) {
  console.log(`[phase12 ${row.metric}] ${row.ms}ms`);
}
