/**
 * Property / fuzz tests for ChangeSet OT invariants (Phase 1).
 * Failures print the seed for reproduction: FuzzFailure seed=N
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  changeSetsEqual,
  documentsEqual,
  generateChangeAgainstDocument,
  generateConcurrentPair,
  generateDocument,
} from '../src/testing/generators.js';
import { SeededRandom } from '../src/testing/seeded-random.js';

const FUZZ_ITERATIONS = 2000;
const DEFAULT_SEED = 20260914;

function fuzzMessage(seed: number, label: string, detail?: string): string {
  return `FuzzFailure seed=${seed} case=${label}${detail ? ` ${detail}` : ''}`;
}

describe('ChangeSet property invariants', () => {
  it('compose is associative on random change triples (document-shaped base)', () => {
    const rng = new SeededRandom(DEFAULT_SEED);
    for (let i = 0; i < FUZZ_ITERATIONS; i += 1) {
      const caseSeed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(caseSeed);
      try {
        const doc = generateDocument(local);
        const a = generateChangeAgainstDocument(local, doc);
        const mid = doc.compose(a);
        const b = generateChangeAgainstDocument(local, mid);
        const mid2 = mid.compose(b);
        const c = generateChangeAgainstDocument(local, mid2);

        const left = a.compose(b).compose(c);
        const right = a.compose(b.compose(c));
        expect(changeSetsEqual(left, right), fuzzMessage(caseSeed, 'compose-assoc')).toBe(
          true,
        );
      } catch (err) {
        throw new Error(fuzzMessage(caseSeed, 'compose-assoc', String(err)));
      }
    }
  });

  it('invert round-trip: D.compose(A).compose(A.invert(D)) == D', () => {
    const rng = new SeededRandom(DEFAULT_SEED + 1);
    for (let i = 0; i < FUZZ_ITERATIONS; i += 1) {
      const caseSeed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(caseSeed);
      try {
        const doc = generateDocument(local);
        const change = generateChangeAgainstDocument(local, doc);
        const after = doc.compose(change);
        const inverted = change.invert(doc);
        const restored = after.compose(inverted);
        expect(
          documentsEqual(restored, doc),
          fuzzMessage(caseSeed, 'invert-roundtrip'),
        ).toBe(true);
      } catch (err) {
        throw new Error(fuzzMessage(caseSeed, 'invert-roundtrip', String(err)));
      }
    }
  });

  it('transform convergence (Quill priority): D∘A∘A.transform(B,true) == D∘B∘B.transform(A,false)', () => {
    const rng = new SeededRandom(DEFAULT_SEED + 2);
    for (let i = 0; i < FUZZ_ITERATIONS; i += 1) {
      const caseSeed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(caseSeed);
      try {
        const doc = generateDocument(local);
        const [a, b] = generateConcurrentPair(local, doc);
        const left = doc.compose(a).compose(a.transform(b, true));
        const right = doc.compose(b).compose(b.transform(a, false));
        expect(
          documentsEqual(left, right),
          fuzzMessage(caseSeed, 'transform-convergence'),
        ).toBe(true);
      } catch (err) {
        throw new Error(
          fuzzMessage(caseSeed, 'transform-convergence', String(err)),
        );
      }
    }
  });

  it('diff correctness: D1.compose(D1.diff(D2)) == D2', () => {
    const rng = new SeededRandom(DEFAULT_SEED + 3);
    for (let i = 0; i < FUZZ_ITERATIONS; i += 1) {
      const caseSeed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(caseSeed);
      try {
        const d1 = generateDocument(local);
        // Derive d2 by applying a change (guarantees compatible document pair)
        const change = generateChangeAgainstDocument(local, d1);
        const d2 = d1.compose(change);
        const diff = d1.diff(d2);
        const applied = d1.compose(diff);
        expect(documentsEqual(applied, d2), fuzzMessage(caseSeed, 'diff')).toBe(
          true,
        );
      } catch (err) {
        throw new Error(fuzzMessage(caseSeed, 'diff', String(err)));
      }
    }
  });

  it('reproduces a fixed seed path without throwing', () => {
    // Smoke: same seed always builds the same document text length class
    const a = generateDocument(new SeededRandom(42));
    const b = generateDocument(new SeededRandom(42));
    expect(documentsEqual(a, b)).toBe(true);
  });
});

describe('ChangeSet known unit OT cases', () => {
  it('documents compose insert then invert', () => {
    const doc = new ChangeSet().insert('Hi\n');
    const change = new ChangeSet().retain(2).insert('!');
    const after = doc.compose(change);
    expect(after.ops).toEqual([{ insert: 'Hi!\n' }]);
    const restored = after.compose(change.invert(doc));
    expect(documentsEqual(restored, doc)).toBe(true);
  });
});
