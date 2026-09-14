/**
 * Stable runtime Document API (Phase 8 / ADR-016 / ADR-017).
 *
 * ```text
 * Document = immutable value
 * DocumentHandle = live session (HEAD, versions, tx, proposals, observers)
 * ```
 *
 * Wire contracts: `lextrix-change/wire` (ADR-012).
 * Remainder: `lextrix-change/experimental`.
 */
export {
  Document,
  createDocument,
  type CreateDocumentOptions,
  type DocumentApplyOptions,
} from '../experimental/document.js';

export {
  DocumentHandle,
  type DocumentHandleApplyOptions,
  type CommitTransactionResult,
  type AcceptProposalResult,
  type RejectProposalResult,
  type HydrateDocumentHandleOptions,
} from '../experimental/document-handle.js';

export {
  DocumentTransaction,
  type TransactionStatus,
  type TransactionCommitOptions,
  type TransactionCommitResult,
} from '../experimental/transaction.js';

export {
  DocumentVersion,
  createDocumentId,
  createVersionId,
  diffVersions,
  assertSameDocument,
} from '../experimental/version.js';

export {
  DocumentAnchor,
  createAnchor,
  type AnchorAffinity,
  type CreateAnchorOptions,
} from '../experimental/anchor.js';

export {
  DocumentRange,
  createRange,
  type CreateRangeOptions,
} from '../experimental/range.js';

export {
  ChangeProposal,
  createChangeProposal,
  createProposalId,
  ProposalError,
  UNTRUSTED_PROPOSAL_LIMITS,
  type CreateChangeProposalOptions,
  type ProposalInspectResult,
  type ProposalValidationCode,
  type ProposalValidationResult,
  type SerializedChangeProposal,
} from '../experimental/proposal.js';

export { parseChangeProposal } from '../experimental/parse-change-proposal.js';

export {
  changesBetween,
  rebaseProposal,
  RebaseError,
  type RebaseErrorCode,
} from '../experimental/rebase.js';

export {
  DocumentError,
  type DocumentErrorCode,
} from '../experimental/document-error.js';

export type {
  DocumentChangeEvent,
  DocumentChangeEventType,
  DocumentChangeListener,
} from '../experimental/document-event.js';

export {
  normalizeChangeMeta,
  sanitizeUntrustedChangeMeta,
  sanitizeConfidence,
  isChangeSource,
  isChangeOrigin,
  UNTRUSTED_META_LIMITS,
  type ChangeMeta,
  type ChangeOrigin,
  type ChangeProvenanceFields,
  type ChangeSource,
} from '../experimental/change-meta.js';

export {
  DEFAULT_DOCUMENT_SCHEMA,
  type DocumentSchema,
  type SchemaValidationResult,
} from '../experimental/schema.js';

export {
  validateVersionChain,
  type ValidateVersionChainOptions,
} from '../experimental/validate-version-chain.js';
