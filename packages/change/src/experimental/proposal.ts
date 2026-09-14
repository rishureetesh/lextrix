/**
 * Experimental ChangeProposal — uncommitted ChangeSet against a base Version.
 * Proposal ≠ ChangeSet ≠ Version ≠ History. No automatic rebase.
 * AI / agents / imports are proposal *producers* — not mutation paths (ADR-009).
 *
 * Canonical wire format: `lextrix-change/wire` (ADR-012).
 * {@link parseChangeProposal} lives in `./parse-change-proposal.ts` to avoid cycles.
 */
import ChangeSet from '../change/change-set.js';
import type ChangeOp from '../change/change-op.js';
import { WIRE_LIMITS, WIRE_SCHEMA_VERSION } from '../wire/schema.js';
import {
  normalizeChangeMeta,
  type ChangeMeta,
} from './change-meta.js';

let proposalIdCounter = 0;

/** Soft caps for untrusted serialized proposals — aligned with ADR-012 WIRE_LIMITS. */
export const UNTRUSTED_PROPOSAL_LIMITS = {
  maxOps: WIRE_LIMITS.maxOps,
  maxInsertChars: WIRE_LIMITS.maxInsertChars,
  maxSingleInsertChars: WIRE_LIMITS.maxSingleInsertChars,
  maxIdLength: WIRE_LIMITS.maxIdLength,
} as const;

export function createProposalId(): string {
  proposalIdCounter += 1;
  return `prop_${Date.now().toString(36)}_${proposalIdCounter.toString(36)}`;
}

export type ProposalValidationCode =
  | 'ok'
  | 'wrong_document'
  | 'unknown_version'
  | 'stale'
  | 'invalid_change'
  | 'transaction_open'
  | 'invalid_serialized';

export type ProposalValidationResult =
  | { ok: true }
  | { ok: false; code: Exclude<ProposalValidationCode, 'ok'>; message: string };

/** Inspect without requiring base === HEAD (review / AI stale-proposal workflow). */
export type ProposalInspectResult =
  | {
      ok: true;
      /** True when baseVersionId ≠ current HEAD. */
      stale: boolean;
      baseVersionId: string;
      headVersionId: string;
    }
  | {
      ok: false;
      code: Exclude<ProposalValidationCode, 'ok' | 'stale'>;
      message: string;
    };

export interface CreateChangeProposalOptions {
  documentId: string;
  baseVersionId: string;
  change: ChangeSet;
  meta?: Partial<ChangeMeta>;
  id?: string;
  /** Optional ISO timestamp; defaults to now. */
  createdAt?: string;
}

/**
 * JSON-safe proposal wire shape (ADR-012 schemaVersion 1).
 * `ops` is retained as a legacy alias of `change.ops` for migration.
 */
export interface SerializedChangeProposal {
  schemaVersion: typeof WIRE_SCHEMA_VERSION;
  kind: 'proposal';
  id: string;
  documentId: string;
  baseVersionId: string;
  change: { ops: ChangeOp[] };
  /** @deprecated Prefer `change.ops`. Kept for one-schema migration compatibility. */
  ops: ChangeOp[];
  meta: ChangeMeta;
  createdAt: string;
}

/**
 * Intent to apply a ChangeSet to a specific document Version.
 * Untrusted until validated by the Document engine.
 */
export class ChangeProposal {
  readonly id: string;
  readonly documentId: string;
  readonly baseVersionId: string;
  readonly change: ChangeSet;
  readonly meta: ChangeMeta;
  readonly createdAt: string;

  constructor(init: {
    id: string;
    documentId: string;
    baseVersionId: string;
    change: ChangeSet;
    meta: ChangeMeta;
    createdAt: string;
  }) {
    this.id = init.id;
    this.documentId = init.documentId;
    this.baseVersionId = init.baseVersionId;
    this.change = init.change;
    this.meta = init.meta;
    this.createdAt = init.createdAt;
  }

  toJSON(): SerializedChangeProposal {
    const ops = this.change.ops.map((op) => {
      const next: ChangeOp = { ...op };
      if (op.attributes) next.attributes = { ...op.attributes };
      if (op.insert && typeof op.insert === 'object') {
        next.insert = { ...(op.insert as Record<string, unknown>) };
      }
      if (op.retain && typeof op.retain === 'object') {
        next.retain = { ...(op.retain as Record<string, unknown>) };
      }
      return next;
    });
    return {
      schemaVersion: WIRE_SCHEMA_VERSION,
      kind: 'proposal',
      id: this.id,
      documentId: this.documentId,
      baseVersionId: this.baseVersionId,
      change: { ops },
      ops,
      meta: { ...this.meta },
      createdAt: this.createdAt,
    };
  }
}

export function createChangeProposal(
  options: CreateChangeProposalOptions,
): ChangeProposal {
  if (!options.documentId || typeof options.documentId !== 'string') {
    throw new Error('createChangeProposal: documentId required');
  }
  if (!options.baseVersionId || typeof options.baseVersionId !== 'string') {
    throw new Error('createChangeProposal: baseVersionId required');
  }
  const change =
    options.change instanceof ChangeSet
      ? options.change.clone().freeze()
      : new ChangeSet(options.change).freeze();
  const meta = Object.freeze(
    normalizeChangeMeta(options.meta, {
      source: options.meta?.source ?? 'api',
      origin: options.meta?.origin ?? 'system',
    }),
  ) as ChangeMeta;
  return new ChangeProposal({
    id: options.id ?? createProposalId(),
    documentId: options.documentId,
    baseVersionId: options.baseVersionId,
    change,
    meta,
    createdAt: options.createdAt ?? new Date().toISOString(),
  });
}

export class ProposalError extends Error {
  readonly code: Exclude<ProposalValidationCode, 'ok'>;

  constructor(code: Exclude<ProposalValidationCode, 'ok'>, message: string) {
    super(message);
    this.name = 'ProposalError';
    this.code = code;
  }
}
