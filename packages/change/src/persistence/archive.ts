/**
 * Version archive port (ADR-031). Provider-neutral — not object-storage specific.
 */
import { DocumentVersion } from '../experimental/version.js';
import { PersistenceError } from './errors.js';

export type VersionRetentionState =
  | 'hot'
  | 'sealed'
  | 'archived'
  | 'purged';

export interface VersionArchive {
  archiveVersions(
    documentId: string,
    versions: readonly DocumentVersion[],
  ): Promise<void> | void;

  loadArchivedVersion(
    documentId: string,
    versionId: string,
  ): Promise<DocumentVersion | null> | DocumentVersion | null;

  /**
   * Physically remove archived Versions with sequence strictly less than
   * the sealed checkpoint Version's sequence. Fail closed if unsafe.
   */
  purgeArchivedVersions(
    documentId: string,
    beforeSequence: number,
  ): Promise<void> | void;

  listArchived?(
    documentId: string,
  ): Promise<readonly DocumentVersion[]> | readonly DocumentVersion[];
}

function cloneVersion(version: DocumentVersion): DocumentVersion {
  return new DocumentVersion({
    id: version.id,
    documentId: version.documentId,
    sequence: version.sequence,
    revision: version.revision,
    contents: version.contents.clone().freeze(),
    parentId: version.parentId,
    changeFromParent:
      version.changeFromParent == null
        ? null
        : version.changeFromParent.clone().freeze(),
    meta: version.meta == null ? null : { ...version.meta },
  });
}

export class InMemoryVersionArchive implements VersionArchive {
  private readonly byDoc = new Map<string, DocumentVersion[]>();
  private readonly byId = new Map<string, DocumentVersion>();

  archiveVersions(
    documentId: string,
    versions: readonly DocumentVersion[],
  ): void {
    for (const v of versions) {
      if (v.documentId !== documentId) {
        throw new PersistenceError(
          'invalid_argument',
          'archiveVersions: documentId mismatch',
        );
      }
      const stored = cloneVersion(v);
      this.byId.set(stored.id, stored);
      const list = this.byDoc.get(documentId) ?? [];
      if (!list.some((x) => x.id === stored.id)) {
        list.push(stored);
        list.sort((a, b) => a.sequence - b.sequence);
        this.byDoc.set(documentId, list);
      }
    }
  }

  loadArchivedVersion(
    documentId: string,
    versionId: string,
  ): DocumentVersion | null {
    const v = this.byId.get(versionId);
    if (!v || v.documentId !== documentId) return null;
    return v;
  }

  purgeArchivedVersions(documentId: string, beforeSequence: number): void {
    const list = this.byDoc.get(documentId) ?? [];
    const kept: DocumentVersion[] = [];
    for (const v of list) {
      if (v.sequence < beforeSequence) {
        this.byId.delete(v.id);
      } else {
        kept.push(v);
      }
    }
    this.byDoc.set(documentId, kept);
  }

  listArchived(documentId: string): readonly DocumentVersion[] {
    return Object.freeze([...(this.byDoc.get(documentId) ?? [])]);
  }

  clear(): void {
    this.byDoc.clear();
    this.byId.clear();
  }
}
