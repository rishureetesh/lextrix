/**
 * Authoritative persistence port (ADR-021 / ADR-023 / ADR-025).
 * Extends Phase-9 DocumentPersistence concepts without weakening appendVersion.
 */
import type { DocumentVersion } from '../experimental/version.js';

export type CompareAndAppendOptions = {
  /** Fencing token — must match durable document_heads.owner_epoch when set. */
  ownerEpoch?: number;
  /** Durable idempotency key for (documentId, changeId). */
  changeId?: string;
};

export type CompareAndAppendResult =
  | {
      ok: true;
      version: DocumentVersion;
      head: DocumentVersion;
      duplicate?: boolean;
    }
  | {
      ok: false;
      reason:
        | 'cas_conflict'
        | 'persistence_error'
        | 'invalid_argument'
        | 'stale_owner'
        | 'idempotency_conflict';
      durableHead: DocumentVersion | null;
      message: string;
    };

/**
 * Server-side durable Version store with HEAD fencing.
 */
export interface AuthoritativeDocumentPersistence {
  loadHead(
    documentId: string,
  ): DocumentVersion | null | Promise<DocumentVersion | null>;

  loadVersion(
    documentId: string,
    versionId: string,
  ): DocumentVersion | null | Promise<DocumentVersion | null>;

  /**
   * Full chain, or versions **after** fromVersionId (exclusive) through HEAD.
   * Unknown fromVersionId → PersistenceError not_found (caller maps to sync_required).
   */
  loadChain(
    documentId: string,
    fromVersionId?: string,
  ): readonly DocumentVersion[] | Promise<readonly DocumentVersion[]>;

  /**
   * Atomic: succeed only if durable HEAD id === expectedHeadId
   * (expectedHeadId null iff document has no Versions yet).
   * When options.ownerEpoch is set, also require matching durable epoch.
   */
  compareAndAppend(
    documentId: string,
    expectedHeadId: string | null,
    version: DocumentVersion,
    options?: CompareAndAppendOptions,
  ): CompareAndAppendResult | Promise<CompareAndAppendResult>;

  /** Optional durable changeId lookup (Phase 11+). */
  lookupChangeId?(
    documentId: string,
    changeId: string,
  ):
    | { versionId: string }
    | null
    | Promise<{ versionId: string } | null>;
}
