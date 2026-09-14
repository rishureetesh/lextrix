/**
 * Phase 5B — rebase property/fuzz tests.
 */
import { describe, expect, it } from 'vitest';
import {
  DocumentHandle,
} from '../src/experimental/index.js';
import {
  documentsEqual,
  generateChangeAgainstDocument,
  generateConcurrentPair,
  generateDocument,
} from '../src/testing/generators.js';
import { SeededRandom } from '../src/testing/seeded-random.js';

const N = 400;

describe('rebase property fuzz', () => {
  it('pairwise: rebase(P through A) matches OT convergence state', () => {
    const rng = new SeededRandom(20260915);
    for (let i = 0; i < N; i += 1) {
      const seed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(seed);
      const S = generateDocument(local);
      const [A, P] = generateConcurrentPair(local, S);
      if (A.length() === 0 || P.length() === 0) continue;

      const handle = DocumentHandle.create({ contents: S, validate: false });
      const proposal = handle.createProposal(P);
      handle.apply(A, { validate: false });
      const rebased = handle.rebaseProposal(proposal);

      const left = S.compose(A).compose(rebased.change);
      const right = S.compose(P).compose(P.transform(A, false));
      expect(
        documentsEqual(left, right),
        `FuzzFailure seed=${seed} rebase-pair`,
      ).toBe(true);
    }
  });

  it('multi-step rebase equals sequential transform', () => {
    const rng = new SeededRandom(20260916);
    for (let i = 0; i < 200; i += 1) {
      const seed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(seed);
      const handle = DocumentHandle.create({
        contents: generateDocument(local),
        validate: false,
      });
      const v0 = handle.currentVersion();
      const P = generateChangeAgainstDocument(local, handle.getContents());
      if (P.length() === 0) continue;
      const proposal = handle.createProposal(P);

      const stepsApplied: ReturnType<typeof generateChangeAgainstDocument>[] =
        [];
      for (let s = 0; s < 3; s += 1) {
        const c = generateChangeAgainstDocument(local, handle.getContents());
        if (c.length() === 0) continue;
        handle.apply(c, { validate: false });
        stepsApplied.push(c);
      }
      if (stepsApplied.length === 0) continue;

      const tip = handle.currentVersion();
      const viaApi = handle.rebaseProposal(proposal, tip);
      let expected = P.clone();
      for (const c of handle.changesBetween(v0, tip)) {
        expected = c.transform(expected, true);
      }
      expect(
        documentsEqual(
          tip.contents.compose(viaApi.change),
          tip.contents.compose(expected),
        ),
        `FuzzFailure seed=${seed} multi-rebase`,
      ).toBe(true);
    }
  });
});
