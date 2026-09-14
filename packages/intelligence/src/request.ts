/**
 * Intelligence Request — what the application wants done.
 * Distinct from ChangeProposal (what the engine may apply).
 *
 * Context is a frozen view of DocumentState at baseVersionId — never HEAD.
 */
import ChangeSet from 'lextrix-change';
import type { ChangeOp } from 'lextrix-change';
import type { DocumentHandle } from 'lextrix-change/experimental';
import type { DocumentRange } from 'lextrix-change/experimental';
import { IntelligenceRequestError } from './errors.js';

/** Version-bound half-open range indices (same semantics as DocumentRange). */
export interface DocumentIntelligenceRange {
  readonly start: number;
  readonly end: number;
}

export type DocumentIntelligenceOperation =
  | 'rewrite'
  | 'replace'
  | 'transform'
  | 'shorten';

export interface DocumentIntelligenceContext {
  /** Explicit replacement text for `replace` / structured edits. */
  readonly replacement?: string;
  /** Max plain-text length for deterministic `shorten`. */
  readonly maxLength?: number;
  /** Free-form application bag (never interpreted by the Document engine). */
  readonly [key: string]: unknown;
}

/**
 * Minimal provider-neutral request.
 * Passes a frozen contents snapshot — not a live Document / Editor / DOM.
 * Instances from {@link createIntelligenceRequest} / {@link parseIntelligenceRequest}
 * are shallow-frozen (immutable fields).
 */
export interface DocumentIntelligenceRequest {
  readonly documentId: string;
  readonly baseVersionId: string;
  /** Insert-only DocumentState contents at baseVersionId. */
  readonly contents: ChangeSet;
  readonly instruction: string;
  readonly operation?: DocumentIntelligenceOperation;
  readonly range?: DocumentIntelligenceRange;
  readonly context?: DocumentIntelligenceContext;
}

/** JSON-safe request wire shape (no DocumentHandle / provider / DOM). */
export interface SerializedIntelligenceRequest {
  documentId: string;
  baseVersionId: string;
  ops: ChangeOp[];
  instruction: string;
  operation?: DocumentIntelligenceOperation;
  range?: DocumentIntelligenceRange;
  context?: DocumentIntelligenceContext;
}

/** Plain text from a ChangeSet (embeds → U+FFFC). */
export function extractPlainText(
  contents: ChangeSet,
  start = 0,
  end: number = contents.length(),
): string {
  const sliced = contents.slice(start, end);
  let text = '';
  for (const op of sliced.ops) {
    if (typeof op.insert === 'string') text += op.insert;
    else if (op.insert && typeof op.insert === 'object') text += '\uFFFC';
  }
  return text;
}

/** True if [start, end) contains an embed insert. */
export function rangeContainsEmbed(
  contents: ChangeSet,
  start: number,
  end: number,
): boolean {
  const sliced = contents.slice(start, end);
  return sliced.ops.some(
    (op) => op.insert != null && typeof op.insert === 'object',
  );
}

export interface ExtractedRequestContext {
  readonly documentId: string;
  readonly baseVersionId: string;
  readonly fullText: string;
  readonly selectedText: string;
  readonly range: DocumentIntelligenceRange | null;
  readonly beforeText: string;
  readonly afterText: string;
  readonly containsEmbed: boolean;
}

/** Pure context extraction for providers (no DOM, no Handle, no HEAD). */
export function extractRequestContext(
  request: DocumentIntelligenceRequest,
): ExtractedRequestContext {
  const len = request.contents.length();
  const range = normalizeRange(request.range, len);
  const start = range?.start ?? 0;
  const end = range?.end ?? len;
  return Object.freeze({
    documentId: request.documentId,
    baseVersionId: request.baseVersionId,
    fullText: extractPlainText(request.contents, 0, len),
    selectedText: extractPlainText(request.contents, start, end),
    range,
    beforeText: extractPlainText(request.contents, 0, start),
    afterText: extractPlainText(request.contents, end, len),
    containsEmbed: rangeContainsEmbed(request.contents, start, end),
  });
}

/**
 * Build a request from a DocumentHandle at an explicit version (default HEAD).
 * Snapshots contents at that version — subsequent HEAD advances do not affect it.
 * Does not mutate the handle.
 */
