/**
 * Phase 5B — changesBetween + rebaseProposal.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  createChangeProposal,
  DocumentHandle,
  RebaseError,
} from '../src/experimental/index.js';
import { documentsEqual } from '../src/testing/generators.js';

describe('changesBetween / rebaseProposal', () => {
  it('same-version rebase is a no-op (new object, same base)', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const v0 = handle.currentVersion();
    const p = handle.createProposal(new ChangeSet().retain(2).insert('!'));
    const p2 = handle.rebaseProposal(p, v0);
    expect(p2.baseVersionId).toBe(v0.id);
    expect(p2.change.ops).toEqual(p.change.ops);
    expect(p2).not.toBe(p);
    expect(p.baseVersionId).toBe(v0.id);
  });

  it('multi-step rebase matches sequential transforms', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello\n'),
    });
    const v0 = handle.currentVersion();
    handle.apply(new ChangeSet().retain(5).insert('!'));
    handle.apply(new ChangeSet().retain(0).insert('X'));
    handle.apply(new ChangeSet().retain(1).insert('Y'));
    const v3 = handle.currentVersion();

    const P = createChangeProposal({
      documentId: handle.documentId,
      baseVersionId: v0.id,
      change: new ChangeSet().retain(5).insert('?'),
      meta: { source: 'api', origin: 'system', intent: 'keep-meta' },
    });

    const steps = handle.changesBetween(v0, v3);
    expect(steps).toHaveLength(3);

    let expected = P.change.clone();
    for (const step of steps) {
      expected = step.transform(expected, true);
    }

    const rebased = handle.rebaseProposal(P, v3);
    expect(rebased.baseVersionId).toBe(v3.id);
    expect(rebased.meta.intent).toBe('keep-meta');
    expect(rebased.id).toBe(P.id);
    expect(rebased.change.ops).toEqual(expected.ops);
    expect(P.baseVersionId).toBe(v0.id);
  });

  it('rebase then accept; stale accept still fails without rebase', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('ab\n'),
    });
    const proposal = handle.createProposal(
      new ChangeSet().retain(2).insert('c'),
    );
    handle.apply(new ChangeSet().retain(0).insert('Z'));
    expect(() => handle.acceptProposal(proposal)).toThrow(/stale/);

    const rebased = handle.rebaseProposal(proposal, handle.currentVersion());
    const result = handle.acceptProposal(rebased);
    expect(result.empty).toBe(false);
  });

  it('wrong document rebase fails', () => {
    const a = DocumentHandle.create({
      contents: new ChangeSet().insert('a\n'),
    });
    const b = DocumentHandle.create({
      contents: new ChangeSet().insert('b\n'),
    });
    const p = a.createProposal(new ChangeSet().retain(1).insert('x'));
    expect(() => b.rebaseProposal(p)).toThrow(RebaseError);
  });

  it('unknown target fails', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('a\n'),
    });
    expect(() =>
      handle.changesBetween(handle.currentVersion(), 'missing'),
    ).toThrow();
  });

  it('OT convergence pair matches Quill contract', () => {
    const S = new ChangeSet().insert('hello\n');
    const A = new ChangeSet().retain(5).insert('!');
    const B = new ChangeSet().retain(0).insert('X');
    const left = S.compose(A).compose(A.transform(B, true));
    const right = S.compose(B).compose(B.transform(A, false));
    expect(documentsEqual(left, right)).toBe(true);
  });

  it('rebaseThenAccept helper', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const proposal = handle.createProposal(
      new ChangeSet().retain(2).insert('!'),
    );
    handle.apply(new ChangeSet().retain(0).insert('>'));
    const result = handle.rebaseThenAccept(proposal);
    expect(result.version.sequence).toBe(2);
  });

  it('rebase onto ancestor fails as unrelated', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('a\n'),
    });
    handle.apply(new ChangeSet().retain(1).insert('b'));
    handle.apply(new ChangeSet().retain(2).insert('c'));
    const tip = handle.currentVersion();
    const v0 = handle.getVersionBySequence(0);
    const p = createChangeProposal({
      documentId: handle.documentId,
      baseVersionId: tip.id,
      change: new ChangeSet().retain(3).insert('!'),
    });
    expect(() => handle.rebaseProposal(p, v0)).toThrow(RebaseError);
  });

  it('changesBetween same version is empty', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('a\n'),
    });
    const v = handle.currentVersion();
    expect(handle.changesBetween(v, v)).toEqual([]);
  });
});
