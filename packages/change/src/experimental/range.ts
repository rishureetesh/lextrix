/**
 * Experimental document ranges — half-open [start, end) of DocumentAnchors (Phase 4).
 * Maps through ChangeSets by mapping endpoints (ADR-005). Not DOM Ranges.
 */
import ChangeSet from '../change/change-set.js';
import {
  createAnchor,
  DocumentAnchor,
  type AnchorAffinity,
  type CreateAnchorOptions,
} from './anchor.js';
import type { DocumentVersion } from './version.js';

export interface CreateRangeOptions {
  startAffinity?: AnchorAffinity;
  endAffinity?: AnchorAffinity;
}

/**
 * Version-bound half-open range [start, end).
 *
 * Defaults (inclusive typing at boundaries):
 * - startAffinity: `before` — insert at start stays at start (content enters range)
 * - endAffinity: `after` — insert at end moves end (content enters range)
 *
 * Collapse: after mapping, if startIndex > endIndex, both snap to startIndex
 * (empty range at the collapse point). Empty ranges (start === end) are valid.
 */
export class DocumentRange {
  readonly start: DocumentAnchor;
  readonly end: DocumentAnchor;

  constructor(start: DocumentAnchor, end: DocumentAnchor) {
    if (start.documentId !== end.documentId) {
      throw new Error('DocumentRange: start/end documentId mismatch');
    }
    if (start.versionId !== end.versionId) {
      throw new Error('DocumentRange: start/end versionId mismatch');
    }
    this.start = start;
    this.end = end;
  }

  get documentId(): string {
    return this.start.documentId;
  }

  get versionId(): string {
    return this.start.versionId;
  }

  get startIndex(): number {
    return this.start.index;
  }

  get endIndex(): number {
    return this.end.index;
  }

  /** Length of [start, end); 0 if empty/collapsed. */
  get length(): number {
    return Math.max(0, this.endIndex - this.startIndex);
  }

  get isEmpty(): boolean {
    return this.startIndex === this.endIndex;
  }

  /**
   * Map both endpoints through `change` (same ChangeSet → toVersion).
   * Reuses DocumentAnchor.mapThrough — no second transform algorithm.
   */
  mapThrough(change: ChangeSet, toVersion: DocumentVersion): DocumentRange {
    let nextStart = this.start.mapThrough(change, toVersion);
    let nextEnd = this.end.mapThrough(change, toVersion);
    if (nextStart.index > nextEnd.index) {
      // Collapse to empty range at the mapped start (deletion covering range).
      nextEnd = new DocumentAnchor({
        documentId: nextEnd.documentId,
        versionId: nextEnd.versionId,
        index: nextStart.index,
        affinity: nextEnd.affinity,
      });
    }
    return new DocumentRange(nextStart, nextEnd);
  }

  toJSON(): {
    documentId: string;
    versionId: string;
    start: number;
    end: number;
    startAffinity: AnchorAffinity;
    endAffinity: AnchorAffinity;
  } {
    return {
      documentId: this.documentId,
      versionId: this.versionId,
      start: this.startIndex,
      end: this.endIndex,
      startAffinity: this.start.affinity,
      endAffinity: this.end.affinity,
    };
  }
}

/**
 * Create a half-open range [start, end) on `version`.
 * Throws if start > end or indices out of bounds.
 */
export function createRange(
  version: DocumentVersion,
  start: number,
  end: number,
  options: CreateRangeOptions = {},
): DocumentRange {
  if (start > end) {
    throw new Error(
      `createRange: start (${start}) must be <= end (${end}) for [start, end)`,
    );
  }
  const startOpts: CreateAnchorOptions = {
    affinity: options.startAffinity ?? 'before',
  };
  const endOpts: CreateAnchorOptions = {
    affinity: options.endAffinity ?? 'after',
  };
  return new DocumentRange(
    createAnchor(version, start, startOpts),
    createAnchor(version, end, endOpts),
  );
}
