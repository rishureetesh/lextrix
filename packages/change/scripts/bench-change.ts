/**
 * Reproducible ChangeSet / Document / Version / Anchor benchmarks.
 * Run: npm run bench:change -w lextrix-change
 */
import { performance } from 'node:perf_hooks';
import ChangeSet from '../src/change/change-set.js';
import { createAnchor } from '../src/experimental/anchor.js';
import { createDocument } from '../src/experimental/document.js';
import { DocumentHandle } from '../src/experimental/document-handle.js';
import { createRange } from '../src/experimental/range.js';
import {
  createChangeId,
  createInMemoryCollabPair,
} from '../src/experimental/collaboration.js';
import { parseChangeProposal } from '../src/experimental/parse-change-proposal.js';
import { validateVersionChain } from '../src/experimental/validate-version-chain.js';
import { InMemoryDocumentPersistence } from '../src/persistence/index.js';
import {
  parseChangeSet,
  parseCollabEnvelope,
  parseDocumentVersion,
  serializeChangeSet,
  serializeCollabEnvelope,
  serializeDocumentVersion,
} from '../src/wire/index.js';
import {
  generateChangeAgainstDocument,
  generateDocument,
} from '../src/testing/generators.js';
import { SeededRandom } from '../src/testing/seeded-random.js';

function timeMs(fn: () => void, iterations: number): number {
  for (let i = 0; i < Math.min(10, iterations); i += 1) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) fn();
  return (performance.now() - start) / iterations;
}

function sizeOfChangeSet(cs: ChangeSet): number {
  return JSON.stringify(cs.ops).length;
}

const SIZES = {
  tiny: { maxSegments: 2, maxSegmentLen: 4, iterations: 800 },
  medium: { maxSegments: 8, maxSegmentLen: 20, iterations: 200 },
  large: { maxSegments: 40, maxSegmentLen: 40, iterations: 40 },
} as const;

const results: Array<Record<string, string | number>> = [];

