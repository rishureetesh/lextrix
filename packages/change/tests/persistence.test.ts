/**
 * Phase 9 — persistence port, idempotency, hydration integrity, durability.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import { DocumentError } from '../src/experimental/document-error.js';
import { DocumentHandle } from '../src/experimental/document-handle.js';
import { DocumentVersion } from '../src/experimental/version.js';
import {
  attachPersistence,
  InMemoryDocumentPersistence,
  PersistenceError,
  validateVersionChain,
} from '../src/persistence/index.js';

function buildChain(n: number): {
  handle: DocumentHandle;
  versions: readonly DocumentVersion[];
} {
  const handle = DocumentHandle.create({
    contents: new ChangeSet([{ insert: 'base\n' }]),
    validate: true,
  });
  for (let i = 0; i < n; i += 1) {
    handle.apply(new ChangeSet([{ insert: `v${i}` }]), { validate: true });
  }
  return { handle, versions: handle.listVersions() };
}

describe('Phase 9 persistence', () => {
  it('append Version and loadChain', () => {
    const { versions } = buildChain(2);
    const store = new InMemoryDocumentPersistence();
    for (const v of versions) store.appendVersion(v);
    const loaded = store.loadChain(versions[0]!.documentId);
    expect(loaded).toHaveLength(3);
    expect(loaded.map((v) => v.id)).toEqual(versions.map((v) => v.id));
  });

  it('append duplicate same Version is idempotent', () => {
    const { versions } = buildChain(1);
    const store = new InMemoryDocumentPersistence();
    store.appendVersion(versions[0]!);
    store.appendVersion(versions[0]!);
    store.appendVersion(versions[1]!);
    store.appendVersion(versions[1]!);
    expect(store.loadChain(versions[0]!.documentId)).toHaveLength(2);
  });

  it('conflicting duplicate Version id is rejected', () => {
    const { versions } = buildChain(1);
    const store = new InMemoryDocumentPersistence();
    store.appendVersion(versions[0]!);
    const conflict = new DocumentVersion({
      id: versions[0]!.id,
      documentId: versions[0]!.documentId,
      sequence: 0,
      revision: 99,
      contents: new ChangeSet([{ insert: 'other\n' }]).freeze(),
      parentId: null,
      changeFromParent: null,
      meta: null,
    });
    expect(() => store.appendVersion(conflict)).toThrow(PersistenceError);
    try {
      store.appendVersion(conflict);
    } catch (err) {
      expect(err).toBeInstanceOf(PersistenceError);
      expect((err as PersistenceError).code).toBe('persistence_conflict');
    }
  });

  it('empty chain load returns []', () => {
    const store = new InMemoryDocumentPersistence();
    expect(store.loadChain('missing')).toEqual([]);
  });

  it('loadChain with headVersionId truncates', () => {
    const { versions } = buildChain(3);
    const store = new InMemoryDocumentPersistence();
    for (const v of versions) store.appendVersion(v);
    const mid = versions[1]!;
    expect(store.loadChain(mid.documentId, mid.id)).toHaveLength(2);
  });
});

describe('Phase 9 hydration / compose integrity', () => {
  it('valid chain hydrates with compose integrity', () => {
    const { versions } = buildChain(5);
    validateVersionChain(versions);
    const h = DocumentHandle.fromVersions(versions);
    expect(h.currentVersion().id).toBe(versions[versions.length - 1]!.id);
    expect(h.getContents().ops).toEqual(
      versions[versions.length - 1]!.contents.ops,
    );
  });

  it('missing parent rejects', () => {
    const { versions } = buildChain(2);
    const broken = [
      versions[0]!,
      new DocumentVersion({
        ...versions[2]!,
        parentId: 'missing-parent',
        sequence: 1,
      }),
    ];
    expect(() => DocumentHandle.fromVersions(broken)).toThrow(DocumentError);
  });

  it('wrong documentId rejects', () => {
    const { versions } = buildChain(1);
    const broken = [
      versions[0]!,
      new DocumentVersion({
        id: versions[1]!.id,
        documentId: 'other-doc',
        sequence: 1,
        revision: versions[1]!.revision,
        contents: versions[1]!.contents,
        parentId: versions[0]!.id,
        changeFromParent: versions[1]!.changeFromParent,
        meta: null,
      }),
    ];
    expect(() => DocumentHandle.fromVersions(broken)).toThrow(DocumentError);
  });

  it('invalid lineage sequence rejects', () => {
    const { versions } = buildChain(1);
    const broken = [
      versions[0]!,
      new DocumentVersion({
        ...versions[1]!,
        sequence: 5,
      }),
    ];
    expect(() => validateVersionChain(broken)).toThrow(DocumentError);
  });

  it('compose integrity fails on corrupted contents', () => {
    const { versions } = buildChain(2);
    const corrupt = [
      versions[0]!,
      versions[1]!,
      new DocumentVersion({
        id: versions[2]!.id,
        documentId: versions[2]!.documentId,
        sequence: 2,
        revision: versions[2]!.revision,
        contents: new ChangeSet([{ insert: 'CORRUPT\n' }]).freeze(),
        parentId: versions[1]!.id,
        changeFromParent: versions[2]!.changeFromParent,
        meta: null,
      }),
    ];
    expect(() =>
      DocumentHandle.fromVersions(corrupt),
    ).toThrow(DocumentError);
    try {
      DocumentHandle.fromVersions(corrupt);
    } catch (err) {
      expect((err as DocumentError).code).toBe('hydration_error');
    }
  });

  it('malformed empty changeFromParent rejects', () => {
    const { versions } = buildChain(1);
    const broken = [
      versions[0]!,
      new DocumentVersion({
        id: versions[1]!.id,
        documentId: versions[1]!.documentId,
        sequence: 1,
        revision: versions[1]!.revision,
        contents: versions[1]!.contents,
        parentId: versions[0]!.id,
        changeFromParent: new ChangeSet().freeze(),
        meta: null,
      }),
    ];
    expect(() => validateVersionChain(broken)).toThrow(DocumentError);
  });

  it('verifyComposeIntegrity=false escape hatch skips compose check', () => {
    const { versions } = buildChain(1);
    const corrupt = [
      versions[0]!,
      new DocumentVersion({
        id: versions[1]!.id,
        documentId: versions[1]!.documentId,
        sequence: 1,
        revision: versions[1]!.revision,
        contents: new ChangeSet([{ insert: 'WRONG\n' }]).freeze(),
        parentId: versions[0]!.id,
        changeFromParent: versions[1]!.changeFromParent,
        meta: null,
      }),
    ];
    expect(() =>
      DocumentHandle.fromVersions(corrupt, { verifyComposeIntegrity: false, validate: false }),
    ).not.toThrow();
  });

  it('hydration round-trip via persistence', () => {
    const { handle, versions } = buildChain(4);
    const store = new InMemoryDocumentPersistence();
    for (const v of versions) store.appendVersion(v);
    const loaded = store.loadChain(handle.documentId);
    const hydrated = DocumentHandle.fromVersions(loaded);
    expect(hydrated.getContents().ops).toEqual(handle.getContents().ops);
    expect(hydrated.currentVersion().id).toBe(handle.currentVersion().id);
  });
});

describe('Phase 9 durability semantics', () => {
  it('apply → persist success advances durable head', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    const store = new InMemoryDocumentPersistence();
    store.appendVersion(handle.currentVersion());
    const attach = attachPersistence(handle, store);
    handle.apply(new ChangeSet([{ insert: 'b' }]));
    expect(attach.isDirty()).toBe(false);
    expect(attach.getDurableHead()?.id).toBe(handle.currentVersion().id);
    expect(store.loadChain(handle.documentId)).toHaveLength(2);
    attach.unsubscribe();
  });

  it('apply → persist failure leaves Handle advanced and dirty', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    const store = new InMemoryDocumentPersistence();
    store.appendVersion(handle.currentVersion());
    let failNext = false;
    const flaky: typeof store = {
      appendVersion(v) {
        if (failNext) {
          failNext = false;
          throw new PersistenceError('persistence_error', 'disk full');
        }
        return store.appendVersion(v);
      },
      loadChain: (id, head) => store.loadChain(id, head),
    };
    const lags: unknown[] = [];
    const attach = attachPersistence(handle, flaky, {
      initialDurableHead: handle.currentVersion(),
      onDurabilityLag: (info) => lags.push(info.error),
    });
    failNext = true;
    const before = handle.currentVersion().id;
    handle.apply(new ChangeSet([{ insert: 'x' }]));
    const after = handle.currentVersion().id;
    expect(after).not.toBe(before);
    expect(attach.isDirty()).toBe(true);
    expect(attach.getDirtyVersions()).toHaveLength(1);
    expect(lags.length).toBe(1);
    // durable head still previous
    expect(attach.getDurableHead()?.id).toBe(before);
    return attach.flush().then(() => {
      expect(attach.isDirty()).toBe(false);
      expect(store.loadChain(handle.documentId)).toHaveLength(2);
      attach.unsubscribe();
    });
  });

  it('persistence failure does not roll back and is not observer_failed', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    const store = new InMemoryDocumentPersistence();
    store.appendVersion(handle.currentVersion());
    const failing = {
      appendVersion() {
        throw new PersistenceError('persistence_error', 'fail');
      },
      loadChain: () => [],
    };
    const attach = attachPersistence(handle, failing);
    expect(() =>
      handle.apply(new ChangeSet([{ insert: 'z' }])),
    ).not.toThrow();
    expect(handle.currentVersion().sequence).toBe(1);
    expect(attach.isDirty()).toBe(true);
    attach.unsubscribe();
  });
});
