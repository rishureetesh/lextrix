/**
 * Change metadata for transactions / Document.apply (experimental).
 *
 * Provenance fields explain *where a change/proposal came from*.
 * They never alter ChangeSet / OT / apply / rebase semantics (ADR-009 / ADR-011 / ADR-015).
 *
 * Untrusted wire input must go through {@link sanitizeUntrustedChangeMeta}.
 */

export type ChangeSource =
  | 'user'
  | 'api'
  | 'system'
  | 'remote'
  | 'ai'
  | 'silent'
  | 'projection';

/** Where the ChangeSet entered the Document pipeline. */
export type ChangeOrigin =
  | 'transaction'
  | 'editor'
  | 'projection'
  | 'system';

const CHANGE_SOURCES = new Set<string>([
  'user',
  'api',
  'system',
  'remote',
  'ai',
  'silent',
  'projection',
]);

const CHANGE_ORIGINS = new Set<string>([
  'transaction',
  'editor',
  'projection',
  'system',
]);

/** Soft caps for untrusted metadata strings (app may impose stricter limits). */
export const UNTRUSTED_META_LIMITS = {
  explanation: 2048,
  provider: 256,
  model: 256,
  requestId: 256,
  generatedAt: 64,
  authorId: 256,
  intent: 256,
} as const;

/**
 * Optional provenance / explainability fields.
 * Informational only — not authorization, not correctness, not OT priority.
 */
export interface ChangeProvenanceFields {
  provider?: string;
  model?: string;
  explanation?: string;
  /** 0..1 provider-reported score when present. Not correctness. */
  confidence?: number;
  /** Provider/network request id — not proposal identity. */
  requestId?: string;
  /** ISO timestamp from the producer — not document ordering. */
  generatedAt?: string;
}

export interface ChangeMeta extends ChangeProvenanceFields {
  source: ChangeSource;
  origin: ChangeOrigin;
  authorId?: string;
  intent?: string;
  /**
   * Set when meta was deserialized from untrusted wire JSON.
   * Descriptive only for engine OT; application policy/review must treat
   * such proposals as requiring explicit acknowledgement.
   */
  untrustedInput?: boolean;
  /** Free-form extension bag; reserved for future collab/AI fields. */
  [key: string]: unknown;
}

export function isChangeSource(value: unknown): value is ChangeSource {
  return typeof value === 'string' && CHANGE_SOURCES.has(value);
}

export function isChangeOrigin(value: unknown): value is ChangeOrigin {
  return typeof value === 'string' && CHANGE_ORIGINS.has(value);
}

/**
 * Normalize trusted in-process meta (local apply / providers).
 * Does not strip unknown keys — callers control the bag.
 */
export function normalizeChangeMeta(
  partial: Partial<ChangeMeta> | undefined,
  defaults: Pick<ChangeMeta, 'source' | 'origin'>,
): ChangeMeta {
  const source = isChangeSource(partial?.source)
    ? partial!.source
    : defaults.source;
  const origin = isChangeOrigin(partial?.origin)
    ? partial!.origin
    : defaults.origin;
  const result: ChangeMeta = {
    ...partial,
    source,
    origin,
  };
  const confidence = sanitizeConfidence(partial?.confidence);
  if (confidence !== undefined) {
    result.confidence = confidence;
  } else {
    delete result.confidence;
  }
  return result;
}

/**
 * Sanitize metadata from untrusted wire (parseChangeProposal / remote envelopes).
 * - Allowlists known fields only (no arbitrary executable bag keys)
 * - Enum-checks source/origin
 * - Drops non-finite / out-of-range confidence
 * - Truncates oversized strings
 * - Marks `untrustedInput: true`
 *
 * Never executes explanation/provider/model text.
 */
export function sanitizeUntrustedChangeMeta(
  raw: unknown,
  defaults: Pick<ChangeMeta, 'source' | 'origin'> = {
    source: 'api',
    origin: 'system',
  },
): ChangeMeta {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  // Explicit field extraction — do not invoke methods from the payload.
  const source = isChangeSource(obj.source) ? obj.source : defaults.source;
  const origin = isChangeOrigin(obj.origin) ? obj.origin : defaults.origin;

  const meta: ChangeMeta = {
    source,
    origin,
    untrustedInput: true,
  };

  const authorId = asBoundedString(obj.authorId, UNTRUSTED_META_LIMITS.authorId);
  if (authorId !== undefined) meta.authorId = authorId;

  const intent = asBoundedString(obj.intent, UNTRUSTED_META_LIMITS.intent);
  if (intent !== undefined) meta.intent = intent;

  const provider = asBoundedString(obj.provider, UNTRUSTED_META_LIMITS.provider);
  if (provider !== undefined) meta.provider = provider;

  const model = asBoundedString(obj.model, UNTRUSTED_META_LIMITS.model);
  if (model !== undefined) meta.model = model;

  const explanation = asBoundedString(
    obj.explanation,
    UNTRUSTED_META_LIMITS.explanation,
  );
  if (explanation !== undefined) meta.explanation = explanation;

  const requestId = asBoundedString(
    obj.requestId,
    UNTRUSTED_META_LIMITS.requestId,
  );
  if (requestId !== undefined) meta.requestId = requestId;

  const generatedAt = asBoundedString(
    obj.generatedAt,
    UNTRUSTED_META_LIMITS.generatedAt,
  );
  if (generatedAt !== undefined) meta.generatedAt = generatedAt;

  const confidence = sanitizeConfidence(obj.confidence);
  if (confidence !== undefined) meta.confidence = confidence;

  // Opaque remote changeId correlation (string only).
  const changeId = asBoundedString(obj.changeId, 256);
  if (changeId !== undefined) meta.changeId = changeId;

  return meta;
}

/** Finite confidence in [0, 1], else undefined (dropped — never grants authority). */
export function sanitizeConfidence(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 0 || value > 1) return undefined;
  return value;
}

function asBoundedString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.length === 0) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}