for (const [label, cfg] of Object.entries(SIZES)) {
  const rng = new SeededRandom(1000 + label.length);
  const docs: ChangeSet[] = [];
  const changes: ChangeSet[] = [];
  for (let i = 0; i < 20; i += 1) {
    const doc = generateDocument(rng, {
      maxSegments: cfg.maxSegments,
      maxSegmentLen: cfg.maxSegmentLen,
    });
    docs.push(doc);
    changes.push(generateChangeAgainstDocument(rng, doc));
  }

  let idx = 0;
  const nextPair = () => {
    const i = idx % docs.length;
    idx += 1;
    return [docs[i]!, changes[i]!] as const;
  };

  const composeMs = timeMs(() => {
    const [doc, change] = nextPair();
    doc.compose(change);
  }, cfg.iterations);

  idx = 0;
  const invertMs = timeMs(() => {
    const [doc, change] = nextPair();
    change.invert(doc);
  }, cfg.iterations);

  idx = 0;
  const transformMs = timeMs(() => {
    const [doc] = nextPair();
    const a = generateChangeAgainstDocument(rng, doc);
    const b = generateChangeAgainstDocument(rng, doc);
    a.transform(b, true);
  }, Math.max(10, Math.floor(cfg.iterations / 2)));

  idx = 0;
  const diffMs = timeMs(() => {
    const [doc, change] = nextPair();
    const d2 = doc.compose(change);
    doc.diff(d2);
  }, cfg.iterations);

  idx = 0;
  const applyMs = timeMs(() => {
    const [doc, change] = nextPair();
    const d = createDocument({ contents: doc, validate: false });
    d.apply(change, { validate: false });
  }, cfg.iterations);

  idx = 0;
  const txCommitMs = timeMs(() => {
    const [doc] = nextPair();
    const d = createDocument({ contents: doc, validate: false });
    const tx = d.transaction();
    const len = Math.max(1, d.getContents().length());
    const at = Math.min(1, len - 1);
    tx.insert(at, 'x');
    tx.commit({ source: 'api' });
  }, cfg.iterations);

  idx = 0;
  const txApplyMs = timeMs(() => {
    const [doc] = nextPair();
    const handle = DocumentHandle.create({ contents: doc, validate: false });
    handle.commitTransaction(
      (tx) => {
        const len = Math.max(1, handle.getContents().length());
        tx.insert(Math.min(1, len - 1), 'x');
      },
      { source: 'api' },
    );
  }, cfg.iterations);

  idx = 0;
  const versionApplyMs = timeMs(() => {
    const [doc, change] = nextPair();
    const handle = DocumentHandle.create({ contents: doc, validate: false });
    if (change.length() > 0) {
      handle.apply(change, { validate: false });
    }
  }, cfg.iterations);

  const chainDoc = docs[0]!;
  const chainHandle = DocumentHandle.create({
    contents: chainDoc,
    validate: false,
  });
  const vStart = chainHandle.currentVersion();
  for (let i = 0; i < 5; i += 1) {
    const ch = generateChangeAgainstDocument(rng, chainHandle.getContents());
    if (ch.length() > 0) {
      chainHandle.apply(ch, { validate: false });
    }
  }
  const vEnd = chainHandle.currentVersion();
  const versionsRetained = chainHandle.listVersions().length;
  const snapshotBytes = chainHandle
    .listVersions()
    .reduce((sum, v) => sum + sizeOfChangeSet(v.contents), 0);

  const versionDiffMs = timeMs(() => {
    chainHandle.diffVersions(vStart, vEnd);
  }, cfg.iterations);

  const anchor = createAnchor(
    vStart,
    Math.min(1, Math.max(0, vStart.contents.length() - 1)),
    { affinity: 'after' },
  );
  const chainDiff = chainHandle.diffVersions(vStart, vEnd);
  const anchorMapMs = timeMs(() => {
    anchor.mapThrough(chainDiff, vEnd);
  }, cfg.iterations);

  const rangeStart = 0;
  const rangeEnd = Math.min(4, Math.max(0, vStart.contents.length()));
  const range = createRange(vStart, rangeStart, rangeEnd);
  const rangeMapMs = timeMs(() => {
    range.mapThrough(chainDiff, vEnd);
  }, cfg.iterations);

  idx = 0;
  const proposalAcceptMs = timeMs(() => {
    const [doc, change] = nextPair();
    const handle = DocumentHandle.create({ contents: doc, validate: false });
    const proposal = handle.createProposal(change, {
      meta: { source: 'api', origin: 'system' },
    });
    if (change.length() > 0) {
      handle.acceptProposal(proposal);
    }
  }, Math.max(10, Math.floor(cfg.iterations / 2)));

  // Phase 5B: rebase across 1 / 10 / 100 version steps (medium size only for 100).
  const rebaseLens =
    label === 'large' ? [1, 10] : label === 'medium' ? [1, 10, 100] : [1, 10];
  const rebaseMs: Record<string, number> = {};
  for (const steps of rebaseLens) {
    const baseDoc = docs[0]!;
    const rh = DocumentHandle.create({ contents: baseDoc, validate: false });
    const v0 = rh.currentVersion();
    const pending = generateChangeAgainstDocument(rng, rh.getContents());
    const proposal = rh.createProposal(pending, {
      meta: { source: 'api', origin: 'system' },
    });
    for (let s = 0; s < steps; s += 1) {
      const ch = generateChangeAgainstDocument(rng, rh.getContents());
      if (ch.length() > 0) rh.apply(ch, { validate: false });
    }
    const tip = rh.currentVersion();
    rebaseMs[`rebase${steps}Ms`] = Number(
      timeMs(() => {
        rh.rebaseProposal(proposal, tip);
      }, Math.max(5, Math.floor(cfg.iterations / Math.max(1, steps / 5)))).toFixed(
        4,
      ),
    );
    void v0;
  }

  idx = 0;
  const collabPairMs = timeMs(() => {
    const [doc] = nextPair();
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(doc);
    coordinator.setAutoDeliver(false);
    const a = generateChangeAgainstDocument(rng, handleA.getContents());
    const b = generateChangeAgainstDocument(rng, handleB.getContents());
    if (a.length() === 0 || b.length() === 0) {
      clientA.destroy();
      clientB.destroy();
      return;
    }
    const baseA = handleA.currentVersion().id;
    const baseB = handleB.currentVersion().id;
    handleA.apply(a, { validate: false });
    clientA.submitLocal(a, { baseVersionId: baseA });
    handleB.apply(b, { validate: false });
    clientB.submitLocal(b, { baseVersionId: baseB });
    coordinator.flush();
    clientA.destroy();
    clientB.destroy();
  }, Math.max(5, Math.floor(cfg.iterations / 4)));

  idx = 0;
  const proposalSerializeMs = timeMs(() => {
    const [doc, change] = nextPair();
    const handle = DocumentHandle.create({ contents: doc, validate: false });
    const proposal = handle.createProposal(change, {
      meta: { source: 'ai', intent: 'bench', explanation: 'phase6a' },
    });
    const json = JSON.stringify(proposal.toJSON());
    parseChangeProposal(json);
  }, Math.max(10, Math.floor(cfg.iterations / 2)));

  idx = 0;
  const proposalInspectMs = timeMs(() => {
    const [doc, change] = nextPair();
    const handle = DocumentHandle.create({ contents: doc, validate: false });
    const proposal = handle.createProposal(change, {
      meta: { source: 'ai' },
    });
    handle.inspectProposal(proposal);
  }, Math.max(10, Math.floor(cfg.iterations / 2)));

  idx = 0;
  const collabDupMs = timeMs(() => {
    const [doc] = nextPair();
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(doc);
    coordinator.setAutoDeliver(false);
    const b = generateChangeAgainstDocument(rng, handleB.getContents());
    if (b.length() === 0) {
      clientA.destroy();
      clientB.destroy();
      return;
    }
    const baseB = handleB.currentVersion().id;
    handleB.apply(b, { validate: false });
    const env = clientB.submitLocal(b, { baseVersionId: baseB });
    coordinator.flush();
    clientA.ingestRemote(env);
    clientA.ingestRemote(env);
    clientA.destroy();
    clientB.destroy();
  }, Math.max(5, Math.floor(cfg.iterations / 4)));

  idx = 0;
  const proposalStaleDetectMs = timeMs(() => {
    const [doc, change] = nextPair();
    const handle = DocumentHandle.create({ contents: doc, validate: false });
    const proposal = handle.createProposal(change, {
      meta: { source: 'ai' },
    });
    handle.apply(new ChangeSet().retain(0).insert('Z'), { validate: false });
    handle.inspectProposal(proposal);
  }, Math.max(10, Math.floor(cfg.iterations / 2)));

  results.push({
    size: label,
    composeMsPerOp: Number(composeMs.toFixed(4)),
    transformMsPerOp: Number(transformMs.toFixed(4)),
    invertMsPerOp: Number(invertMs.toFixed(4)),
    diffMsPerOp: Number(diffMs.toFixed(4)),
    applyMsPerOp: Number(applyMs.toFixed(4)),
    transactionCommitMsPerOp: Number(txCommitMs.toFixed(4)),
    commitTransactionMsPerOp: Number(txApplyMs.toFixed(4)),
    versionApplyMsPerOp: Number(versionApplyMs.toFixed(4)),
    versionDiffMsPerOp: Number(versionDiffMs.toFixed(4)),
    anchorMapMsPerOp: Number(anchorMapMs.toFixed(4)),
    rangeMapMsPerOp: Number(rangeMapMs.toFixed(4)),
    proposalAcceptMsPerOp: Number(proposalAcceptMs.toFixed(4)),
    proposalSerializeMsPerOp: Number(proposalSerializeMs.toFixed(4)),
    proposalInspectMsPerOp: Number(proposalInspectMs.toFixed(4)),
    proposalStaleDetectMsPerOp: Number(proposalStaleDetectMs.toFixed(4)),
    ...rebaseMs,
    collabPairMsPerOp: Number(collabPairMs.toFixed(4)),
    collabDupMsPerOp: Number(collabDupMs.toFixed(4)),
    versionsRetained,
    snapshotBytesTotal: snapshotBytes,
    sampleDocBytes: sizeOfChangeSet(docs[0]!),
    sampleChangeBytes: sizeOfChangeSet(changes[0]!),
  });
}

