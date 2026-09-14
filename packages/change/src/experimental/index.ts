/**
 * Experimental Document / Version / Proposal / Rebase / Collab / AI-proposal APIs
 * (Phases 1–6A; provenance fields through 6H). Not a stable public contract.
 */
export {
  Document,
  createDocument,
  type CreateDocumentOptions,
  type DocumentApplyOptions,
} from './document.js';
export {
  DocumentHandle,
  type DocumentHandleApplyOptions,
  type CommitTransactionResult,
  type AcceptProposalResult,
  type RejectProposalResult,
  type HydrateDocumentHandleOptions,
} from './document-handle.js';
export { DocumentError, type DocumentErrorCode } from './document-error.js';
export type {
  DocumentChangeEvent,
  DocumentChangeEventType,
  DocumentChangeListener,
} from './document-event.js';
export {
  DocumentTransaction,
  type TransactionStatus,
  type TransactionCommitOptions,
  type TransactionCommitResult,
} from './transaction.js';
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
} from './change-meta.js';
export {
  DEFAULT_DOCUMENT_SCHEMA,
  type DocumentSchema,
  type SchemaValidationResult,
} from './schema.js';
export {
  DocumentVersion,
  createDocumentId,
  createVersionId,
  diffVersions,
  assertSameDocument,
} from './version.js';
export { LinearVersionStore } from './version-store.js';
export {
  DocumentAnchor,
  createAnchor,
  type AnchorAffinity,
  type CreateAnchorOptions,
} from './anchor.js';
export {
  DocumentRange,
  createRange,
  type CreateRangeOptions,
} from './range.js';
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
} from './proposal.js';
export { parseChangeProposal } from './parse-change-proposal.js';
export {
  DocumentReference,
  createDocumentReference,
  referenceFromRange,
  type CreateDocumentReferenceOptions,
} from './reference.js';
export {
  changesBetween,
  rebaseProposal,
  RebaseError,
  type RebaseErrorCode,
} from './rebase.js';
export {
  InMemoryCollabCoordinator,
  InMemoryCollaborationAdapter,
  createInMemoryCollabPair,
  createChangeId,
  CausalDependencyError,
  type CollabEnvelope,
  type PendingLocal,
  type CollabApplyRemoteResult,
  type CollabFailureCategory,
} from './collaboration.js';
export {
  validateVersionChain,
  type ValidateVersionChainOptions,
} from './validate-version-chain.js';
