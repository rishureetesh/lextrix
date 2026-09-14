/**
 * Phase 6B intelligence benchmarks (document-side only; no network).
 */
import { performance } from 'node:perf_hooks';
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/experimental';
import {
  createIntelligenceRequest,
  DeterministicDocumentIntelligenceProvider,
  evaluateProposalAcceptancePolicy,
  extractRequestContext,
  readProposalProvenance,
  createProposalReview,
  computePreviewContents,
} from '../src/index.js';

function timeMs(fn: () => void | Promise<void>, iterations: number): number {
  // sync warm-up only for sync fns
  return 0;
}

async function timeMsAsync(
  fn: () => void | Promise<void>,
  iterations: number,
): Promise<number> {
  for (let i = 0; i < Math.min(5, iterations); i += 1) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) await fn();
  return (performance.now() - start) / iterations;
}

const provider = new DeterministicDocumentIntelligenceProvider();
const handle = DocumentHandle.create({
  contents: new ChangeSet().insert(
    'The quick brown fox jumps over the lazy dog.\n',
  ),
});

const requestMs = await timeMsAsync(() => {
  createIntelligenceRequest(handle, {
    instruction: 'shorten',
    operation: 'shorten',
    range: { start: 0, end: 40 },
    context: { maxLength: 20 },
  });
}, 400);

const extractMs = await timeMsAsync(() => {
  const req = createIntelligenceRequest(handle, {
    instruction: 'rewrite',
    operation: 'rewrite',
    range: { start: 4, end: 20 },
  });
  extractRequestContext(req);
}, 400);

const generateMs = await timeMsAsync(async () => {
  const req = createIntelligenceRequest(handle, {
    instruction: 'transform',
    operation: 'transform',
    range: { start: 0, end: 10 },
  });
  await provider.generate(req);
}, 200);

const validateMs = await timeMsAsync(async () => {
  const req = createIntelligenceRequest(handle, {
    instruction: 'replace:X',
    operation: 'replace',
    range: { start: 4, end: 9 },
    context: { replacement: 'fast' },
  });
  const p = await provider.generate(req);
  handle.inspectProposal(p);
  handle.validateProposal(p);
}, 150);

const h2 = DocumentHandle.create({
  contents: new ChangeSet().insert('abcdefghijklmnopqrstuvwxyz\n'),
});
const rebaseMs = await timeMsAsync(async () => {
  const req = createIntelligenceRequest(h2, {
    instruction: 'shorten',
    operation: 'shorten',
    range: { start: 0, end: 26 },
    context: { maxLength: 10 },
  });
  const p = await provider.generate(req);
  h2.apply(new ChangeSet().retain(0).insert('Z'), { validate: false });
  h2.rebaseProposal(p);
  // reset by creating ephemeral — actually h2 grows; use throwaway handle
}, 1);

// cleaner rebase bench
const rebaseCleanMs = await timeMsAsync(async () => {
  const h = DocumentHandle.create({
    contents: new ChangeSet().insert('abcdefghijklmnopqrstuvwxyz\n'),
  });
  const p = await provider.generate(
    createIntelligenceRequest(h, {
      instruction: 'shorten',
      operation: 'shorten',
      range: { start: 0, end: 26 },
      context: { maxLength: 10 },
    }),
  );
  h.apply(new ChangeSet().retain(0).insert('Z'), { validate: false });
  h.rebaseProposal(p);
}, 80);

const acceptMs = await timeMsAsync(async () => {
  const h = DocumentHandle.create({
    contents: new ChangeSet().insert('The quick brown fox.\n'),
  });
  const p = await provider.generate(
    createIntelligenceRequest(h, {
      instruction: 'replace',
      operation: 'replace',
      range: { start: 4, end: 9 },
      context: { replacement: 'fast' },
    }),
  );
  h.acceptProposal(p);
}, 80);

const policyMs = await timeMsAsync(async () => {
  const h = DocumentHandle.create({
    contents: new ChangeSet().insert('The quick brown fox.\n'),
  });
  const p = await provider.generate(
    createIntelligenceRequest(h, {
      instruction: 'replace',
      operation: 'replace',
      range: { start: 4, end: 9 },
      context: { replacement: 'fast' },
    }),
  );
  readProposalProvenance(p);
  evaluateProposalAcceptancePolicy({
    proposal: p,
    context: { headVersionId: h.currentVersion().id },
  });
}, 150);

const reviewMs = await timeMsAsync(async () => {
  const h = DocumentHandle.create({
    contents: new ChangeSet().insert('The quick brown fox.\n'),
  });
  const p = await provider.generate(
    createIntelligenceRequest(h, {
      instruction: 'transform',
      operation: 'transform',
      range: { start: 0, end: 10 },
    }),
  );
  createProposalReview({ handle: h, proposal: p });
}, 150);

const previewMs = await timeMsAsync(async () => {
  const h = DocumentHandle.create({
    contents: new ChangeSet().insert('The quick brown fox.\n'),
  });
  const p = await provider.generate(
    createIntelligenceRequest(h, {
      instruction: 'transform',
      operation: 'transform',
      range: { start: 0, end: 10 },
    }),
  );
  computePreviewContents(h, p);
}, 150);

const serializeMetaMs = await timeMsAsync(async () => {
  const h = DocumentHandle.create({
    contents: new ChangeSet().insert('The quick brown fox.\n'),
  });
  const p = await provider.generate(
    createIntelligenceRequest(h, {
      instruction: 'transform',
      operation: 'transform',
      range: { start: 0, end: 10 },
    }),
  );
  JSON.stringify(p.toJSON());
}, 150);

const results = {
  bench: 'lextrix-intelligence',
  requestConstructMs: Number(requestMs.toFixed(4)),
  contextExtractMs: Number(extractMs.toFixed(4)),
  deterministicGenerateMs: Number(generateMs.toFixed(4)),
  inspectValidateMs: Number(validateMs.toFixed(4)),
  rebaseMs: Number(rebaseCleanMs.toFixed(4)),
  acceptMs: Number(acceptMs.toFixed(4)),
  policyEvaluateMs: Number(policyMs.toFixed(4)),
  reviewCreateMs: Number(reviewMs.toFixed(4)),
  previewMs: Number(previewMs.toFixed(4)),
  serializeWithMetaMs: Number(serializeMetaMs.toFixed(4)),
};

void timeMs;
void rebaseMs;

console.log(JSON.stringify(results, null, 2));
console.log(
  `[intel] request=${results.requestConstructMs}ms extract=${results.contextExtractMs}ms generate=${results.deterministicGenerateMs}ms validate=${results.inspectValidateMs}ms rebase=${results.rebaseMs}ms accept=${results.acceptMs}ms policy=${results.policyEvaluateMs}ms review=${results.reviewCreateMs}ms preview=${results.previewMs}ms serializeMeta=${results.serializeWithMetaMs}ms`,
);
