/**
 * In-memory reference DocumentPersistence — for tests/examples only.
 * NOT a durable store (ADR-018).
 */
import { DocumentVersion } from '../experimental/version.js';
import { PersistenceError } from './errors.js';
import type { DocumentPersistence } from './types.js';

function versionPayloadKey(v: DocumentVersion): string {
  return JSON.stringify({
    id: v.id,
    documentId: v.documentId,
    sequence: v.sequence,
    revision: v.revision,
    parentId: v.parentId,
    contents: v.contents.ops,
    changeFromParent: v.changeFromParent?.ops ?? null,
    meta: v.meta,
  });
}

export class InMemoryDocumentPersistence implements DocumentPersistence {
  private readonly byDoc = new Map<string, DocumentVersion[]>();
  private readonly byId = new Map<string, DocumentVersion>();

  appendVersion(version: DocumentVersion): void {
    const existing = this.byId.get(version.id);
    if (existing) {
      if (versionPayloadKey(existing) === versionPayloadKey(version)) {
        return; // idempotent
      }
      throw new PersistenceError(
        'persistence_conflict',
        `InMemoryDocumentPersistence: conflicting Version id ${version.id}`,
      );
    }
    const chain = this.byDoc.get(version.documentId) ?? [];
    if (chain.length === 0) {
      if (version.sequence !== 0 || version.parentId != null) {
        throw new PersistenceError(
          'invalid_argument',
          'InMemoryDocumentPersistence: first Version must be root (sequence 0)',
        );
      }
    } else {
      const parent = chain[chain.length - 1]!;
      if (version.parentId !== parent.id) {
        throw new PersistenceError(
          'invalid_argument',
          `InMemoryDocumentPersistence: expected parent ${parent.id}`,
        );
      }
      if (version.sequence !== parent.sequence + 1) {
        throw new PersistenceError(
          'invalid_argument',
          `InMemoryDocumentPersistence: expected sequence ${parent.sequence + 1}`,
        );
      }
    }
    const stored = new DocumentVersion({
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
    chain.push(stored);
    this.byDoc.set(version.documentId, chain);
    this.byId.set(stored.id, stored);
  }

  loadChain(
    documentId: string,
    headVersionId?: string,
  ): readonly DocumentVersion[] {
    const chain = this.byDoc.get(documentId) ?? [];
    if (headVersionId == null) {
      return Object.freeze([...chain]);
    }
    const idx = chain.findIndex((v) => v.id === headVersionId);
    if (idx < 0) {
      throw new PersistenceError(
        'not_found',
        `InMemoryDocumentPersistence: unknown head ${headVersionId}`,
      );
    }
    return Object.freeze(chain.slice(0, idx + 1));
  }

  /** Test helper: wipe all data. */
  clear(): void {
    this.byDoc.clear();
    this.byId.clear();
  }
}
