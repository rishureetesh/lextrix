/**
 * Phase 3 — DocumentAnchor mapThrough ChangeSet semantics (ADR-005).
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  createAnchor,
  DocumentHandle,
  diffVersions,
} from '../src/experimental/index.js';
import {
  generateChangeAgainstDocument,
  generateDocument,
} from '../src/testing/generators.js';
import { SeededRandom } from '../src/testing/seeded-random.js';

describe('DocumentAnchor', () => {
  it('createAnchor binds version + index', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const a = createAnchor(v0, 6, { affinity: 'before' });
    expect(a.versionId).toBe(v0.id);
    expect(a.index).toBe(6);
    expect(a.affinity).toBe('before');
  });

  it('rejects out-of-range index', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hi\n'),
    });
    expect(() => createAnchor(handle.currentVersion(), 99)).toThrow(/exceeds/);
  });

  it('identity ChangeSet keeps index', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abc\n'),
    });
    const v0 = handle.currentVersion();
    const a = createAnchor(v0, 2);
    const mapped = a.mapThrough(new ChangeSet(), v0);
    expect(mapped.index).toBe(2);
    expect(mapped.versionId).toBe(v0.id);
  });

  it('insertion before moves anchor forward', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const anchor = createAnchor(v0, 6); // before 'world'
    const change = new ChangeSet().retain(0).insert('XX');
    handle.apply(change);
    const v1 = handle.currentVersion();
    const mapped = anchor.mapThrough(change, v1);
    expect(mapped.index).toBe(8);
    expect(mapped.versionId).toBe(v1.id);
  });

  it('insertion after anchor does not move it', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const anchor = createAnchor(v0, 5);
    const change = new ChangeSet().retain(6).insert('Y');
    handle.apply(change);
    const v1 = handle.currentVersion();
    expect(anchor.mapThrough(change, v1).index).toBe(5);
  });

  it('affinity before vs after at insert point', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const before = createAnchor(v0, 6, { affinity: 'before' });
    const after = createAnchor(v0, 6, { affinity: 'after' });
    const change = new ChangeSet().retain(6).insert('beautiful ');
    handle.apply(change);
    const v1 = handle.currentVersion();
    expect(before.mapThrough(change, v1).index).toBe(6);
    expect(after.mapThrough(change, v1).index).toBe(16);
  });

  it('deletion before shrinks index', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const anchor = createAnchor(v0, 6);
    const change = new ChangeSet().retain(0).delete(2); // remove 'he'
    handle.apply(change);
    const v1 = handle.currentVersion();
    expect(anchor.mapThrough(change, v1).index).toBe(4);
  });

  it('deletion containing anchor collapses to deletion start', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const anchor = createAnchor(v0, 7); // inside 'world'
    const change = new ChangeSet().retain(6).delete(5); // delete 'world'
    handle.apply(change);
    const v1 = handle.currentVersion();
    expect(anchor.mapThrough(change, v1).index).toBe(6);
  });

  it('deletion after does not move anchor', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const anchor = createAnchor(v0, 2);
    const change = new ChangeSet().retain(6).delete(5);
    handle.apply(change);
    const v1 = handle.currentVersion();
    expect(anchor.mapThrough(change, v1).index).toBe(2);
  });

  it('formatting does not move anchor', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello\n'),
    });
    const v0 = handle.currentVersion();
    const anchor = createAnchor(v0, 3);
    const change = new ChangeSet().retain(0).retain(5, { bold: true });
    handle.apply(change);
    const v1 = handle.currentVersion();
    expect(anchor.mapThrough(change, v1).index).toBe(3);
  });

  it('handle.mapAnchor across non-adjacent versions via diff', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const anchor = handle.createAnchor(6, { affinity: 'after' });
    handle.apply(new ChangeSet().retain(6).insert('beautiful '));
    handle.apply(new ChangeSet().retain(0).insert('>>'));
    const v2 = handle.currentVersion();
    const mapped = handle.mapAnchor(anchor, v2);
    expect(mapped.versionId).toBe(v2.id);
    // insert at 6 (+10) then insert at 0 (+2) → 6+10+2 = 18
    expect(mapped.index).toBe(18);
  });

  it('sequential map equals map through composed change', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abcdef\n'),
    });
    const v0 = handle.currentVersion();
    const anchor = createAnchor(v0, 3, { affinity: 'after' });
    const a = new ChangeSet().retain(1).insert('X');
    handle.apply(a);
    const v1 = handle.currentVersion();
    const b = new ChangeSet().retain(0).insert('Y');
    handle.apply(b);
    const v2 = handle.currentVersion();

    const step = createAnchor(v0, 3, { affinity: 'after' })
      .mapThrough(a, v1)
      .mapThrough(b, v2);
    const composed = a.compose(b);
    const direct = createAnchor(v0, 3, { affinity: 'after' }).mapThrough(
      composed,
      v2,
    );
    expect(step.index).toBe(direct.index);
    void anchor;
  });

  it('fuzz: mapThrough(diff(A,B)) stays in bounds for B', () => {
    const rng = new SeededRandom(7);
    for (let i = 0; i < 150; i += 1) {
      const seed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(seed);
      const handle = DocumentHandle.create({
        contents: generateDocument(local),
        validate: false,
      });
      const v0 = handle.currentVersion();
      const len = v0.contents.length();
      const index = local.int(0, len);
      const affinity = local.bool() ? 'before' : 'after';
      const anchor = createAnchor(v0, index, { affinity });
      const change = generateChangeAgainstDocument(local, v0.contents);
      if (change.length() === 0) continue;
      handle.apply(change, { validate: false });
      const v1 = handle.currentVersion();
      const mapped = anchor.mapThrough(change, v1);
      expect(mapped.index, `seed=${seed}`).toBeGreaterThanOrEqual(0);
      expect(mapped.index, `seed=${seed}`).toBeLessThanOrEqual(
        v1.contents.length(),
      );
      expect(mapped.versionId).toBe(v1.id);
      // also via diff
      const viaDiff = anchor.mapThrough(diffVersions(v0, v1), v1);
      expect(viaDiff.index, `seed=${seed}`).toBe(mapped.index);
    }
  });
});
