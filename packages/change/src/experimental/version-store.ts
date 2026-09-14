/**
 * Linear version store — full document snapshots per version (Phase 3).
 */
import ChangeSet from '../change/change-set.js';
import type { ChangeMeta } from './change-meta.js';
import {
  createVersionId,
  DocumentVersion,
  diffVersions,
} from './version.js';

export class LinearVersionStore {
  private readonly documentId: string;
  private readonly versions: DocumentVersion[] = [];
  private readonly byId = new Map<string, DocumentVersion>();

  constructor(documentId: string) {
    this.documentId = documentId;
  }

  get size(): number {
    return this.versions.length;
  }

  getDocumentId(): string {
    return this.documentId;
  }

  /** Root version (sequence 0). */
  recordRoot(
    contents: ChangeSet,
    revision: number,
  ): DocumentVersion {
    if (this.versions.length > 0) {
      throw new Error('LinearVersionStore: root already recorded');
    }
    const version = new DocumentVersion({
      id: createVersionId(this.documentId, 0),
      documentId: this.documentId,
      sequence: 0,
      revision,
      contents: contents.clone().freeze(),
      parentId: null,
      changeFromParent: null,
      meta: null,
    });
    this.push(version);
    return version;
  }

  /**
   * Append a child version. Caller must pass frozen/cloned contents.
   * Returns the new version, or null if change is empty (no-op).
   */
  recordApply(
    contents: ChangeSet,
    revision: number,
    changeFromParent: ChangeSet,
    meta: ChangeMeta | null,
  ): DocumentVersion | null {
    if (changeFromParent.length() === 0) {
      return null;
    }
    const parent = this.current();
    const sequence = parent.sequence + 1;
    const version = new DocumentVersion({
      id: createVersionId(this.documentId, sequence),
      documentId: this.documentId,
      sequence,
      revision,
      contents: contents.clone().freeze(),
      parentId: parent.id,
      changeFromParent: changeFromParent.clone().freeze(),
      meta,
    });
    this.push(version);
    return version;
  }

  current(): DocumentVersion {
    const last = this.versions[this.versions.length - 1];
    if (!last) {
      throw new Error('LinearVersionStore: empty');
    }
    return last;
  }

  getById(id: string): DocumentVersion {
    const v = this.byId.get(id);
    if (!v) {
      throw new Error(`Unknown version id: ${id}`);
    }
    return v;
  }

  getBySequence(sequence: number): DocumentVersion {
    const v = this.versions.find((x) => x.sequence === sequence);
    if (!v) {
      throw new Error(`Unknown version sequence: ${sequence}`);
    }
    return v;
  }

  list(): readonly DocumentVersion[] {
    return Object.freeze([...this.versions]);
  }

  diff(versionA: DocumentVersion, versionB: DocumentVersion): ChangeSet {
    this.assertOwned(versionA);
    this.assertOwned(versionB);
    return diffVersions(versionA, versionB);
  }

  private assertOwned(version: DocumentVersion): void {
    if (version.documentId !== this.documentId) {
      throw new Error(
        `Version ${version.id} does not belong to document ${this.documentId}`,
      );
    }
    if (!this.byId.has(version.id)) {
      throw new Error(`Stale or foreign version id: ${version.id}`);
    }
  }

  private push(version: DocumentVersion): void {
    this.versions.push(version);
    this.byId.set(version.id, version);
  }

  /**
   * Rebuild a store from a validated linear chain.
   * Prefer {@link validateVersionChain} before calling; set skipValidation when
   * validation already ran (DocumentHandle.fromVersions).
   */
  static hydrate(
    versions: readonly DocumentVersion[],
    options: { skipValidation?: boolean } = {},
  ): LinearVersionStore {
    if (!options.skipValidation) {
      // Lazy import avoided — callers should validate; keep structural checks.
      if (versions.length === 0) {
        throw new Error('LinearVersionStore.hydrate: empty chain');
      }
    }
    if (versions.length === 0) {
      throw new Error('LinearVersionStore.hydrate: empty chain');
    }
    const documentId = versions[0]!.documentId;
    const store = new LinearVersionStore(documentId);
    for (let i = 0; i < versions.length; i += 1) {
      const v = versions[i]!;
      if (!options.skipValidation) {
        if (v.documentId !== documentId) {
          throw new Error(
            `LinearVersionStore.hydrate: documentId mismatch at ${i}`,
          );
        }
        if (v.sequence !== i) {
          throw new Error(
            `LinearVersionStore.hydrate: expected sequence ${i}, got ${v.sequence}`,
          );
        }
        if (i === 0) {
          if (v.parentId != null || v.changeFromParent != null) {
            throw new Error(
              'LinearVersionStore.hydrate: root must have null parent',
            );
          }
        } else {
          const parent = versions[i - 1]!;
          if (v.parentId !== parent.id) {
            throw new Error(
              `LinearVersionStore.hydrate: parentId mismatch at ${i}`,
            );
          }
          if (v.changeFromParent == null) {
            throw new Error(
              `LinearVersionStore.hydrate: missing changeFromParent at ${i}`,
            );
          }
        }
      }
      store.push(
        new DocumentVersion({
          id: v.id,
          documentId: v.documentId,
          sequence: v.sequence,
          revision: v.revision,
          contents: v.contents.clone().freeze(),
          parentId: v.parentId,
          changeFromParent:
            v.changeFromParent == null
              ? null
              : v.changeFromParent.clone().freeze(),
          meta: v.meta == null ? null : { ...v.meta },
        }),
      );
    }
    return store;
  }
}