export function createIntelligenceRequest(
  handle: DocumentHandle,
  options: {
    instruction: string;
    operation?: DocumentIntelligenceOperation;
    range?: DocumentRange | DocumentIntelligenceRange;
    context?: DocumentIntelligenceContext;
    /** Defaults to current HEAD at call time (snapshot, not a live binding). */
    baseVersionId?: string;
  },
): DocumentIntelligenceRequest {
  if (!options.instruction || !options.instruction.trim()) {
    throw new IntelligenceRequestError(
      'invalid_instruction',
      'instruction is required',
    );
  }
  if (options.instruction.length > 8192) {
    throw new IntelligenceRequestError(
      'invalid_instruction',
      'instruction exceeds 8192 character limit',
    );
  }
  const version = options.baseVersionId
    ? handle.getVersion(options.baseVersionId)
    : handle.currentVersion();
  if (version.documentId !== handle.documentId) {
    throw new IntelligenceRequestError(
      'wrong_document',
      'Version documentId mismatch',
    );
  }

  let range: DocumentIntelligenceRange | undefined;
  if (options.range) {
    if ('startIndex' in options.range) {
      const r = options.range as DocumentRange;
      if (r.documentId !== handle.documentId) {
        throw new IntelligenceRequestError(
          'wrong_document',
          'Range documentId mismatch',
        );
      }
      if (r.versionId !== version.id) {
        throw new IntelligenceRequestError(
          'version_mismatch',
          `Range version ${r.versionId} ≠ request base ${version.id}`,
        );
      }
      range = { start: r.startIndex, end: r.endIndex };
    } else {
      range = { start: options.range.start, end: options.range.end };
    }
  }

  const len = version.contents.length();
  if (range) {
    assertValidRange(range, len);
  }

  return freezeRequest({
    documentId: handle.documentId,
    baseVersionId: version.id,
    contents: version.contents.clone().freeze(),
    instruction: options.instruction.trim(),
    operation: options.operation,
    range: range ? Object.freeze({ ...range }) : undefined,
    context: options.context
      ? Object.freeze({ ...options.context })
      : undefined,
  });
}

export function serializeIntelligenceRequest(
  request: DocumentIntelligenceRequest,
): SerializedIntelligenceRequest {
  return {
    documentId: request.documentId,
    baseVersionId: request.baseVersionId,
    ops: request.contents.ops.map((op) => ({ ...op })),
    instruction: request.instruction,
    operation: request.operation,
    range: request.range ? { ...request.range } : undefined,
    context: request.context ? { ...request.context } : undefined,
  };
}

export function parseIntelligenceRequest(
  input: SerializedIntelligenceRequest | string,
): DocumentIntelligenceRequest {
  let data: SerializedIntelligenceRequest;
  try {
    data =
      typeof input === 'string'
        ? (JSON.parse(input) as SerializedIntelligenceRequest)
        : input;
  } catch (err) {
    throw new IntelligenceRequestError(
      'invalid_serialized',
      `parseIntelligenceRequest: invalid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (
    !data ||
    typeof data.documentId !== 'string' ||
    typeof data.baseVersionId !== 'string' ||
    !Array.isArray(data.ops) ||
    typeof data.instruction !== 'string'
  ) {
    throw new IntelligenceRequestError(
      'invalid_serialized',
      'parseIntelligenceRequest: missing required fields',
    );
  }
  const contents = new ChangeSet(data.ops).freeze();
  const range = data.range
    ? { start: data.range.start, end: data.range.end }
    : undefined;
  if (range) assertValidRange(range, contents.length());
  return freezeRequest({
    documentId: data.documentId,
    baseVersionId: data.baseVersionId,
    contents,
    instruction: data.instruction.trim(),
    operation: data.operation,
    range: range ? Object.freeze(range) : undefined,
    context: data.context ? Object.freeze({ ...data.context }) : undefined,
  });
}

function freezeRequest(
  request: DocumentIntelligenceRequest,
): DocumentIntelligenceRequest {
  return Object.freeze(request);
}

function assertValidRange(
  range: DocumentIntelligenceRange,
  docLen: number,
): void {
  if (
    !Number.isInteger(range.start) ||
    !Number.isInteger(range.end) ||
    !Number.isFinite(range.start) ||
    !Number.isFinite(range.end) ||
    range.start < 0 ||
    range.end < 0 ||
    range.start > docLen ||
    range.end > docLen ||
    range.start > range.end
  ) {
    throw new IntelligenceRequestError(
      'invalid_range',
      `Invalid range [${range.start}, ${range.end}) for document length ${docLen}`,
    );
  }
}

function normalizeRange(
  range: DocumentIntelligenceRange | undefined,
  docLen: number,
): DocumentIntelligenceRange | null {
  if (!range) return null;
  assertValidRange(range, docLen);
  return Object.freeze({ start: range.start, end: range.end });
}
