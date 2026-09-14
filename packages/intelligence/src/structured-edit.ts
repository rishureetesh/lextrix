/**
 * Structured intelligence edit — model/provider output before ChangeSet conversion.
 * Untrusted until validated against the request range.
 */
import type { ChangeOp } from 'lextrix-change';
import type { DocumentIntelligenceRequest } from './request.js';
import { extractRequestContext } from './request.js';
import { IntelligenceParseError, IntelligenceProviderError } from './errors.js';

export type StructuredEdit =
  | { kind: 'replace-range'; text: string }
  | { kind: 'ops'; ops: ChangeOp[] };

/** Wire schema preferred for LLM / structured providers (text ops only). */
export interface StructuredReplacePayload {
  operation: 'replace';
  /** Must equal request range start when present. */
  start?: number;
  /** Must equal request range end when present. */
  end?: number;
  text: string;
}

/**
 * Parse untrusted structured output into a StructuredEdit.
 * @param allowOps — when false (LLM path), reject `ops` and bare prose.
 */
export function parseStructuredEdit(
  raw: unknown,
  options: { allowOps?: boolean; allowBareString?: boolean } = {},
): StructuredEdit {
  const allowOps = options.allowOps === true;
  const allowBareString = options.allowBareString === true;

  let value = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      if (allowBareString) {
        return { kind: 'replace-range', text: trimmed };
      }
      throw new IntelligenceParseError(
        'Expected JSON structured edit, got non-JSON string',
      );
    }
  }

  if (!value || typeof value !== 'object') {
    throw new IntelligenceParseError('Structured edit must be an object');
  }

  const obj = value as Record<string, unknown>;

  // Canonical LLM schema: { operation: "replace", text, start?, end? }
  if (obj.operation === 'replace') {
    if (typeof obj.text !== 'string') {
      throw new IntelligenceParseError('replace operation requires text string');
    }
    return { kind: 'replace-range', text: obj.text };
  }

  if (obj.kind === 'replace-range') {
    if (typeof obj.text !== 'string') {
      throw new IntelligenceParseError('replace-range requires text string');
    }
    return { kind: 'replace-range', text: obj.text };
  }

  if (obj.kind === 'ops') {
    if (!allowOps) {
      throw new IntelligenceParseError(
        'ops edits are not accepted from this provider; use operation:replace',
      );
    }
    if (!Array.isArray(obj.ops)) {
      throw new IntelligenceParseError('ops requires ops array');
    }
    return { kind: 'ops', ops: obj.ops as ChangeOp[] };
  }

  throw new IntelligenceParseError(
    'Unknown structured edit (expected operation:replace or kind:replace-range)',
  );
}

/**
 * Ensure optional start/end from the model match the request range.
 * LLM may not invent positions outside the authorized span.
 */
export function assertStructuredEditInRequestRange(
  request: DocumentIntelligenceRequest,
  payload: Record<string, unknown>,
): void {
  const ctx = extractRequestContext(request);
  const allowedStart = ctx.range?.start ?? 0;
  const allowedEnd = ctx.range?.end ?? request.contents.length();

  if (payload.start !== undefined || payload.end !== undefined) {
    const start = payload.start;
    const end = payload.end;
    if (typeof start !== 'number' || typeof end !== 'number') {
      throw new IntelligenceProviderError(
        'out_of_range',
        'Structured edit start/end must be numbers when provided',
      );
    }
    if (start !== allowedStart || end !== allowedEnd) {
      throw new IntelligenceProviderError(
        'out_of_range',
        `Structured edit range [${start}, ${end}) must equal request range [${allowedStart}, ${allowedEnd})`,
      );
    }
  }
}

/** Extract JSON object from model content (handles optional markdown fences). */
export function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const body = fence ? fence[1]!.trim() : trimmed;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    // Try first {...} substring
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1)) as unknown;
      } catch {
        /* fallthrough */
      }
    }
    throw new IntelligenceParseError(
      'Model response did not contain valid JSON object',
    );
  }
}