console.log(JSON.stringify({ bench: 'lextrix-change', results }, null, 2));
for (const row of results) {
  console.log(
    `[${row.size}] apply=${row.applyMsPerOp}ms rebase1=${row.rebase1Ms}ms proposalAccept=${row.proposalAcceptMsPerOp}ms serialize=${row.proposalSerializeMsPerOp}ms inspect=${row.proposalInspectMsPerOp}ms collab=${row.collabPairMsPerOp}ms`,
  );
}

// —— Phase 7: long version chains + wire serialize/parse baselines ——
const chainResults: Array<Record<string, string | number>> = [];
for (const n of [10, 100, 1000] as const) {
  const handle = DocumentHandle.create({
    contents: new ChangeSet([{ insert: 'base\n' }]),
    validate: false,
  });
  const t0 = performance.now();
  for (let i = 0; i < n; i += 1) {
    handle.apply(new ChangeSet([{ insert: 'x' }]), { validate: false });
  }
  const applyChainMs = performance.now() - t0;
  const versions = handle.listVersions();
  const last = versions[versions.length - 1]!;
  const snapBytes = JSON.stringify(serializeDocumentVersion(last)).length;
  const totalSnapBytes = versions.reduce(
    (sum, v) => sum + JSON.stringify(serializeDocumentVersion(v)).length,
    0,
  );
  const serMs = timeMs(() => {
    serializeDocumentVersion(last);
  }, Math.max(5, Math.floor(2000 / n)));
  const parseMs = timeMs(() => {
    parseDocumentVersion(serializeDocumentVersion(last));
  }, Math.max(5, Math.floor(2000 / n)));
  const cs = handle.getContents();
  const csSerMs = timeMs(() => {
    serializeChangeSet(cs);
  }, 50);
  const csParseMs = timeMs(() => {
    parseChangeSet(serializeChangeSet(cs));
  }, 50);
  chainResults.push({
    versions: n,
    applyChainMs: Number(applyChainMs.toFixed(2)),
    lastSnapshotBytes: snapBytes,
    allSnapshotsBytes: totalSnapBytes,
    serializeVersionMs: Number(serMs.toFixed(4)),
    parseVersionMs: Number(parseMs.toFixed(4)),
    serializeChangeSetMs: Number(csSerMs.toFixed(4)),
    parseChangeSetMs: Number(csParseMs.toFixed(4)),
    docOps: cs.ops.length,
  });
}

