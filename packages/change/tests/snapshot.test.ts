/**
 * Phase 12 — snapshot identity, integrity, equivalence, policy.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import { DocumentHandle } from '../src/experimental/document-handle.js';
import {
  createSnapshotFromVersion,
  verifySnapshot,
  serializeDocumentSnapshot,
  parseDocumentSnapshot,
  InMemorySnapshotPersistence,
  shouldSnapshotAtSequence,
  defaultSnapshotPolicy,
  DEFAULT_SNAPSHOT_EVERY_N_VERSIONS,
  PersistenceError,
} from '../src/persistence/index.js';

describe('Phase 12 snapshots', () => {
  it('snapshot binds to existing Version and is not a HEAD', () => {
    const h = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'hello\n' }]),
    });
    h.apply(new ChangeSet([{ insert: 'A' }]));
    const v = h.currentVersion();
    const snap = createSnapshotFromVersion(v);
    expect(snap.versionId).toBe(v.id);
    expect(snap.documentId).toBe(v.documentId);
    expect(snap.snapshotId).not.toBe(v.id);
    expect(h.currentVersion().id).toBe(v.id);
  });

  it('integrity fails closed on corruption', () => {
    const h = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'x\n' }]),
    });
    const snap = createSnapshotFromVersion(h.currentVersion());
    const bad = {
      ...snap,
      integrity: { ...snap.integrity, contentHash: 'deadbeef' },
    };
    expect(() => verifySnapshot(bad)).toThrow(PersistenceError);
  });

  it('snapshot hydration equals Version state', () => {
    const h = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'eq\n' }]),
    });
    h.apply(new ChangeSet([{ insert: 'Z' }]));
    const v = h.currentVersion();
    const snap = createSnapshotFromVersion(v);
    verifySnapshot(snap, v);
    expect(JSON.stringify(snap.contents.ops)).toBe(
      JSON.stringify(v.contents.ops),
    );
  });

  it('wire round-trip', () => {
    const h = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'w\n' }]),
    });
    const snap = createSnapshotFromVersion(h.currentVersion());
    const again = parseDocumentSnapshot(serializeDocumentSnapshot(snap));
    expect(again.snapshotId).toBe(snap.snapshotId);
    expect(again.integrity.contentHash).toBe(snap.integrity.contentHash);
  });

  it('persistence + latest lookup', () => {
    const store = new InMemorySnapshotPersistence();
    const h = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'p\n' }]),
    });
    const v0 = h.currentVersion();
    h.apply(new ChangeSet([{ insert: '1' }]));
    const v1 = h.currentVersion();
    store.createSnapshot(createSnapshotFromVersion(v0));
    store.createSnapshot(createSnapshotFromVersion(v1));
    expect(store.getLatestSnapshot(h.documentId)!.versionId).toBe(v1.id);
  });

  it('default policy N=100 is configurable', () => {
    expect(DEFAULT_SNAPSHOT_EVERY_N_VERSIONS).toBe(100);
    expect(shouldSnapshotAtSequence(99, defaultSnapshotPolicy())).toBe(true);
    expect(shouldSnapshotAtSequence(98, defaultSnapshotPolicy())).toBe(false);
    expect(
      shouldSnapshotAtSequence(4, defaultSnapshotPolicy({ everyNVersions: 5 })),
    ).toBe(true);
  });

  it('concurrent writes do not change snapshot of fixed Version', () => {
    const h = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'c\n' }]),
    });
    const target = h.currentVersion();
    const snap = createSnapshotFromVersion(target);
    h.apply(new ChangeSet([{ insert: 'later' }]));
    h.apply(new ChangeSet([{ insert: 'more' }]));
    verifySnapshot(snap, target);
    expect(snap.versionId).toBe(target.id);
  });
});
