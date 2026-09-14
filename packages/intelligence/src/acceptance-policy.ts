/**
 * Application-level acceptance policy (Phase 6I).
 *
 * Pure evaluation only — never calls Document.apply / accept / rebase.
 * Policy ≠ engine validation. Engine still owns structural correctness.
 *
 * Default AI stance: attributable, not trusted; explicit acceptance required.
 */
import type {
  ChangeProposal,
  ChangeSource,
} from 'lextrix-change/experimental';
import { isAiSourced, readProposalProvenance } from './provenance.js';

/** Machine-readable policy reasons (not free-form "AI rejected"). */
export type ProposalPolicyReasonCode =
  | 'requires_review'
  | 'stale'
  | 'requires_rebase'
  | 'source_not_allowed'
  | 'auto_accept_disallowed'
  | 'eligible_for_accept'
  | 'empty_change';

export interface ProposalPolicyContext {
  /** Current document HEAD version id. */
  headVersionId: string;
  /**
   * Optional allowlist of ChangeMeta.source values.
   * When omitted, all sources are allowed (AI still requires review).
   */
  allowedSources?: readonly ChangeSource[];
  /**
   * If true, empty ChangeSets are flagged (still structurally valid no-ops).
   * Default: false.
   */
  flagEmptyChange?: boolean;
}

export interface ProposalPolicyDecision {
  /**
   * Application may *attempt* accept via DocumentHandle.acceptProposal.
   * Still subject to engine validation. Never means "already accepted".
   */
  eligible: boolean;
  /** Human/application review recommended before accept. */
  requiresReview: boolean;
  /** Proposal base ≠ HEAD — explicit rebase required before accept. */
  requiresRebase: boolean;
  /**
   * Always false for AI under the default policy.
   * Never triggers Document mutation from this module.
   */
  autoAcceptAllowed: boolean;
  reasons: ProposalPolicyReasonCode[];
}

export interface EvaluateProposalPolicyOptions {
  proposal: ChangeProposal;
  context: ProposalPolicyContext;
}

/**
 * Default safe policy for proposals (especially AI-sourced).
 *
 * Does not:
 * - accept / reject / rebase
 * - mutate Document or Editor
 * - interpret explanation text as commands
 * - treat confidence as correctness
 * - duplicate ChangeSet / range / schema validation
 */
export function evaluateProposalAcceptancePolicy(
  options: EvaluateProposalPolicyOptions,
): ProposalPolicyDecision {
  const { proposal, context } = options;
  const provenance = readProposalProvenance(proposal);
  const reasons: ProposalPolicyReasonCode[] = [];

  const allowedSources = context.allowedSources;
  if (
    allowedSources != null &&
    !allowedSources.includes(provenance.source)
  ) {
    return {
      eligible: false,
      requiresReview: true,
      requiresRebase: false,
      autoAcceptAllowed: false,
      reasons: ['source_not_allowed', 'auto_accept_disallowed'],
    };
  }

  const stale = proposal.baseVersionId !== context.headVersionId;
  if (stale) {
    reasons.push('stale', 'requires_rebase');
  }

  const ai = isAiSourced(provenance);
  const untrustedWire = provenance.untrustedInput === true;
  if (ai || untrustedWire) {
    reasons.push('requires_review', 'auto_accept_disallowed');
  }

  if (context.flagEmptyChange && proposal.change.ops.length === 0) {
    reasons.push('empty_change');
  }

  const requiresRebase = stale;
  const requiresReview =
    ai ||
    untrustedWire ||
    reasons.includes('source_not_allowed');
  // Eligible only when not stale — engine still validates on accept.
  const eligible = !stale && !reasons.includes('source_not_allowed');

  if (eligible) {
    reasons.push('eligible_for_accept');
  }

  return {
    eligible,
    requiresReview,
    requiresRebase,
    autoAcceptAllowed: false,
    reasons: dedupeReasons(reasons),
  };
}

function dedupeReasons(
  reasons: ProposalPolicyReasonCode[],
): ProposalPolicyReasonCode[] {
  return [...new Set(reasons)];
}