console.log(
  JSON.stringify({ bench: 'lextrix-change-phase7-chains', chainResults }, null, 2),
);
for (const row of chainResults) {
  console.log(
    `[chain ${row.versions}] applyChain=${row.applyChainMs}ms lastSnap=${row.lastSnapshotBytes}B allSnaps=${row.allSnapshotsBytes}B serV=${row.serializeVersionMs}ms parseV=${row.parseVersionMs}ms`,
  );
}

// —— Phase 8: observer notification overhead ——
const observerResults: Array<Record<string, string | number>> = [];
const baseDoc = new ChangeSet([{ insert: 'hello world\n' }]);
for (const listenerCount of [0, 1, 10, 100] as const) {
  const handle = DocumentHandle.create({
    contents: baseDoc.clone(),
    validate: false,
  });
  for (let i = 0; i < listenerCount; i += 1) {
    handle.subscribe(() => {
      /* no-op */
    });
  }
  const change = new ChangeSet([{ retain: 5 }, { insert: '!' }]);
  const applyWithObserversMs = timeMs(() => {
    // Reset by applying then restoring is expensive; instead create fresh each iter via compose path:
    handle.apply(change, { validate: false });
  }, 40);
  observerResults.push({
    listeners: listenerCount,
    applyWithObserversMs: Number(applyWithObserversMs.toFixed(4)),
    versionsAfter: handle.listVersions().length,
  });
}
console.log(
  JSON.stringify({ bench: 'lextrix-change-phase8-observers', observerResults }, null, 2),
);
for (const row of observerResults) {
  console.log(
    `[observers ${row.listeners}] apply=${row.applyWithObserversMs}ms versions=${row.versionsAfter}`,
  );
}

