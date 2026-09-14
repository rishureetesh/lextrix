/**
 * Phase 12 — compaction seal → archive → purge.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import { DocumentHandle } from '../src/experimental/document-handle.js';
import {
  CompactionController,
  InMemoryAuthoritativePersistence,
  InMemorySnapshotPersistence,
  InMemoryVersionArchive,
  InMemoryDocumentLifecycle,
  createSnapshotFromVersion,
  verifySnapshot,
  PersistenceError,
} from '../src/persistence/index.js';

function seedVersions(extra: number) {
  const persist = new InMemoryAuthoritativePersistence();
  const handle = DocumentHandle.create({
    contents: new ChangeSet([{ insert: 'root\n' }]),
    documentId: 'doc_c',
  });
  let expected: string | null = null;
  let r = persist.compareAndAppend('doc_c', null, handle.currentVersion());
  expect(r.ok).toBe(true);
  if (r.ok) expected = r.version.id;
  for (let i = 0; i < extra; i += 1) {
    handle.apply(new ChangeSet([{ insert: `x${i}` }]));
    const v = handle.currentVersion();
    r = persist.compareAndAppend('doc_c', expected, v);
    expect(r.ok).toBe(true);
    if (r.ok) expected = r.version.id;
  }
  return { persist, handle };
}

describe('Phase 12 compaction', () => {
  it('seal → archive → purge ordering; no purge without snapshot', () => {
    const { persist } = seedVersions(5);
    const snapshots = new InMemorySnapshotPersistence();
    const archive = new InMemoryVersionArchive();
    const ctrl = new CompactionController({
      persistence: persist,
      snapshots,
      archive,
      removeHotBeforeSeal: (doc, before) =>
        persist.removeHotBeforeSequence(doc, before),
    });

    const sealed = persist.loadHead('doc_c')!;
    void ctrl.createSnapshotAt('doc_c', sealed);
    return ctrl.compactTo('doc_c', sealed.id, { purge: true }).then((status) => {
      expect(status.phase).toBe('purged');
      expect(archive.listArchived('doc_c').length).toBe(0);
      const hot = persist.loadChain('doc_c');
      expect(hot.length).toBe(1);
      expect(hot[0]!.id).toBe(sealed.id);
    });
  });

  it('corrupt snapshot prevents compaction', async () => {
    const { persist } = seedVersions(2);
    const snapshots = new InMemorySnapshotPersistence();
    const archive = new InMemoryVersionArchive();
    const head = persist.loadHead('doc_c')!;
    const snap = createSnapshotFromVersion(head);
    snap.integrity.contentHash = '00';
    expect(() => snapshots.createSnapshot(snap)).toThrow(PersistenceError);
    const ctrl = new CompactionController({
      persistence: persist,
      snapshots,
      archive,
    });
    await expect(ctrl.compactTo('doc_c', head.id)).rejects.toThrow();
  });

  it('compactTo requires snapshot first', async () => {
    const { persist } = seedVersions(1);
    const snapshots = new InMemorySnapshotPersistence();
    const archive = new InMemoryVersionArchive();
    const ctrl = new CompactionController({
      persistence: persist,
      snapshots,
      archive,
    });
    const head = persist.loadHead('doc_c')!;
    await expect(ctrl.compactTo('doc_c', head.id)).rejects.toThrow(
      /snapshot required/,
    );
  });

  it('restore from archived Version via DocumentHandle', async () => {
    const { persist } = seedVersions(3);
    const snapshots = new InMemorySnapshotPersistence();
    const archive = new InMemoryVersionArchive();
    const early = persist.loadChain('doc_c')[1]!;
    const sealed = persist.loadHead('doc_c')!;
    await snapshots.createSnapshot(createSnapshotFromVersion(sealed));
    verifySnapshot(snapshots.getSnapshot('doc_c', sealed.id)!, sealed);
    const ctrl = new CompactionController({
      persistence: persist,
      snapshots,
      archive,
      removeHotBeforeSeal: (doc, before) =>
        persist.removeHotBeforeSequence(doc, before),
    });
    await ctrl.compactTo('doc_c', sealed.id, { purge: false });
    const archived = archive.loadArchivedVersion('doc_c', early.id);
    expect(archived).toBeTruthy();
    const hot = persist.loadChain('doc_c');
    const live = DocumentHandle.fromVersions(hot, { compactedRoot: true });
    live.restoreVersion(archived!);
    expect(JSON.stringify(live.document.contents.ops)).toBe(
      JSON.stringify(early.contents.ops),
    );
  });

  it('lifecycle tombstone transitions', () => {
    const life = new InMemoryDocumentLifecycle();
    life.tombstone('d1');
    expect(life.getState('d1')).toBe('tombstoned');
    expect(() => life.purge('d1')).toThrow();
    life.archive('d1');
    life.purge('d1');
    expect(life.getState('d1')).toBe('purged');
  });

  it('purged version is unavailable', async () => {
    const { persist } = seedVersions(3);
    const snapshots = new InMemorySnapshotPersistence();
    const archive = new InMemoryVersionArchive();
    const early = persist.loadChain('doc_c')[0]!;
    const sealed = persist.loadHead('doc_c')!;
    await snapshots.createSnapshot(createSnapshotFromVersion(sealed));
    const ctrl = new CompactionController({
      persistence: persist,
      snapshots,
      archive,
      removeHotBeforeSeal: (d, b) => persist.removeHotBeforeSequence(d, b),
    });
    await ctrl.compactTo('doc_c', sealed.id, { purge: true });
    expect(archive.loadArchivedVersion('doc_c', early.id)).toBeNull();
    expect(persist.loadVersion('doc_c', early.id)).toBeNull();
  });
});
