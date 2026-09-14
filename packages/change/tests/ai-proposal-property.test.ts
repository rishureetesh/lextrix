/**
 * Phase 6A — rebase property for AI-origin proposals (deterministic).
 */
import { describe, expect, it } from 'vitest';
import { DocumentHandle } from '../src/experimental/index.js';
import {
  documentsEqual,
  generateChangeAgainstDocument,
  generateConcurrentPair,
  generateDocument,
} from '../src/testing/generators.js';
import { SeededRandom } from '../src/testing/seeded-random.js';

const N = 300;

describe('AI-origin proposal rebase property', () => {
  it('rebase+accept equals OT convergence for source:ai proposals', () => {
    const rng = new SeededRandom(20260917);
    for (let i = 0; i < N; i += 1) {
      const seed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(seed);
      const S = generateDocument(local);
      const [A, P] = generateConcurrentPair(local, S);
      if (A.length() === 0 || P.length() === 0) continue;

      const handle = DocumentHandle.create({ contents: S, validate: false });
      const proposal = handle.createProposal(P, {
        meta: {
          source: 'ai',
          intent: 'fuzz',
          explanation: `seed=${seed}`,
        },
      });
      handle.apply(A, {
        validate: false,
        meta: { source: 'user', origin: 'system' },
      });
      const rebased = handle.rebaseProposal(proposal);
      expect(rebased.meta.source).toBe('ai');
      handle.acceptProposal(rebased);

      const left = S.compose(A).compose(A.transform(P, true));
      expect(
        documentsEqual(handle.getContents(), left),
        `FuzzFailure seed=${seed} ai-rebase`,
      ).toBe(true);
    }
  });

  it('multi-step human chain then AI rebase', () => {
    const rng = new SeededRandom(20260918);
    for (let i = 0; i < 150; i += 1) {
      const seed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(seed);
      const handle = DocumentHandle.create({
        contents: generateDocument(local),
        validate: false,
      });
      const P = generateChangeAgainstDocument(local, handle.getContents());
      if (P.length() === 0) continue;
      const proposal = handle.createProposal(P, {
        meta: { source: 'ai', intent: 'multi' },
      });
      const v0 = handle.currentVersion();
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
        `FuzzFailure seed=${seed} ai-multi-rebase`,
      ).toBe(true);
    }
  });
});