// —— Phase 9: persistence / hydrate / envelope ——
const phase9: Array<Record<string, string | number>> = [];
{
  const store = new InMemoryDocumentPersistence();
  const handle = DocumentHandle.create({
    contents: new ChangeSet([{ insert: 'bench\n' }]),
    validate: false,
  });
  store.appendVersion(handle.currentVersion());
  const v1 = (() => {
    handle.apply(new ChangeSet([{ insert: 'x' }]), { validate: false });
    return handle.currentVersion();
  })();
  const appendMs = timeMs(() => {
    store.appendVersion(v1);
  }, 200);
  const dupAppendMs = timeMs(() => {
    store.appendVersion(v1);
  }, 200);

  for (const n of [10, 100, 1000] as const) {
    const h = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'h\n' }]),
      validate: false,
    });
    for (let i = 0; i < n; i += 1) {
      h.apply(new ChangeSet([{ insert: 'a' }]), { validate: false });
    }
    const versions = h.listVersions();
    const hydrateMs = timeMs(() => {
      DocumentHandle.fromVersions(versions, { validate: false });
    }, Math.max(2, Math.floor(50 / Math.max(1, n / 100))));
    const composeValMs = timeMs(() => {
      validateVersionChain(versions);
    }, Math.max(2, Math.floor(50 / Math.max(1, n / 100))));
    phase9.push({
      metric: `hydrate_${n}`,
      ms: Number(hydrateMs.toFixed(4)),
      versions: n,
    });
    phase9.push({
      metric: `compose_integrity_${n}`,
      ms: Number(composeValMs.toFixed(4)),
      versions: n,
    });
  }

  const env = {
    changeId: createChangeId('bench'),
    documentId: handle.documentId,
    baseVersionId: handle.currentVersion().id,
    change: new ChangeSet([{ insert: 'e' }]),
    dependsOn: [] as string[],
    meta: { source: 'user' as const, origin: 'editor' as const },
  };
  const envSerMs = timeMs(() => {
    serializeCollabEnvelope(env);
  }, 200);
  const wire = serializeCollabEnvelope(env);
  const envParseMs = timeMs(() => {
    parseCollabEnvelope(wire);
  }, 200);

  phase9.push({ metric: 'append_version', ms: Number(appendMs.toFixed(4)) });
  phase9.push({
    metric: 'append_duplicate_version',
    ms: Number(dupAppendMs.toFixed(4)),
  });
  phase9.push({
    metric: 'envelope_serialize',
    ms: Number(envSerMs.toFixed(4)),
  });
  phase9.push({
    metric: 'envelope_parse',
    ms: Number(envParseMs.toFixed(4)),
  });
}
console.log(JSON.stringify({ bench: 'lextrix-change-phase9', phase9 }, null, 2));
for (const row of phase9) {
  console.log(`[phase9 ${row.metric}] ${row.ms}ms`);
}
