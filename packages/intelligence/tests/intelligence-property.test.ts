import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/experimental';
import {
  createIntelligenceRequest,
  DeterministicDocumentIntelligenceProvider,
} from '../src/index.js';

/** Minimal seeded PRNG (avoid depending on change package internals). */
class SeededRandom {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  int(min: number, max: number): number {
    this.s = (Math.imul(1664525, this.s) + 1013904223) >>> 0;
    return min + (this.s % Math.max(1, max - min));
  }
}

function documentsEqual(a: ChangeSet, b: ChangeSet): boolean {
  return JSON.stringify(a.ops) === JSON.stringify(b.ops);
}

function generateDocument(rng: SeededRandom): ChangeSet {
  const n = rng.int(3, 12);
  let text = '';
  for (let i = 0; i < n; i += 1) {
    text += String.fromCharCode(97 + rng.int(0, 26));
  }
  return new ChangeSet().insert(`${text}\n`);
}

function generateChangeAgainstDocument(
  rng: SeededRandom,
  doc: ChangeSet,
): ChangeSet {
  const len = doc.length();
  if (len <= 1) return new ChangeSet().retain(len);
  const at = rng.int(0, len - 1);
  const cs = new ChangeSet();
  if (at > 0) cs.retain(at);
  cs.insert(String.fromCharCode(65 + rng.int(0, 26)));
  const rest = len - at;
  if (rest > 0) cs.retain(rest);
  return cs;
}

const N = 200;
const MULTI = 100;
const provider = new DeterministicDocumentIntelligenceProvider();

describe('intelligence proposal property fuzz', () => {
  it('deterministic transform proposal rebases like any ChangeSet', async () => {
    const rng = new SeededRandom(20260919);
    for (let i = 0; i < N; i += 1) {
      const seed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(seed);
      const S = generateDocument(local);
      const handle = DocumentHandle.create({ contents: S, validate: false });
      const len = handle.getContents().length();
      if (len < 2) continue;
      const start = local.int(0, Math.max(1, len - 1));
      const end = local.int(start, len);
      const request = createIntelligenceRequest(handle, {
        instruction: 'transform uppercase',
        operation: 'transform',
        range: { start, end },
      });
      const proposal = await provider.generate(request);
      const A = generateChangeAgainstDocument(local, handle.getContents());
      if (A.length() === 0 || proposal.change.length() === 0) continue;
      handle.apply(A, { validate: false });
      const rebased = handle.rebaseProposal(proposal);
      handle.acceptProposal(rebased);
      const left = S.compose(A).compose(A.transform(proposal.change, true));
      expect(
        documentsEqual(handle.getContents(), left),
        `FuzzFailure seed=${seed} intel-rebase`,
      ).toBe(true);
    }
  });

  it('multi-step accepted chain then deterministic rebase', async () => {
    const rng = new SeededRandom(20260920);
    for (let i = 0; i < MULTI; i += 1) {
      const seed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(seed);
      const handle = DocumentHandle.create({
        contents: generateDocument(local),
        validate: false,
      });
      const len = handle.getContents().length();
      if (len < 2) continue;
      const start = local.int(0, len - 1);
      const end = local.int(start, len);
      const proposal = await provider.generate(
        createIntelligenceRequest(handle, {
          instruction: 'transform',
          operation: 'transform',
          range: { start, end },
        }),
      );
      const v0 = handle.currentVersion();
      const P = proposal.change.clone();
      for (let s = 0; s < 3; s += 1) {
        const c = generateChangeAgainstDocument(local, handle.getContents());
        if (c.length() > 0) handle.apply(c, { validate: false });
      }
      if (handle.currentVersion().id === v0.id) continue;
      const tip = handle.currentVersion();
      const rebased = handle.rebaseProposal(proposal, tip);
      let expected = P.clone();
      for (const c of handle.changesBetween(v0, tip)) {
        expected = c.transform(expected, true);
      }
      expect(
        documentsEqual(
          tip.contents.compose(rebased.change),
          tip.contents.compose(expected),
        ),
        `FuzzFailure seed=${seed} intel-multi`,
      ).toBe(true);
    }
  });
});
