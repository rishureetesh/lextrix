/**
 * OpenAI Chat Completions provider via native fetch — no openai npm SDK.
 * Export: `lextrix-intelligence/openai`
 *
 * Credentials: process.env.OPENAI_API_KEY (never commit).
 * Output: JSON { "operation": "replace", "text": "..." } within request range.
 */
import {
  createChangeProposal,
  type ChangeProposal,
} from 'lextrix-change/experimental';
import type { DocumentIntelligenceProvider } from '../provider.js';
import type { DocumentIntelligenceRequest } from '../request.js';
import {
  extractRequestContext,
  rangeContainsEmbed,
} from '../request.js';
import { structuredEditToChangeSet } from '../edit-to-changeset.js';
import { IntelligenceProviderError } from '../errors.js';
import {
  assertStructuredEditInRequestRange,
  extractJsonObject,
  parseStructuredEdit,
} from '../structured-edit.js';
import { buildAiProposalMeta } from '../provenance.js';

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

export interface OpenAiProviderOptions {
  /** Defaults to process.env.OPENAI_API_KEY */
  apiKey?: string;
  model?: string;
  endpoint?: string;
  timeoutMs?: number;
  /** Injectable fetch for tests (must not be used to leak keys into fixtures). */
  fetch?: typeof fetch;
  /** Optional AbortSignal from the application. */
  signal?: AbortSignal;
}

export class OpenAiDocumentIntelligenceProvider
  implements DocumentIntelligenceProvider
{
  readonly id = 'openai';
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly signal?: AbortSignal;

  constructor(options: OpenAiProviderOptions = {}) {
    this.apiKey = options.apiKey ?? readEnv('OPENAI_API_KEY');
    this.model = options.model ?? readEnv('OPENAI_MODEL') ?? DEFAULT_MODEL;
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.signal = options.signal;
  }

  async generate(
    request: DocumentIntelligenceRequest,
  ): Promise<ChangeProposal> {
    if (!this.apiKey) {
      throw new IntelligenceProviderError(
        'provider_unavailable',
        'OPENAI_API_KEY is not configured',
      );
    }
    if (typeof this.fetchImpl !== 'function') {
      throw new IntelligenceProviderError(
        'provider_unavailable',
        'fetch is not available in this runtime',
      );
    }

    const extracted = extractRequestContext(request);
    const start = extracted.range?.start ?? 0;
    const end = extracted.range?.end ?? request.contents.length();

    if (rangeContainsEmbed(request.contents, start, end)) {
      throw new IntelligenceProviderError(
        'unsupported_content',
        'OpenAI text provider does not support ranges containing embeds',
      );
    }

    const system = [
      'You are a document edit generator for Lextrix.',
      'Return ONLY a JSON object with this exact schema:',
      '{"operation":"replace","text":"<replacement string>","start":<number>,"end":<number>}',
      `start must be ${start} and end must be ${end}.`,
      'Do not modify content outside that range.',
      'Do not return markdown, prose, or DocumentState.',
      'Do not invent ops arrays.',
    ].join(' ');

    const user = JSON.stringify({
      instruction: request.instruction,
      operation: request.operation ?? null,
      range: { start, end },
      selectedText: extracted.selectedText,
      beforeText: truncate(extracted.beforeText, 500),
      afterText: truncate(extracted.afterText, 500),
      documentId: request.documentId,
      baseVersionId: request.baseVersionId,
    });

    const body = {
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onOuterAbort = () => controller.abort();
    if (this.signal) {
      if (this.signal.aborted) controller.abort();
      else this.signal.addEventListener('abort', onOuterAbort, { once: true });
    }

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (isAbortError(err)) {
        throw new IntelligenceProviderError(
          'provider_timeout',
          'OpenAI request timed out or was cancelled',
        );
      }
      throw new IntelligenceProviderError(
        'provider_unavailable',
        'OpenAI request failed (network or fetch error)',
      );
    } finally {
      clearTimeout(timer);
      this.signal?.removeEventListener('abort', onOuterAbort);
    }

    if (response.status === 429) {
      throw new IntelligenceProviderError(
        'provider_rate_limited',
        'OpenAI rate limit exceeded',
      );
    }
    if (!response.ok) {
      // Do not echo response body (may contain sensitive details).
      throw new IntelligenceProviderError(
        'provider_failed',
        `OpenAI HTTP ${response.status}`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new IntelligenceProviderError(
        'provider_malformed',
        'OpenAI response was not JSON',
      );
    }

    const content = extractAssistantContent(payload);
    let parsed: unknown;
    try {
      parsed = extractJsonObject(content);
    } catch (err) {
      throw new IntelligenceProviderError(
        'provider_malformed',
        err instanceof Error ? err.message : String(err),
      );
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new IntelligenceProviderError(
        'provider_malformed',
        'Structured output was not an object',
      );
    }

    assertStructuredEditInRequestRange(
      request,
      parsed as Record<string, unknown>,
    );

    let edit;
    try {
      edit = parseStructuredEdit(parsed, {
        allowOps: false,
        allowBareString: false,
      });
    } catch (err) {
      throw new IntelligenceProviderError(
        'provider_malformed',
        err instanceof Error ? err.message : String(err),
      );
    }

    if (edit.kind !== 'replace-range') {
      throw new IntelligenceProviderError(
        'provider_malformed',
        'Only replace operations are accepted from OpenAI provider',
      );
    }

    const change = structuredEditToChangeSet(request, edit);
    return createChangeProposal({
      documentId: request.documentId,
      baseVersionId: request.baseVersionId,
      change,
      meta: buildAiProposalMeta({
        intent: request.operation ?? 'completion',
        provider: this.id,
        model: this.model,
        explanation: request.instruction.slice(0, 120),
        // Optional OpenAI response id when present — provenance only.
        requestId: extractResponseId(payload),
      }),
    });
  }
}

function extractAssistantContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new IntelligenceProviderError(
      'provider_malformed',
      'Unexpected OpenAI payload shape',
    );
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new IntelligenceProviderError(
      'provider_malformed',
      'OpenAI payload missing choices',
    );
  }
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  const content = message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new IntelligenceProviderError(
      'provider_malformed',
      'OpenAI message content missing',
    );
  }
  return content;
}

function extractResponseId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const id = (payload as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function readEnv(name: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' &&
      err instanceof DOMException &&
      err.name === 'AbortError')
  );
}
