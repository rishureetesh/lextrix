/**
 * Phase 4 — DocumentRange [start, end) mapping via endpoint anchors.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  createAnchor,
  createRange,
  DocumentHandle,
} from '../src/experimental/index.js';
import {
  generateChangeAgainstDocument,
  generateDocument,
} from '../src/testing/generators.js';
import { SeededRandom } from '../src/testing/seeded-random.js';

describe('DocumentRange', () => {
  it('creates half-open [start, end) with default affinities', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const range = createRange(handle.currentVersion(), 0, 5);
    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(5);
    expect(range.length).toBe(5);
    expect(range.start.affinity).toBe('before');
    expect(range.end.affinity).toBe('after');
    expect(range.isEmpty).toBe(false);
  });

  it('allows empty ranges; rejects start > end', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abc\n'),
    });
    const empty = createRange(handle.currentVersion(), 2, 2);
    expect(empty.isEmpty).toBe(true);
    expect(() => createRange(handle.currentVersion(), 3, 1)).toThrow(
      /start.*end/,
    );
  });

  it('mapThrough matches independent endpoint mapping', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const range = createRange(v0, 6, 11);
    const change = new ChangeSet().retain(0).insert('XX');
    handle.apply(change);
    const v1 = handle.currentVersion();
    const mapped = range.mapThrough(change, v1);
    const start = createAnchor(v0, 6, { affinity: 'before' }).mapThrough(
      change,
      v1,
    );
    const end = createAnchor(v0, 11, { affinity: 'after' }).mapThrough(
      change,
      v1,
    );
    expect(mapped.startIndex).toBe(start.index);
    expect(mapped.endIndex).toBe(end.index);
    expect(mapped.versionId).toBe(v1.id);
  });

  it('insertion before range shifts both endpoints', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const range = createRange(v0, 6, 11);
    const change = new ChangeSet().retain(0).insert('YY');
    handle.apply(change);
    const mapped = range.mapThrough(change, handle.currentVersion());
    expect(mapped.startIndex).toBe(8);
    expect(mapped.endIndex).toBe(13);
  });

  it('insertion inside range expands end', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const range = createRange(v0, 6, 11);
    const change = new ChangeSet().retain(8).insert('XX');
    handle.apply(change);
    const mapped = range.mapThrough(change, handle.currentVersion());
    expect(mapped.startIndex).toBe(6);
    expect(mapped.endIndex).toBe(13);
  });

  it('insertion at start with before affinity keeps start (content enters range)', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const range = createRange(v0, 6, 11); // start before
    const change = new ChangeSet().retain(6).insert('beautiful ');
    handle.apply(change);
    const mapped = range.mapThrough(change, handle.currentVersion());
    expect(mapped.startIndex).toBe(6);
    expect(mapped.endIndex).toBe(21);
  });

  it('deletion covering entire range collapses to empty', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const range = createRange(v0, 6, 11);
    const change = new ChangeSet().retain(6).delete(5);
    handle.apply(change);
    const mapped = range.mapThrough(change, handle.currentVersion());
    expect(mapped.isEmpty).toBe(true);
    expect(mapped.startIndex).toBe(mapped.endIndex);
  });

  it('deletion before range shrinks indices', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const v0 = handle.currentVersion();
    const range = createRange(v0, 6, 11);
    const change = new ChangeSet().retain(0).delete(2);
    handle.apply(change);
    const mapped = range.mapThrough(change, handle.currentVersion());
    expect(mapped.startIndex).toBe(4);
    expect(mapped.endIndex).toBe(9);
  });

  it('formatting does not move range', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello\n'),
    });
    const v0 = handle.currentVersion();
    const range = createRange(v0, 0, 5);
    const change = new ChangeSet().retain(5, { bold: true });
    handle.apply(change);
    const mapped = range.mapThrough(change, handle.currentVersion());
    expect(mapped.startIndex).toBe(0);
    expect(mapped.endIndex).toBe(5);
  });

  it('handle.mapRange across versions', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const range = handle.createRange(6, 11);
    handle.apply(new ChangeSet().retain(6).insert('x'));
    handle.apply(new ChangeSet().retain(0).insert('>'));
    const mapped = handle.mapRange(range, handle.currentVersion());
    expect(mapped.versionId).toBe(handle.currentVersion().id);
    expect(mapped.startIndex).toBeLessThanOrEqual(mapped.endIndex);
  });

  it('fuzz: mapped range endpoints stay ordered and in bounds', () => {
    const rng = new SeededRandom(11);
    for (let i = 0; i < 120; i += 1) {
      const seed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(seed);
      const handle = DocumentHandle.create({
        contents: generateDocument(local),
        validate: false,
      });
      const v0 = handle.currentVersion();
      const len = v0.contents.length();
      const a = local.int(0, len);
      const b = local.int(0, len);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      const range = createRange(v0, start, end);
      const change = generateChangeAgainstDocument(local, v0.contents);
      if (change.length() === 0) continue;
      handle.apply(change, { validate: false });
      const v1 = handle.currentVersion();
      const mapped = range.mapThrough(change, v1);
      expect(mapped.startIndex, `seed=${seed}`).toBeLessThanOrEqual(
        mapped.endIndex,
      );
      expect(mapped.startIndex, `seed=${seed}`).toBeGreaterThanOrEqual(0);
      expect(mapped.endIndex, `seed=${seed}`).toBeLessThanOrEqual(
        v1.contents.length(),
      );
    }
  });
});
