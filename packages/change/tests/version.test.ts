/**
 * Phase 3 — linear DocumentVersion invariants.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  createDocument,
  DocumentHandle,
  diffVersions,
} from '../src/experimental/index.js';
import {
  generateChangeAgainstDocument,
  generateDocument,
} from '../src/testing/generators.js';
import { SeededRandom } from '../src/testing/seeded-random.js';

function normalizeOps(ops: ChangeSet['ops']) {
  return ops.map((op) => {
    if (!op.attributes) return { ...op };
    const keys = Object.keys(op.attributes).sort();
    const attributes: Record<string, unknown> = {};
    for (const k of keys) attributes[k] = op.attributes[k];
    return { ...op, attributes };
  });
}

describe('DocumentVersion (linear)', () => {
  it('records immutable root and advances on apply', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello\n'),
    });
    const v0 = handle.currentVersion();
    expect(v0.sequence).toBe(0);
    expect(v0.contents.ops).toEqual([{ insert: 'hello\n' }]);

    handle.apply(new ChangeSet().retain(5).insert(' world'));
    const v1 = handle.currentVersion();
    expect(v1.sequence).toBe(1);
    expect(v1.parentId).toBe(v0.id);
    expect(v0.contents.ops).toEqual([{ insert: 'hello\n' }]); // immutable
    expect(v1.contents.ops).toEqual([{ insert: 'hello world\n' }]);
    expect(handle.getVersion(v0.id).contents.ops).toEqual([
      { insert: 'hello\n' },
    ]);
  });

  it('empty apply / empty transaction does not create a version', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('A\n'),
    });
    const before = handle.currentVersion().id;
    handle.apply(new ChangeSet());
    expect(handle.currentVersion().id).toBe(before);
    handle.commitTransaction(() => {
      /* empty */
    });
    expect(handle.currentVersion().id).toBe(before);
    expect(handle.listVersions()).toHaveLength(1);
  });

  it('multi-op transaction creates exactly one version step', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hello\n'),
    });
    expect(handle.listVersions()).toHaveLength(1);
    handle.commitTransaction((tx) => {
      tx.insert(5, '!');
      tx.format(0, 5, { bold: true });
      tx.delete(5, 1);
      tx.insert(5, '?');
    });
    expect(handle.listVersions()).toHaveLength(2);
    expect(handle.currentVersion().sequence).toBe(1);
  });

  it('diff(v, v) is empty; apply(diff(A,B), A) === B', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('ab\n'),
    });
    const v0 = handle.currentVersion();
    handle.apply(new ChangeSet().retain(2).insert('c'));
    handle.apply(new ChangeSet().retain(1).insert('X'));
    const v2 = handle.currentVersion();

    expect(diffVersions(v2, v2).length()).toBe(0);
    expect(handle.diffVersions(v0.id, v0.id).length()).toBe(0);

    const d = diffVersions(v0, v2);
    const reproduced = v0.contents.compose(d);
    expect(normalizeOps(reproduced.ops)).toEqual(
      normalizeOps(v2.contents.ops),
    );
  });

  it('rejects cross-document version diff', () => {
    const a = DocumentHandle.create({
      contents: new ChangeSet().insert('a\n'),
    });
    const b = DocumentHandle.create({
      contents: new ChangeSet().insert('b\n'),
    });
    expect(() =>
      diffVersions(a.currentVersion(), b.currentVersion()),
    ).toThrow(/mismatch/);
  });

  it('rejects unknown version ids', () => {
    const handle = DocumentHandle.create();
    expect(() => handle.getVersion('missing')).toThrow(/Unknown version/);
  });

  it('failed apply does not advance version', () => {
    const doc = createDocument({
      contents: new ChangeSet().insert('Z\n'),
      schema: {
        name: 'reject-next',
        validate: (contents) => {
          if (contents.ops.some((op) => String(op.insert).includes('X'))) {
            return { ok: false, issues: ['no X'] };
          }
          return { ok: true };
        },
      },
    });
    const handle = new DocumentHandle(doc);
    const vBefore = handle.currentVersion();
    expect(() =>
      handle.apply(new ChangeSet().retain(1).insert('X')),
    ).toThrow(/invalid document/);
    expect(handle.currentVersion().id).toBe(vBefore.id);
    expect(handle.listVersions()).toHaveLength(1);
    expect(handle.getContents().ops).toEqual([{ insert: 'Z\n' }]);
  });

  it('fuzz: random version chain — diff apply reproduces', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 100; i += 1) {
      const seed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(seed);
      const handle = DocumentHandle.create({
        contents: generateDocument(local),
        validate: false,
      });
      const v0 = handle.currentVersion();
      for (let step = 0; step < 4; step += 1) {
        const change = generateChangeAgainstDocument(
          local,
          handle.getContents(),
        );
        if (change.length() === 0) continue;
        try {
          handle.apply(change, { validate: false });
        } catch (err) {
          throw new Error(`seed=${seed} step=${step} ${String(err)}`);
        }
      }
      const vN = handle.currentVersion();
      const d = diffVersions(v0, vN);
      const reproduced = v0.contents.compose(d);
      expect(
        normalizeOps(reproduced.ops),
        `seed=${seed}`,
      ).toEqual(normalizeOps(vN.contents.ops));
    }
  });
});
