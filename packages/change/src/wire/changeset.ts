/**
 * ChangeSet wire serialize / parse (ADR-012).
 */
import ChangeSet from '../change/change-set.js';
import { WireError } from './errors.js';
import {
  asRecord,
  parseJsonInput,
  parseWireOps,
  serializeWireOps,
} from './ops.js';
import {
  WIRE_SCHEMA_VERSION,
  isSupportedWireSchemaVersion,
  type WireSchemaVersion,
} from './schema.js';

export interface SerializedChangeSet {
  schemaVersion: WireSchemaVersion;
  kind: 'changeset';
  ops: ReturnType<typeof serializeWireOps>;
}

export function serializeChangeSet(change: ChangeSet): SerializedChangeSet {
  return {
    schemaVersion: WIRE_SCHEMA_VERSION,
    kind: 'changeset',
    ops: serializeWireOps(change.ops),
  };
}

export function parseChangeSet(input: SerializedChangeSet | string | unknown): ChangeSet {
  const data = parseJsonInput(input);

  // Legacy: bare ops array (pre-ADR-012 experimental) → schema v1.
  if (Array.isArray(data)) {
    return new ChangeSet(parseWireOps(data));
  }

  const obj = asRecord(data, 'changeset');

  if (obj.kind != null && obj.kind !== 'changeset') {
    throw new WireError(
      'unsupported_kind',
      `wire: expected kind "changeset", got ${String(obj.kind)}`,
    );
  }

  if (obj.schemaVersion == null) {
    // Legacy object with only ops.
    if (!Array.isArray(obj.ops)) {
      throw new WireError('missing_field', 'wire: changeset missing ops');
    }
    return new ChangeSet(parseWireOps(obj.ops));
  }

  if (!isSupportedWireSchemaVersion(obj.schemaVersion)) {
    throw new WireError(
      'unknown_schema_version',
      `wire: unsupported schemaVersion ${String(obj.schemaVersion)}`,
    );
  }

  if (!Array.isArray(obj.ops)) {
    throw new WireError('missing_field', 'wire: changeset missing ops');
  }

  return new ChangeSet(parseWireOps(obj.ops));
}

/** Semantic equality: same ops JSON (order-sensitive). */
export function changeSetsEqual(a: ChangeSet, b: ChangeSet): boolean {
  return JSON.stringify(a.ops) === JSON.stringify(b.ops);
}
