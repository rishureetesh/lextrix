/**
 * Experimental linear document versions (Phase 3).
 * Version = immutable identity of a DocumentState — not a ChangeSet.
 */
import ChangeSet from '../change/change-set.js';
import type { ChangeMeta } from './change-meta.js';

let documentIdCounter = 0;

export function createDocumentId(): string {
  documentIdCounter += 1;
  return `doc_${Date.now().toString(36)}_${documentIdCounter.toString(36)}`;
}

export function createVersionId(documentId: string, sequence: number): string {
  return `${documentId}:v${sequence}`;
}

/**
 * Immutable snapshot of a DocumentState in a linear history.
 */
export class DocumentVersion {
  readonly id: string;
  readonly documentId: string;
  /** 0-based index in the linear chain for this document session. */
  readonly sequence: number;
  /** Document.revision at this snapshot. */
  readonly revision: number;
  /** Frozen insert-only document contents. */
  readonly contents: ChangeSet;
  readonly parentId: string | null;
  /** ChangeSet that produced this version from parent (null for root). */
  readonly changeFromParent: ChangeSet | null;
  readonly meta: ChangeMeta | null;

  constructor(init: {
    id: string;
    documentId: string;
    sequence: number;
    revision: number;
    contents: ChangeSet;
    parentId: string | null;
    changeFromParent: ChangeSet | null;
    meta: ChangeMeta | null;
  }) {
    this.id = init.id;
    this.documentId = init.documentId;
    this.sequence = init.sequence;
    this.revision = init.revision;
    this.contents = init.contents;
    this.parentId = init.parentId;
    this.changeFromParent = init.changeFromParent;
    this.meta = init.meta;
  }

  getContents(): ChangeSet {
    return this.contents;
  }

  /**
   * ADR-012 Version wire document (schemaVersion 1).
   * Self-contained snapshot (`contents`) plus lineage (`parentId`, `changeFromParent`).
   * Legacy alias: top-level `ops` mirrors `contents.ops` for one-schema migration.
   */
  toJSON(): {
    schemaVersion: 1;
    kind: 'version';
    id: string;
    documentId: string;
    sequence: number;
    revision: number;
    parentId: string | null;
    contents: { ops: ChangeSet['ops'] };
    changeFromParent: { ops: ChangeSet['ops'] } | null;
    /** @deprecated Prefer `contents.ops`. */
    ops: ChangeSet['ops'];
    meta: ChangeMeta | null;
  } {
    const contentsOps = this.contents.ops.map((op) => ({ ...op }));
    return {
      schemaVersion: 1,
      kind: 'version',
      id: this.id,
      documentId: this.documentId,
      sequence: this.sequence,
      revision: this.revision,
      parentId: this.parentId,
      contents: { ops: contentsOps },
      changeFromParent:
        this.changeFromParent == null
          ? null
          : { ops: this.changeFromParent.ops.map((op) => ({ ...op })) },
      ops: contentsOps,
      meta: this.meta == null ? null : { ...this.meta },
    };
  }
}

export function assertSameDocument(
  a: DocumentVersion,
  b: DocumentVersion,
): void {
  if (a.documentId !== b.documentId) {
    throw new Error(
      `Version document mismatch: ${a.documentId} vs ${b.documentId}`,
    );
  }
}

/**
 * ChangeSet that transforms versionA contents into versionB contents.
 * Reuses ChangeSet.diff. Same-version → empty ChangeSet.
 */
export function diffVersions(
  versionA: DocumentVersion,
  versionB: DocumentVersion,
): ChangeSet {
  assertSameDocument(versionA, versionB);
  if (versionA.id === versionB.id) {
    return new ChangeSet();
  }
  return versionA.contents.diff(versionB.contents);
}
