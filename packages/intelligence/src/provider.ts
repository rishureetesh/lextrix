import type { ChangeProposal } from 'lextrix-change/experimental';
import type { DocumentIntelligenceRequest } from './request.js';

/**
 * Provider-neutral document intelligence contract.
 * Implementations must return a ChangeProposal and must not mutate Document.
 */
export interface DocumentIntelligenceProvider {
  /** Stable provider id for provenance metadata. */
  readonly id: string;

  generate(request: DocumentIntelligenceRequest): Promise<ChangeProposal>;
}
