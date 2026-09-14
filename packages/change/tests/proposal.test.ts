/**
 * Phase 4 — ChangeProposal accept/reject / stale / atomicity.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  createChangeProposal,
  createDocument,
  DocumentHandle,
  ProposalError,
  referenceFromRange,
} from '../src/experimental/index.js';

describe('ChangeProposal', () => {
  it('createProposal binds document + base version + change', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const change = new ChangeSet().retain(2).insert('!');
    const proposal = handle.createProposal(change, {
      meta: { source: 'ai', intent: 'exclaim' },
    });
    expect(proposal.documentId).toBe(handle.documentId);
    expect(proposal.baseVersionId).toBe(handle.currentVersion().id);
    expect(proposal.change.ops).toEqual(change.ops);
    expect(proposal.meta.source).toBe('ai');
    expect(proposal.meta.intent).toBe('exclaim');
  });

  it('accept creates exactly one version; contents match compose', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const v0 = handle.currentVersion();
    const change = new ChangeSet().retain(2).insert('!');
    const proposal = handle.createProposal(change);
    expect(handle.listVersions()).toHaveLength(1);
    const result = handle.acceptProposal(proposal);
    expect(result.empty).toBe(false);
    expect(handle.listVersions()).toHaveLength(2);
    expect(result.version.sequence).toBe(1);
    expect(result.version.parentId).toBe(v0.id);
    expect(handle.getContents().ops).toEqual([{ insert: 'Hi!\n' }]);
    expect(v0.contents.ops).toEqual([{ insert: 'Hi\n' }]);
    const d = handle.diffVersions(v0, result.version);
    expect(v0.contents.compose(d).ops).toEqual(result.version.contents.ops);
  });

  it('reject creates no version', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('A\n'),
    });
    const proposal = handle.createProposal(
      new ChangeSet().retain(1).insert('x'),
    );
    const rejected = handle.rejectProposal(proposal);
    expect(rejected.rejected).toBe(true);
    expect(handle.listVersions()).toHaveLength(1);
    expect(handle.getContents().ops).toEqual([{ insert: 'A\n' }]);
  });

  it('stale proposal is rejected; state unchanged', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('A\n'),
    });
    const proposal = handle.createProposal(
      new ChangeSet().retain(1).insert('1'),
    );
    handle.apply(new ChangeSet().retain(1).insert('2'));
    const before = handle.currentVersion().id;
    const count = handle.listVersions().length;
    let caught: unknown;
    try {
      handle.acceptProposal(proposal);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProposalError);
    expect((caught as ProposalError).code).toBe('stale');
    expect(handle.currentVersion().id).toBe(before);
    expect(handle.listVersions()).toHaveLength(count);
  });

  it('wrong document proposal fails validation', () => {
    const a = DocumentHandle.create({
      contents: new ChangeSet().insert('a\n'),
    });
    const b = DocumentHandle.create({
      contents: new ChangeSet().insert('b\n'),
    });
    const proposal = createChangeProposal({
      documentId: a.documentId,
      baseVersionId: a.currentVersion().id,
      change: new ChangeSet().retain(1).insert('x'),
    });
    const v = b.validateProposal(proposal);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('wrong_document');
  });

  it('empty proposal accept is no-op (no new version)', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('A\n'),
    });
    const before = handle.currentVersion().id;
    const result = handle.acceptProposal(
      handle.createProposal(new ChangeSet()),
    );
    expect(result.empty).toBe(true);
    expect(handle.currentVersion().id).toBe(before);
  });

  it('failed accept (invalid change) creates no partial version', () => {
    const doc = createDocument({
      contents: new ChangeSet().insert('Z\n'),
      schema: {
        name: 'reject-x',
        validate: (contents) => {
          if (contents.ops.some((op) => String(op.insert).includes('X'))) {
            return { ok: false, issues: ['no X'] };
          }
          return { ok: true };
        },
      },
    });
    const h = new DocumentHandle(doc);
    const proposal = h.createProposal(new ChangeSet().retain(1).insert('X'));
    const before = h.currentVersion().id;
    expect(() => h.acceptProposal(proposal)).toThrow(ProposalError);
    expect(h.currentVersion().id).toBe(before);
    expect(h.listVersions()).toHaveLength(1);
  });

  it('sequential proposals advance versions; ranges map through', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const range = handle.createRange(6, 11);
    handle.acceptProposal(
      handle.createProposal(new ChangeSet().retain(6).insert('beautiful ')),
    );
    handle.acceptProposal(
      handle.createProposal(new ChangeSet().retain(0).insert('>>')),
    );
    const v2 = handle.currentVersion();
    expect(handle.listVersions()).toHaveLength(3);
    const mapped = handle.mapRange(range, v2);
    expect(mapped.versionId).toBe(v2.id);
    expect(mapped.startIndex).toBeLessThanOrEqual(mapped.endIndex);
  });

  it('restoreVersion creates a new version equal to old snapshot', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('v0\n'),
    });
    const v0 = handle.currentVersion();
    handle.apply(new ChangeSet().retain(2).insert('A'));
    handle.apply(new ChangeSet().retain(2).insert('B'));
    expect(handle.listVersions()).toHaveLength(3);
    const restored = handle.restoreVersion(v0);
    expect(restored.contents.ops).toEqual(v0.contents.ops);
    expect(handle.listVersions()).toHaveLength(4);
    expect(handle.getVersion(v0.id).contents.ops).toEqual([{ insert: 'v0\n' }]);
  });

  it('DocumentReference maps with its range', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const range = handle.createRange(0, 5);
    const ref = referenceFromRange(range);
    expect(ref.toJSON().range.start).toBe(0);
    // start affinity `before` → insert at 0 keeps start; end affinity `after` moves end
    handle.apply(new ChangeSet().retain(0).insert('>>'));
    const mapped = handle.mapReference(ref, handle.currentVersion());
    expect(mapped.range.startIndex).toBe(0);
    expect(mapped.range.endIndex).toBe(7);
    expect(mapped.versionId).toBe(handle.currentVersion().id);
  });
});
