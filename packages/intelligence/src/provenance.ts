/**
 * Proposal provenance helpers (Phase 6H).
 * Read/build metadata only — never mutate Document / Editor / ChangeSet semantics.
 */
import type {
  ChangeMeta,
  ChangeProposal,
  ChangeProvenanceFields,
  ChangeSource,
} from 'lextrix-change/experimental';

/** Snapshot of provenance fields useful for audit / UI / policy. */
export interface ProposalProvenance extends ChangeProvenanceFields {
  source: ChangeSource;
  origin: ChangeMeta['origin'];
  intent?: string;
  authorId?: string;
  /** True when deserialized from untrusted wire JSON. */
  untrustedInput?: boolean;
  /** Proposal identity (not a provider request id). */
  proposalId: string;
  documentId: string;
  baseVersionId: string;
  createdAt: string;
}

/**
 * Extract provenance from a proposal. Does not interpret explanation/confidence.
 */
export function readProposalProvenance(
  proposal: ChangeProposal,
): ProposalProvenance {
  const { meta } = proposal;
  return {
    source: meta.source,
    origin: meta.origin,
    intent: meta.intent,
    authorId: meta.authorId,
    untrustedInput: meta.untrustedInput === true ? true : undefined,
    provider: typeof meta.provider === 'string' ? meta.provider : undefined,
    model: typeof meta.model === 'string' ? meta.model : undefined,
    explanation:
      typeof meta.explanation === 'string' ? meta.explanation : undefined,
    confidence:
      typeof meta.confidence === 'number' &&
      Number.isFinite(meta.confidence) &&
      meta.confidence >= 0 &&
      meta.confidence <= 1
        ? meta.confidence
        : undefined,
    requestId:
      typeof meta.requestId === 'string' ? meta.requestId : undefined,
    generatedAt:
      typeof meta.generatedAt === 'string' ? meta.generatedAt : undefined,
    proposalId: proposal.id,
    documentId: proposal.documentId,
    baseVersionId: proposal.baseVersionId,
    createdAt: proposal.createdAt,
  };
}

export interface BuildAiProposalMetaOptions extends ChangeProvenanceFields {
  intent?: string;
  authorId?: string;
  /** Extra bag keys (still frozen by createChangeProposal). */
  extra?: Record<string, unknown>;
}

/**
 * Build AI proposal metadata. Generic strings only — no vendor SDK types.
 * Explanation/confidence are untrusted provider claims when supplied.
 */
export function buildAiProposalMeta(
  options: BuildAiProposalMetaOptions,
): Partial<ChangeMeta> {
  const meta: Partial<ChangeMeta> = {
    source: 'ai',
    origin: 'system',
    intent: options.intent,
    authorId: options.authorId,
    provider: options.provider,
    model: options.model,
    explanation: options.explanation,
    confidence: options.confidence,
    requestId: options.requestId,
    generatedAt: options.generatedAt,
    ...options.extra,
  };
  return meta;
}

/** True when metadata attributes the proposal to AI provenance. */
export function isAiSourced(meta: ChangeMeta | ProposalProvenance): boolean {
  return meta.source === 'ai';
}
