/**
 * Experimental document reference — version-aware pointer to a range (Phase 4).
 * For future comments/citations. Not DOM / Blot / browser Range.
 */
import ChangeSet from '../change/change-set.js';
import { DocumentRange } from './range.js';
import type { DocumentVersion } from './version.js';

export interface CreateDocumentReferenceOptions {
  documentId: string;
  versionId: string;
  range: DocumentRange;
}

/**
 * Serializable reference to content as it existed at a Version.
 */
export class DocumentReference {
  readonly documentId: string;
  readonly versionId: string;
  readonly range: DocumentRange;

  constructor(init: {
    documentId: string;
    versionId: string;
    range: DocumentRange;
  }) {
    if (init.range.documentId !== init.documentId) {
      throw new Error('DocumentReference: range documentId mismatch');
    }
    if (init.range.versionId !== init.versionId) {
      throw new Error('DocumentReference: range versionId mismatch');
    }
    this.documentId = init.documentId;
    this.versionId = init.versionId;
    this.range = init.range;
  }

  mapThrough(change: ChangeSet, toVersion: DocumentVersion): DocumentReference {
    if (toVersion.documentId !== this.documentId) {
      throw new Error('DocumentReference.mapThrough: document mismatch');
    }
    const nextRange = this.range.mapThrough(change, toVersion);
    return new DocumentReference({
      documentId: this.documentId,
      versionId: toVersion.id,
      range: nextRange,
    });
  }

  toJSON(): {
    documentId: string;
    versionId: string;
    range: ReturnType<DocumentRange['toJSON']>;
  } {
    return {
      documentId: this.documentId,
      versionId: this.versionId,
      range: this.range.toJSON(),
    };
  }
}

export function createDocumentReference(
  options: CreateDocumentReferenceOptions,
): DocumentReference {
  return new DocumentReference(options);
}

/** Convenience: reference from a range (inherits ids). */
export function referenceFromRange(range: DocumentRange): DocumentReference {
  return createDocumentReference({
    documentId: range.documentId,
    versionId: range.versionId,
    range,
  });
}
