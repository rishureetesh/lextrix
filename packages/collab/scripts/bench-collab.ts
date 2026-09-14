/**
 * Phase 10 collab benchmarks (reference server session).
 * Run: npm run bench:collab -w lextrix-collab
 */
import { performance } from 'node:perf_hooks';
import ChangeSet from 'lextrix-change';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence';
import { DocumentServerSession } from '../src/index.js';

async function timeMs(
  fn: () => Promise<void> | void,
  iterations: number,
): Promise<number> {
  for (let i = 0; i < Math.min(5, iterations); i += 1) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) await fn();
  return (performance.now() - start) / iterations;
}

const results: Array<Record<string, string | number>> = [];

{
  const persistence = new InMemoryAuthoritativePersistence();
  const session = await DocumentServerSession.open(
    'bench',
    { persistence },
    { contents: new ChangeSet([{ insert: 'bench\n' }]), createIfMissing: true },
  );
  let n = 0;
  const sequentialMs = await timeMs(async () => {
    const head = session.getHead().id;
    n += 1;
    await session.accept({
      changeId: `seq_${n}_${Math.random()}`,
      documentId: 'bench',
      baseVersionId: head,
      change: new ChangeSet([{ insert: 's' }]),
      dependsOn: [],
      meta: {},
    });
  }, 40);
  results.push({ metric: 'server_sequential_accept', ms: Number(sequentialMs.toFixed(4)) });

  const casMs = await timeMs(() => {
    const head = persistence.loadHead('bench')!;
    // no-op measure loadHead
    void head;
  }, 200);
  results.push({ metric: 'load_head', ms: Number(casMs.toFixed(4)) });
}

for (const depth of [1, 10, 100] as const) {
  const persistence = new InMemoryAuthoritativePersistence();
  const session = await DocumentServerSession.open(
    `bench_d${depth}`,
    { persistence, maxRebaseDepth: 200 },
    { contents: new ChangeSet([{ insert: 'd\n' }]), createIfMissing: true },
  );
  let base = session.getHead().id;
  const root = base;
  for (let i = 0; i < depth; i += 1) {
    const r = await session.accept({
      changeId: `pre_${depth}_${i}`,
      documentId: `bench_d${depth}`,
      baseVersionId: base,
      change: new ChangeSet([{ insert: 'p' }]),
      dependsOn: i === 0 ? [] : [`pre_${depth}_${i - 1}`],
      meta: {},
    });
    if (r.ok) base = r.version.id;
  }
  const staleMs = await timeMs(async () => {
    await session.accept({
      changeId: `stale_${depth}_${Math.random()}`,
      documentId: `bench_d${depth}`,
      baseVersionId: root,
      change: new ChangeSet([{ insert: 'S' }]),
      dependsOn: [],
      meta: {},
    });
  }, Math.max(3, Math.floor(30 / Math.max(1, depth / 10))));
  results.push({
    metric: `server_stale_accept_depth_${depth}`,
    ms: Number(staleMs.toFixed(4)),
  });
}

{
  const persistence = new InMemoryAuthoritativePersistence();
  const session = await DocumentServerSession.open(
    'bench_dup',
    { persistence },
    { contents: new ChangeSet([{ insert: 'u\n' }]), createIfMissing: true },
  );
  const head = session.getHead().id;
  const env = {
    changeId: 'dup_once',
    documentId: 'bench_dup',
    baseVersionId: head,
    change: new ChangeSet([{ insert: 'U' }]),
    dependsOn: [] as string[],
    meta: {},
  };
  await session.accept(env);
  const dupMs = await timeMs(async () => {
    await session.accept(env);
  }, 100);
  results.push({ metric: 'duplicate_changeId', ms: Number(dupMs.toFixed(4)) });
}

for (const n of [10, 100] as const) {
  const persistence = new InMemoryAuthoritativePersistence();
  const session = await DocumentServerSession.open(
    `bench_sync_${n}`,
    { persistence },
    { contents: new ChangeSet([{ insert: 's\n' }]), createIfMissing: true },
  );
  let base = session.getHead().id;
  const root = base;
  for (let i = 0; i < n; i += 1) {
    const r = await session.accept({
      changeId: `sy_${n}_${i}`,
      documentId: `bench_sync_${n}`,
      baseVersionId: base,
      change: new ChangeSet([{ insert: 'x' }]),
      dependsOn: i === 0 ? [] : [`sy_${n}_${i - 1}`],
      meta: {},
    });
    if (r.ok) base = r.version.id;
  }
  const syncMs = await timeMs(async () => {
    await session.sync({
      type: 'sync',
      role: 'request',
      documentId: `bench_sync_${n}`,
      fromVersionId: root,
    });
  }, 20);
  results.push({ metric: `sync_history_${n}`, ms: Number(syncMs.toFixed(4)) });
}

console.log(JSON.stringify({ bench: 'lextrix-collab-phase10', results }, null, 2));
for (const row of results) {
  console.log(`[phase10 ${row.metric}] ${row.ms}ms`);
}
