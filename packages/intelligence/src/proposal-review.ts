/**
 * Proposal review workflow (Phase 6J).
 *
 * Review is an application-facing derived view — not a mutation system,
 * not a second source of truth, and not a persistent review database.
 *
 * Canonical lifecycle:
 *   generate → inspect → review → (optional rebase) → review again → accept|reject
 * Accept still goes through DocumentHandle.acceptProposal.
 */
import ChangeSet from 'lextrix-change';
import type {
  AcceptProposalResult,
  ChangeProposal,
  DocumentHandle,
  DocumentVersion,
  ProposalInspectResult,
  RejectProposalResult,
} from 'lextrix-change/experimental';
import {
  evaluateProposalAcceptancePolicy,
  type ProposalPolicyContext,
  type ProposalPolicyDecision,
  type EvaluateProposalPolicyOptions,
} from './acceptance-policy.js';
import {
  readProposalProvenance,
  type ProposalProvenance,
} from './provenance.js';

/**
 * Derived review status (observational).
 * `accepted` / `rejected` are only used on orchestration result wrappers —
 * pure `createProposalReview` never returns them.
 */
export type ProposalReviewStatus =
  | 'invalid'
  | 'stale'
  | 'pending'
  | 'ready'
  | 'blocked';

export interface ProposalReviewRange {
  start: number;
  end: number;
}

/**
 * Derived review snapshot. Always rebuild from proposal + current document.
 * Do not persist as authoritative state — serialize ChangeProposal instead.
 */
export interface ProposalReview {
  proposal: ChangeProposal;
  status: ProposalReviewStatus;
  baseVersionId: string;
  currentVersionId: string;
  inspect: ProposalInspectResult;
  policy: ProposalPolicyDecision;
  provenance: ProposalProvenance;
  /** Proposal ChangeSet (what would apply). */
  previewChange: ChangeSet;
  /**
   * Ephemeral contents after applying the proposal to its **base** version.
   * Not written to VersionStore. Not a DocumentVersion.
   */
  previewContents: ChangeSet;
  /**
   * Optional application-supplied range (e.g. from DocumentIntelligenceRequest).
   * Not inferred from ChangeSet. Must not be remapped silently when stale.
   */
  range?: ProposalReviewRange;
}

export interface CreateProposalReviewOptions {
  handle: DocumentHandle;
  proposal: ChangeProposal;
  /** Overrides; headVersionId defaults to handle HEAD. */
  policyContext?: Partial<ProposalPolicyContext>;
  range?: ProposalReviewRange;
  policy?: (opts: EvaluateProposalPolicyOptions) => ProposalPolicyDecision;
}

/**
 * Build a pure review snapshot. Calls observational handle APIs only
 * (inspectProposal / version reads). Does not apply, accept, rebase, or project.
 */
export function createProposalReview(
  options: CreateProposalReviewOptions,
): ProposalReview {
  const { handle, proposal } = options;
  const inspect = handle.inspectProposal(proposal);
  const head = handle.currentVersion();
  const headVersionId =
    options.policyContext?.headVersionId ?? head.id;

  const policyFn = options.policy ?? evaluateProposalAcceptancePolicy;
  const policy = policyFn({
    proposal,
    context: {
      headVersionId,
      allowedSources: options.policyContext?.allowedSources,
      flagEmptyChange: options.policyContext?.flagEmptyChange,
    },
  });

  const provenance = readProposalProvenance(proposal);
  const status = deriveReviewStatus(inspect, policy);
  const previewContents = computePreviewContents(handle, proposal, inspect);
  const previewChange = proposal.change.clone();

  return {
    proposal,
    status,
    baseVersionId: proposal.baseVersionId,
    currentVersionId: head.id,
    inspect,
    policy,
    provenance,
    previewChange,
    previewContents,
    range: options.range ? { ...options.range } : undefined,
  };
}

