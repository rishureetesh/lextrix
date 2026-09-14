/**
 * Collaboration envelope wire serialize / parse (ADR-012).
 * Transport is outside the engine — this is the portable contract only.
 */
import ChangeSet from '../change/change-set.js';
import {
  sanitizeUntrustedChangeMeta,
  type ChangeMeta,
} from '../experimental/change-meta.js';
import type { CollabEnvelope } from '../experimental/collaboration.js';
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

export interface SerializedCollabEnvelope {
  schemaVersion: WireSchemaVersion;
  kind: 'collab-envelope';
  changeId: string;
  documentId: string;
  baseVersionId: string;
  change: { ops: ReturnType<typeof serializeWireOps> };
  meta: ChangeMeta;
  dependsOn: string[];
}

export function serializeCollabEnvelope(
  envelope: CollabEnvelope,
): SerializedCollabEnvelope {
  return {
    schemaVersion: WIRE_SCHEMA_VERSION,
    kind: 'collab-envelope',
    changeId: envelope.changeId,
    documentId: envelope.documentId,
    baseVersionId: envelope.baseVersionId,
    change: { ops: serializeWireOps(envelope.change.ops) },
    meta: sanitizeUntrustedChangeMeta(envelope.meta, {
      source: 'remote',
      origin: 'system',
    }),
    dependsOn: [...envelope.dependsOn],
  };
}

/**
 * Parse a collab envelope from wire.
 * Meta is always sanitized; caller/adapters may still force source:remote.
 */
export function parseCollabEnvelope(
  input: SerializedCollabEnvelope | string | unknown,
): CollabEnvelope {
  const data = parseJsonInput(input);
  const obj = asRecord(data, 'collab-envelope');

  if (obj.kind != null && obj.kind !== 'collab-envelope') {
    throw new WireError(
      'unsupported_kind',
      `wire: expected kind "collab-envelope", got ${String(obj.kind)}`,
    );
  }

  if (obj.schemaVersion == null) {
    // Allow legacy in-memory-shaped objects without schemaVersion.
  } else if (!isSupportedWireSchemaVersion(obj.schemaVersion)) {
    throw new WireError(
      'unknown_schema_version',
      `wire: unsupported schemaVersion ${String(obj.schemaVersion)}`,
    );
  }

  const changeId = assertWireId(obj.changeId, 'changeId');
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
      'wire: collab-envelope missing change.ops',
    );
  }

  if (!Array.isArray(obj.dependsOn)) {
    throw new WireError('missing_field', 'wire: collab-envelope missing dependsOn');
  }
  if (obj.dependsOn.length > WIRE_LIMITS.maxDependsOn) {
    throw new WireError(
      'limit_exceeded',
      `wire: dependsOn exceeds ${WIRE_LIMITS.maxDependsOn}`,
    );
  }
  const dependsOn: string[] = [];
  for (let i = 0; i < obj.dependsOn.length; i += 1) {
    dependsOn.push(assertWireId(obj.dependsOn[i], `dependsOn[${i}]`));
  }

  const meta = sanitizeUntrustedChangeMeta(obj.meta, {
    source: 'remote',
    origin: 'system',
  });

  return {
    changeId,
    documentId,
    baseVersionId,
    change: new ChangeSet(parseWireOps(ops)),
    meta,
    dependsOn,
  };
}

export function collabEnvelopesEqual(
  a: CollabEnvelope,
  b: CollabEnvelope,
): boolean {
  return (
    a.changeId === b.changeId &&
    a.documentId === b.documentId &&
    a.baseVersionId === b.baseVersionId &&
    JSON.stringify(a.dependsOn) === JSON.stringify(b.dependsOn) &&
    JSON.stringify(a.change.ops) === JSON.stringify(b.change.ops) &&
    JSON.stringify(a.meta) === JSON.stringify(b.meta)
  );
}
