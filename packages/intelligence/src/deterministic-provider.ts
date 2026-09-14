/**
 * Deterministic DocumentIntelligenceProvider — proves the contract without LLMs.
 * Uses only request.contents / request.range — never DocumentHandle or HEAD.
 */
import {
  createChangeProposal,
  type ChangeProposal,
} from 'lextrix-change/experimental';
import type { DocumentIntelligenceProvider } from './provider.js';
import type { DocumentIntelligenceRequest } from './request.js';
import { extractRequestContext } from './request.js';
import { structuredEditToChangeSet } from './edit-to-changeset.js';
import {
  IntelligenceProviderError,
  IntelligenceRequestError,
} from './errors.js';
import type { StructuredEdit } from './structured-provider.js';
import { buildAiProposalMeta } from './provenance.js';

export class DeterministicDocumentIntelligenceProvider
  implements DocumentIntelligenceProvider
{
  readonly id = 'deterministic';

  async generate(
    request: DocumentIntelligenceRequest,
  ): Promise<ChangeProposal> {
    if (!request.instruction?.trim()) {
      throw new IntelligenceRequestError(
        'invalid_instruction',
        'instruction is required',
      );
    }
    const ctx = extractRequestContext(request);
    const op = request.operation ?? inferOperation(request.instruction);

    // Text ops that rewrite selection content reject embed-bearing ranges.
    if (
      (op === 'transform' || op === 'rewrite' || op === 'shorten') &&
      ctx.containsEmbed
    ) {
      throw new IntelligenceProviderError(
        'unsupported_content',
        `${op} does not support ranges containing embeds; use replace with an explicit ChangeSet/ops edit`,
      );
    }

    const edit = this.buildEdit(request, ctx, op);
    const change = structuredEditToChangeSet(request, edit);
    // Empty ChangeSet is a valid no-op proposal (accept creates no Version).
    return createChangeProposal({
      documentId: request.documentId,
      baseVersionId: request.baseVersionId,
      change,
      meta: buildAiProposalMeta({
        intent: op,
        provider: this.id,
        model: 'deterministic-v1',
        explanation: `deterministic:${op}:${request.instruction.slice(0, 80)}`,
        // Provider metadata only — not a document-correctness guarantee.
        confidence: 1,
      }),
    });
  }

  private buildEdit(
    request: DocumentIntelligenceRequest,
    ctx: ReturnType<typeof extractRequestContext>,
    op: NonNullable<DocumentIntelligenceRequest['operation']>,
  ): StructuredEdit {
    const selected = ctx.selectedText;
    switch (op) {
      case 'replace': {
        const replacement =
          request.context?.replacement ??
          parseReplacement(request.instruction);
        if (replacement == null) {
          throw new IntelligenceProviderError(
            'unsupported_operation',
            'replace requires context.replacement or "replace:TEXT" instruction',
          );
        }
        return { kind: 'replace-range', text: replacement };
      }
      case 'transform': {
        return { kind: 'replace-range', text: selected.toUpperCase() };
      }
      case 'shorten': {
        const max =
          typeof request.context?.maxLength === 'number'
            ? request.context.maxLength
            : Math.max(1, Math.floor(selected.length / 2) || 1);
        const shortened =
          selected.length <= max
            ? selected
            : `${selected.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
        return { kind: 'replace-range', text: shortened };
      }
      case 'rewrite': {
        const rewritten = selected.replace(/\s+/g, ' ').trim();
        return {
          kind: 'replace-range',
          text: rewritten.length > 0 ? rewritten : selected,
        };
      }
      default: {
        throw new IntelligenceProviderError(
          'unsupported_operation',
          `Unsupported operation: ${String(op)}`,
        );
      }
    }
  }
}

function inferOperation(
  instruction: string,
): NonNullable<DocumentIntelligenceRequest['operation']> {
  const lower = instruction.toLowerCase();
  if (lower.startsWith('replace:')) return 'replace';
  if (lower.includes('uppercase') || lower.includes('transform')) {
    return 'transform';
  }
  if (lower.includes('short') || lower.includes('concise')) return 'shorten';
  if (lower.includes('rewrite') || lower.includes('normalize')) return 'rewrite';
  return 'rewrite';
}

function parseReplacement(instruction: string): string | null {
  const m = /^replace:\s*([\s\S]*)$/i.exec(instruction);
  return m ? m[1]! : null;
}
