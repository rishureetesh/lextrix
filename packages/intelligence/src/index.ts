/**
 * Document Intelligence — application-layer contracts (Phase 6B–6K).
 * Produces ChangeProposals. Never mutates Document / Editor / DOM.
 * Real OpenAI provider: import from `lextrix-intelligence/openai` (fetch-only).
 * Provenance, acceptance policy, and proposal review live here — not in lextrix-change.
 */
export {
  createIntelligenceRequest,
  extractPlainText,
  extractRequestContext,
  rangeContainsEmbed,
  serializeIntelligenceRequest,
  parseIntelligenceRequest,
} from './request.js';
export type {
  DocumentIntelligenceRequest,
  DocumentIntelligenceRange,
  DocumentIntelligenceContext,
  DocumentIntelligenceOperation,
  SerializedIntelligenceRequest,
  ExtractedRequestContext,
} from './request.js';
export type { DocumentIntelligenceProvider } from './provider.js';
export {
  IntelligenceRequestError,
  IntelligenceProviderError,
  IntelligenceParseError,
} from './errors.js';
export { DeterministicDocumentIntelligenceProvider } from './deterministic-provider.js';
export type {
  StructuredEdit,
  StructuredCompletionFn,
} from './structured-provider.js';
export { StructuredCompletionProvider } from './structured-provider.js';
export { structuredEditToChangeSet } from './edit-to-changeset.js';
export {
  parseStructuredEdit,
  assertStructuredEditInRequestRange,
  extractJsonObject,
  type StructuredReplacePayload,
} from './structured-edit.js';
export {
  readProposalProvenance,
  buildAiProposalMeta,
  isAiSourced,
  type ProposalProvenance,
  type BuildAiProposalMetaOptions,
} from './provenance.js';
export {
  evaluateProposalAcceptancePolicy,
  type ProposalPolicyReasonCode,
  type ProposalPolicyContext,
  type ProposalPolicyDecision,
  type EvaluateProposalPolicyOptions,
} from './acceptance-policy.js';
export {
  createProposalReview,
  deriveReviewStatus,
  computePreviewContents,
  acceptReviewedProposal,
  rejectReviewedProposal,
  rebaseReviewedProposal,
  refreshProposalReview,
  ProposalReviewError,
  type ProposalReview,
  type ProposalReviewStatus,
  type ProposalReviewRange,
  type CreateProposalReviewOptions,
  type AcceptReviewedProposalOptions,
} from './proposal-review.js';
