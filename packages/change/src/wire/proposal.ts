/**
 * ChangeProposal wire serialize / parse (ADR-012).
 */
import ChangeSet from '../change/change-set.js';
import {
  sanitizeUntrustedChangeMeta,
  type ChangeMeta,
} from '../experimental/change-meta.js';
import {
  ChangeProposal,
  createChangeProposal,
  createProposalId,
} from '../experimental/proposal.js';
import { WireError } from './errors.js';
import {
  asRecord,
  assertWireId,
  parseJsonInput,
  parseWireOps,
  serializeWireOps,
} from './ops.js';
import {
  WIRE_LIMITS,
  WIRE_SCHEMA_VERSION,
  isSupportedWireSchemaVersion,
  type WireSchemaVersion,
} from './schema.js';

export interface SerializedChangeProposalV1 {
  schemaVersion: WireSchemaVersion;
  kind: 'proposal';
  id: string;
  documentId: string;
  baseVersionId: string;
  /** Nested ChangeSet wire fragment (ops only under change). */
  change: { ops: ReturnType<typeof serializeWireOps> };
  meta: ChangeMeta;
  createdAt: string;
}

export function serializeChangeProposal(
  proposal: ChangeProposal,
): SerializedChangeProposalV1 & { ops: ReturnType<typeof serializeWireOps> } {
  const ops = serializeWireOps(proposal.change.ops);
  return {
    schemaVersion: WIRE_SCHEMA_VERSION,
    kind: 'proposal',
    id: proposal.id,
    documentId: proposal.documentId,
    baseVersionId: proposal.baseVersionId,
    change: { ops },
    /** Legacy alias of change.ops (migration). */
    ops,
    meta: { ...proposal.meta },
    createdAt: proposal.createdAt,
  };
}

/**
 * Parse proposal wire JSON.
 * Always marks meta untrustedInput when parsed from wire.
 * Accepts ADR-012 shape and legacy experimental `{ ops, … }` without schemaVersion.
 */
export function parseChangeProposalWire(
  input: SerializedChangeProposalV1 | string | unknown,
): ChangeProposal {
  const data = parseJsonInput(input);
  const obj = asRecord(data, 'proposal');

  if (obj.kind != null && obj.kind !== 'proposal') {
    throw new WireError(
      'unsupported_kind',
      `wire: expected kind "proposal", got ${String(obj.kind)}`,
    );
  }

  if (obj.schemaVersion != null && !isSupportedWireSchemaVersion(obj.schemaVersion)) {
    throw new WireError(
      'unknown_schema_version',
      `wire: unsupported schemaVersion ${String(obj.schemaVersion)}`,
    );
  }

  const documentId = assertWireId(obj.documentId, 'documentId');
  const baseVersionId = assertWireId(obj.baseVersionId, 'baseVersionId');

  let ops: unknown;
  if (
    obj.change &&
    typeof obj.change === 'object' &&
    !Array.isArray(obj.change) &&
    Array.isArray((obj.change as { ops?: unknown }).ops)
  ) {
    ops = (obj.change as { ops: unknown }).ops;
  } else if (Array.isArray(obj.ops)) {
    ops = obj.ops;
  } else {
    throw new WireError(
      'missing_field',
      'wire: proposal missing change.ops (or legacy ops)',
    );
  }

  const change = new ChangeSet(parseWireOps(ops));
  const meta = sanitizeUntrustedChangeMeta(obj.meta);

  const id =
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    obj.id.length <= WIRE_LIMITS.maxIdLength
      ? obj.id
      : createProposalId();

  const createdAt =
    typeof obj.createdAt === 'string' &&
    obj.createdAt.length > 0 &&
    obj.createdAt.length <= WIRE_LIMITS.maxCreatedAtLength
      ? obj.createdAt
      : new Date().toISOString();

  return createChangeProposal({
    id,
    documentId,
    baseVersionId,
    change,
    meta,
    createdAt,
  });
}

export function proposalsEqual(a: ChangeProposal, b: ChangeProposal): boolean {
  const normMeta = (m: ChangeMeta) => {
    const { untrustedInput: _u, ...rest } = m;
    return rest;
  };
  return (
    a.id === b.id &&
    a.documentId === b.documentId &&
    a.baseVersionId === b.baseVersionId &&
    a.createdAt === b.createdAt &&
    JSON.stringify(a.change.ops) === JSON.stringify(b.change.ops) &&
    JSON.stringify(normMeta(a.meta)) === JSON.stringify(normMeta(b.meta))
  );
}
