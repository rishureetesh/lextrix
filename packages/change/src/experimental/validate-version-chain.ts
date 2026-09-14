/**
 * Version chain validation for hydration (Phase 9 / ADR-018).
 */
import type ChangeSet from '../change/change-set.js';
import { DocumentError } from './document-error.js';
import type { DocumentVersion } from './version.js';

function opsEqual(a: ChangeSet, b: ChangeSet): boolean {
  return JSON.stringify(a.ops) === JSON.stringify(b.ops);
}

export interface ValidateVersionChainOptions {
  /**
   * When true (default), require parent.contents ∘ changeFromParent ≡ child.contents.
   * Set false only for trusted in-process chains (unsafe for untrusted persistence).
   */
  verifyComposeIntegrity?: boolean;
  /**
   * When true, allow a compacted hot window whose first Version has sequence ≠ 0
   * (snapshot checkpoint). Parent of the first Version may be archived.
   */
  compactedRoot?: boolean;
}

/**
 * Validate a linear Version chain for hydration. Fail closed.
 * Does not mutate inputs.
 */
export function validateVersionChain(
  versions: readonly DocumentVersion[],
  options: ValidateVersionChainOptions = {},
): void {
  const verifyCompose = options.verifyComposeIntegrity !== false;
  const compactedRoot = options.compactedRoot === true;

  if (versions.length === 0) {
    throw new DocumentError(
      'hydration_error',
      'validateVersionChain: empty chain',
    );
  }

  const seenIds = new Map<string, DocumentVersion>();
  const documentId = versions[0]!.documentId;
  const baseSequence = versions[0]!.sequence;

  for (let i = 0; i < versions.length; i += 1) {
    const v = versions[i]!;

    if (typeof v.documentId !== 'string' || v.documentId.length === 0) {
      throw new DocumentError(
        'lineage_error',
        `validateVersionChain: invalid documentId at ${i}`,
      );
    }
    if (v.documentId !== documentId) {
      throw new DocumentError(
        'lineage_error',
        `validateVersionChain: documentId mismatch at ${i}`,
      );
    }
    if (typeof v.id !== 'string' || v.id.length === 0) {
      throw new DocumentError(
        'lineage_error',
        `validateVersionChain: invalid version id at ${i}`,
      );
    }
    const expectedSeq = compactedRoot ? baseSequence + i : i;
    if (!Number.isInteger(v.sequence) || v.sequence !== expectedSeq) {
      throw new DocumentError(
        'lineage_error',
        `validateVersionChain: expected sequence ${expectedSeq}, got ${v.sequence}`,
      );
    }
    if (!Number.isInteger(v.revision) || v.revision < 0) {
      throw new DocumentError(
        'lineage_error',
        `validateVersionChain: invalid revision at ${i}`,
      );
    }

    const prior = seenIds.get(v.id);
    if (prior) {
      if (
        prior.sequence === v.sequence &&
        opsEqual(prior.contents, v.contents) &&
        prior.parentId === v.parentId
      ) {
        throw new DocumentError(
          'lineage_error',
          `validateVersionChain: duplicate version id ${v.id} in chain`,
        );
      }
      throw new DocumentError(
        'lineage_error',
        `validateVersionChain: conflicting duplicate version id ${v.id}`,
      );
    }
    seenIds.set(v.id, v);

    if (i === 0) {
      if (!compactedRoot) {
        if (v.parentId != null || v.changeFromParent != null) {
          throw new DocumentError(
            'lineage_error',
            'validateVersionChain: root must have null parentId and changeFromParent',
          );
        }
      }
      // Compacted root: parent may be archived; contents are authoritative.
      continue;
    }

    const parent = versions[i - 1]!;
    if (v.parentId !== parent.id) {
      throw new DocumentError(
        'lineage_error',
        `validateVersionChain: parentId mismatch at ${i}`,
      );
    }
    if (v.changeFromParent == null) {
      throw new DocumentError(
        'lineage_error',
        `validateVersionChain: missing changeFromParent at ${i}`,
      );
    }
    if (v.changeFromParent.length() === 0) {
      throw new DocumentError(
        'lineage_error',
        `validateVersionChain: empty changeFromParent at ${i}`,
      );
    }
    if (v.revision < parent.revision) {
      throw new DocumentError(
        'lineage_error',
        `validateVersionChain: revision decreased at ${i}`,
      );
    }

    if (verifyCompose) {
      const composed = parent.contents.compose(v.changeFromParent);
      if (!opsEqual(composed, v.contents)) {
        throw new DocumentError(
          'hydration_error',
          `validateVersionChain: compose integrity failed at sequence ${v.sequence}`,
        );
      }
    }
  }
}
