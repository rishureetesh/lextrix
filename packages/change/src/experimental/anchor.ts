/**
 * Experimental document anchors — positions mapped through ChangeSets (Phase 3).
 * Not DOM Ranges / Blot offsets / editor selections.
 */
import ChangeSet from '../change/change-set.js';
import type { DocumentVersion } from './version.js';

/** Insert-at-point behavior (see ADR-005). */
export type AnchorAffinity = 'before' | 'after';

export interface CreateAnchorOptions {
  affinity?: AnchorAffinity;
}

/**
 * Logical document offset valid for a specific Version.
 */
export class DocumentAnchor {
  readonly documentId: string;
  readonly versionId: string;
  readonly index: number;
  readonly affinity: AnchorAffinity;

  constructor(init: {
    documentId: string;
    versionId: string;
    index: number;
    affinity: AnchorAffinity;
  }) {
    this.documentId = init.documentId;
    this.versionId = init.versionId;
    this.index = init.index;
    this.affinity = init.affinity;
  }

  /**
   * Map this anchor through a ChangeSet that transforms its version into `toVersion`.
   * Uses ChangeSet.transformPosition only — no DOM.
   */
  mapThrough(change: ChangeSet, toVersion: DocumentVersion): DocumentAnchor {
    if (toVersion.documentId !== this.documentId) {
      throw new Error(
        `Anchor mapThrough: document mismatch (${this.documentId} vs ${toVersion.documentId})`,
      );
    }
    const priority = this.affinity === 'before';
    let nextIndex = change.transformPosition(this.index, priority);
    const max = toVersion.contents.length();
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex > max) nextIndex = max;
    return new DocumentAnchor({
      documentId: this.documentId,
      versionId: toVersion.id,
      index: nextIndex,
      affinity: this.affinity,
    });
  }

  toJSON(): {
    documentId: string;
    versionId: string;
    index: number;
    affinity: AnchorAffinity;
  } {
    return {
      documentId: this.documentId,
      versionId: this.versionId,
      index: this.index,
      affinity: this.affinity,
    };
  }
}

/**
 * Create an anchor at `index` on `version`.
 * Index must be in [0, version.contents.length()].
 */
export function createAnchor(
  version: DocumentVersion,
  index: number,
  options: CreateAnchorOptions = {},
): DocumentAnchor {
  if (!Number.isFinite(index) || index < 0) {
    throw new Error(`createAnchor: invalid index ${index}`);
  }
  const max = version.contents.length();
  if (index > max) {
    throw new Error(
      `createAnchor: index ${index} exceeds document length ${max}`,
    );
  }
  return new DocumentAnchor({
    documentId: version.documentId,
    versionId: version.id,
    index,
    affinity: options.affinity ?? 'after',
  });
}
