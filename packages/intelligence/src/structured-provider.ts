/**
 * Injectable structured-completion provider (test / app seam).
 * For production LLMs prefer OpenAiDocumentIntelligenceProvider (./openai).
 */
import {
  createChangeProposal,
  type ChangeProposal,
} from 'lextrix-change/experimental';
import type { DocumentIntelligenceProvider } from './provider.js';
import type { DocumentIntelligenceRequest } from './request.js';
import { extractRequestContext } from './request.js';
import { structuredEditToChangeSet } from './edit-to-changeset.js';
import { IntelligenceProviderError } from './errors.js';
import {
  parseStructuredEdit,
  type StructuredEdit,
} from './structured-edit.js';
import { buildAiProposalMeta } from './provenance.js';

export type { StructuredEdit } from './structured-edit.js';

export type StructuredCompletionFn = (
  request: DocumentIntelligenceRequest,
  extracted: ReturnType<typeof extractRequestContext>,
) => Promise<StructuredEdit | string>;

export class StructuredCompletionProvider
  implements DocumentIntelligenceProvider
{
  readonly id: string;
  private readonly complete: StructuredCompletionFn;
  private readonly model: string;

  constructor(options: {
    id?: string;
    model?: string;
    complete: StructuredCompletionFn;
  }) {
    this.id = options.id ?? 'structured-completion';
    this.model = options.model ?? 'injectable';
    this.complete = options.complete;
  }

  async generate(
    request: DocumentIntelligenceRequest,
  ): Promise<ChangeProposal> {
    const extracted = extractRequestContext(request);
    let raw: StructuredEdit | string;
    try {
      raw = await this.complete(request, extracted);
    } catch (err) {
      throw new IntelligenceProviderError(
        'provider_failed',
        err instanceof Error ? err.message : String(err),
      );
    }

    const edit = parseStructuredEdit(raw, {
      allowOps: true,
      allowBareString: true,
    });
    const change = structuredEditToChangeSet(request, edit);
    return createChangeProposal({
      documentId: request.documentId,
      baseVersionId: request.baseVersionId,
      change,
      meta: buildAiProposalMeta({
        intent: request.operation ?? 'completion',
        provider: this.id,
        model: this.model,
        explanation:
          typeof request.instruction === 'string'
            ? request.instruction.slice(0, 120)
            : undefined,
      }),
    });
  }
}
