/**
 * Phase 5B — attribute + embed OT convergence cases.
 * Deterministic OT resolution ≠ semantic intent resolution.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import { documentsEqual } from '../src/testing/generators.js';

describe('OT attributes and embeds (Phase 5B)', () => {
  it('concurrent attribute priority is deterministic', () => {
    const S = new ChangeSet().insert('hi\n');
    const A = new ChangeSet().retain(2, { bold: true });
    const B = new ChangeSet().retain(2, { bold: false });
    const left = S.compose(A).compose(A.transform(B, true));
    const right = S.compose(B).compose(B.transform(A, false));
    expect(documentsEqual(left, right)).toBe(true);
  });

  it('format vs insert converges', () => {
    const S = new ChangeSet().insert('hello\n');
    const A = new ChangeSet().retain(5, { bold: true });
    const B = new ChangeSet().retain(2).insert('X');
    const left = S.compose(A).compose(A.transform(B, true));
    const right = S.compose(B).compose(B.transform(A, false));
    expect(documentsEqual(left, right)).toBe(true);
  });

  it('insert embed vs text converges', () => {
    const S = new ChangeSet().insert('ab\n');
    const A = new ChangeSet().retain(1).insert({ image: 'x.png' });
    const B = new ChangeSet().retain(1).insert('Z');
    const left = S.compose(A).compose(A.transform(B, true));
    const right = S.compose(B).compose(B.transform(A, false));
    expect(documentsEqual(left, right)).toBe(true);
  });

  it('delete around embed converges', () => {
    const S = new ChangeSet().insert('a').insert({ image: 'x.png' }).insert('b\n');
    const A = new ChangeSet().retain(1).delete(1); // delete embed
    const B = new ChangeSet().retain(0).insert('X');
    const left = S.compose(A).compose(A.transform(B, true));
    const right = S.compose(B).compose(B.transform(A, false));
    expect(documentsEqual(left, right)).toBe(true);
  });

  it('three-way insert convergence via pairwise OT', () => {
    const S = new ChangeSet().insert('x\n');
    const A = new ChangeSet().retain(0).insert('1');
    const B = new ChangeSet().retain(0).insert('2');
    const C = new ChangeSet().retain(0).insert('3');
    // Apply A, then B', then C'' with consistent priority A > B > C
    const B1 = A.transform(B, true);
    const C1 = A.transform(C, true);
    const C2 = B1.transform(C1, true);
    const left = S.compose(A).compose(B1).compose(C2);

    const A1 = B.transform(A, false);
    const C1b = B.transform(C, true);
    const C2b = A1.transform(C1b, true);
    const mid = S.compose(B).compose(A1).compose(C2b);

    expect(documentsEqual(left, mid)).toBe(true);
  });
});