export function deriveReviewStatus(
  inspect: ProposalInspectResult,
  policy: ProposalPolicyDecision,
): ProposalReviewStatus {
  if (!inspect.ok) return 'invalid';
  if (policy.reasons.includes('source_not_allowed')) return 'blocked';
  if (inspect.stale || policy.requiresRebase) return 'stale';
  if (!policy.eligible) return 'blocked';
  if (policy.requiresReview) return 'pending';
  return 'ready';
}

/**
 * Ephemeral preview: compose base contents with proposal change.
 * Falls back to empty ChangeSet when base is unknown / inspect invalid.
 * Never writes to VersionStore.
 */
export function computePreviewContents(
  handle: DocumentHandle,
  proposal: ChangeProposal,
  inspect?: ProposalInspectResult,
): ChangeSet {
  const inspected = inspect ?? handle.inspectProposal(proposal);
  if (!inspected.ok) {
    return new ChangeSet();
  }
  try {
    const base = handle.getVersion(proposal.baseVersionId);
    return base.contents.compose(proposal.change);
  } catch {
    return new ChangeSet();
  }
}

export class ProposalReviewError extends Error {
  readonly code:
    | 'invalid'
    | 'stale'
    | 'blocked'
    | 'review_required'
    | 'policy_blocked';

  constructor(
    code: ProposalReviewError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'ProposalReviewError';
    this.code = code;
  }
}

export interface AcceptReviewedProposalOptions {
  /**
   * Required when policy.requiresReview (default for AI).
   * Calling accept with this true is the explicit application decision.
   */
  acknowledgeReview?: boolean;
  policyContext?: Partial<ProposalPolicyContext>;
  range?: ProposalReviewRange;
}

/**
 * Explicit accept orchestration. Never auto-rebases.
 * Still delegates mutation to DocumentHandle.acceptProposal.
 */
export function acceptReviewedProposal(
  handle: DocumentHandle,
  proposal: ChangeProposal,
  options: AcceptReviewedProposalOptions = {},
): AcceptProposalResult {
  const review = createProposalReview({
    handle,
    proposal,
    policyContext: options.policyContext,
    range: options.range,
  });

  if (review.status === 'invalid') {
    const msg =
      review.inspect.ok === false ? review.inspect.message : 'Proposal invalid';
    throw new ProposalReviewError('invalid', msg);
  }
  if (review.status === 'stale') {
    throw new ProposalReviewError(
      'stale',
      'Proposal is stale; call rebaseReviewedProposal explicitly before accept',
    );
  }
  if (review.status === 'blocked') {
    throw new ProposalReviewError(
      'policy_blocked',
      `Proposal blocked by policy: ${review.policy.reasons.join(',')}`,
    );
  }
  if (review.status === 'pending' && !options.acknowledgeReview) {
    throw new ProposalReviewError(
      'review_required',
      'Proposal requires review; pass acknowledgeReview: true to accept explicitly',
    );
  }

  return handle.acceptProposal(proposal);
}

/** Reject — no Document / Version / Editor mutation. */
export function rejectReviewedProposal(
  handle: DocumentHandle,
  proposal: ChangeProposal,
): RejectProposalResult {
  return handle.rejectProposal(proposal);
}

/**
 * Explicit rebase. Original proposal immutable; provenance preserved by engine.
 * Does not accept. Caller should createProposalReview again on the result.
 */
export function rebaseReviewedProposal(
  handle: DocumentHandle,
  proposal: ChangeProposal,
  targetVersion?: DocumentVersion | string,
): ChangeProposal {
  return handle.rebaseProposal(proposal, targetVersion);
}

/**
 * Convenience: rebase (if stale) is NOT automatic — only refreshes review.
 * Alias for createProposalReview after an explicit rebase elsewhere.
 */
export function refreshProposalReview(
  options: CreateProposalReviewOptions,
): ProposalReview {
  return createProposalReview(options);
}
