/**
 * Proposal rebase along a linear version chain (Phase 5B).
 * Uses sequential changeFromParent + ChangeSet.transform — not composed diff.
 *
 * Contract (Quill): A.transform(B, priority) → B′
 * When rebasing pending P through already-accepted C:
 *   P′ = C.transform(P, true)  // C has priority
 */
import ChangeSet from '../change/change-set.js';
import {
  ChangeProposal,
  createChangeProposal,
} from './proposal.js';
import type { DocumentVersion } from './version.js';
import type { LinearVersionStore } from './version-store.js';

export type RebaseErrorCode =
  | 'wrong_document'
  | 'unknown_version'
  | 'unrelated_versions'
  | 'corrupt_chain'
  | 'missing_change';

export class RebaseError extends Error {
  readonly code: RebaseErrorCode;

  constructor(code: RebaseErrorCode, message: string) {
    super(message);
    this.name = 'RebaseError';
    this.code = code;
  }
}

/**
 * Collect ChangeSets from base → target (exclusive of base, inclusive of
 * each step's changeFromParent) in chronological order.
 *
 * Example: v0 --A--> v1 --B--> v2 --C--> v3 with base=v0 target=v3
 * returns [A, B, C].
 */
export function changesBetween(
  store: LinearVersionStore,
  base: DocumentVersion | string,
  target: DocumentVersion | string,
): ChangeSet[] {
  const baseV =
    typeof base === 'string' ? store.getById(base) : base;
  const targetV =
    typeof target === 'string' ? store.getById(target) : target;

  if (baseV.documentId !== store.getDocumentId()) {
    throw new RebaseError(
      'wrong_document',
      `Base version ${baseV.id} is not owned by this document`,
    );
  }
  if (targetV.documentId !== store.getDocumentId()) {
    throw new RebaseError(
      'wrong_document',
      `Target version ${targetV.id} is not owned by this document`,
    );
  }
  if (baseV.documentId !== targetV.documentId) {
    throw new RebaseError(
      'wrong_document',
      `Version document mismatch: ${baseV.documentId} vs ${targetV.documentId}`,
    );
  }

  if (baseV.id === targetV.id) {
    return [];
  }

  // Walk target → … → base via parentId; collect steps then reverse.
  const reverseSteps: ChangeSet[] = [];
  let cursor: DocumentVersion | null = targetV;
  const seen = new Set<string>();

  while (cursor && cursor.id !== baseV.id) {
    if (seen.has(cursor.id)) {
      throw new RebaseError(
        'corrupt_chain',
        `Cycle detected while walking versions at ${cursor.id}`,
      );
    }
    seen.add(cursor.id);

    if (cursor.changeFromParent == null) {
      throw new RebaseError(
        'missing_change',
        `Version ${cursor.id} has no changeFromParent`,
      );
    }
    reverseSteps.push(cursor.changeFromParent);

    if (cursor.parentId == null) {
      throw new RebaseError(
        'unrelated_versions',
        `Target ${targetV.id} is not a descendant of base ${baseV.id}`,
      );
    }
    try {
      cursor = store.getById(cursor.parentId);
    } catch {
      throw new RebaseError(
        'corrupt_chain',
        `Missing parent ${cursor.parentId} of ${cursor.id}`,
      );
    }
  }

  if (!cursor || cursor.id !== baseV.id) {
    throw new RebaseError(
      'unrelated_versions',
      `Target ${targetV.id} is not a descendant of base ${baseV.id}`,
    );
  }

  return reverseSteps.reverse();
}

/**
 * Rebase a proposal onto `targetVersion` (must be a descendant of base).
 * Returns a **new** ChangeProposal; does not mutate the original.
 */
export function rebaseProposal(
  store: LinearVersionStore,
  proposal: ChangeProposal,
  targetVersion: DocumentVersion | string,
): ChangeProposal {
  if (proposal.documentId !== store.getDocumentId()) {
    throw new RebaseError(
      'wrong_document',
      `Proposal document ${proposal.documentId} ≠ store ${store.getDocumentId()}`,
    );
  }

  let base: DocumentVersion;
  try {
    base = store.getById(proposal.baseVersionId);
  } catch {
    throw new RebaseError(
      'unknown_version',
      `Unknown proposal base version: ${proposal.baseVersionId}`,
    );
  }

  const target =
    typeof targetVersion === 'string'
      ? store.getById(targetVersion)
      : targetVersion;

  if (target.documentId !== proposal.documentId) {
    throw new RebaseError(
      'wrong_document',
      `Target version document mismatch`,
    );
  }

  if (base.id === target.id) {
    // Same version — return equivalent new proposal (immutable no-op copy).
    return createChangeProposal({
      id: proposal.id,
      documentId: proposal.documentId,
      baseVersionId: proposal.baseVersionId,
      change: proposal.change.clone(),
      meta: { ...proposal.meta },
      createdAt: proposal.createdAt,
    });
  }

  const steps = changesBetween(store, base, target);
  let rebased: ChangeSet = proposal.change.clone();

  for (const accepted of steps) {
    // Accepted change has priority: C.transform(P, true) → P′
    rebased = accepted.transform(rebased, true);
  }

  return createChangeProposal({
    id: proposal.id,
    documentId: proposal.documentId,
    baseVersionId: target.id,
    change: rebased,
    meta: { ...proposal.meta },
    createdAt: proposal.createdAt,
  });
}
