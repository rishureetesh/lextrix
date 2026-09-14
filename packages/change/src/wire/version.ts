/**
 * DocumentVersion wire serialize / parse (ADR-012).
 *
 * Persistence model: self-contained snapshot + optional lineage.
 *   contents          → full DocumentState (insert-only ChangeSet)
 *   changeFromParent  → transition from parent (null for root)
 *   parentId          → previous Version id (null for root)
 *
 * Does NOT redesign snapshot storage; full contents remain authoritative state.
 */
import ChangeSet from '../change/change-set.js';
import {
  sanitizeUntrustedChangeMeta,
  type ChangeMeta,
} from '../experimental/change-meta.js';
import { DocumentVersion } from '../experimental/version.js';
import { parseChangeSet, serializeChangeSet } from './changeset.js';
import { WireError } from './errors.js';
import {
  asRecord,
  assertWireId,
  parseJsonInput,
  parseWireOps,
  serializeWireOps,
} from './ops.js';
import {
  WIRE_SCHEMA_VERSION,
  isSupportedWireSchemaVersion,
  type WireSchemaVersion,
} from './schema.js';

export interface SerializedDocumentVersion {
  schemaVersion: WireSchemaVersion;
  kind: 'version';
  /** Identity: unique Version id within a document lineage. */
  id: string;
  documentId: string;
  /** Lineage ordinal: 0-based index in the linear chain for this document. */
  sequence: number;
  /** Sync metadata: Document.revision at snapshot time (may align with sequence). */
  revision: number;
  parentId: string | null;
  /** Full DocumentState snapshot (insert-only ops). */
  contents: { ops: ReturnType<typeof serializeWireOps> };
  /** Transition from parent; null for root. */
  changeFromParent: { ops: ReturnType<typeof serializeWireOps> } | null;
  meta: ChangeMeta | null;
}

function assertNonNegInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new WireError('invalid_type', `wire: invalid ${field}`);
  }
  return value;
}

export function serializeDocumentVersion(
  version: DocumentVersion,
): SerializedDocumentVersion {
  return {
    schemaVersion: WIRE_SCHEMA_VERSION,
    kind: 'version',
    id: version.id,
    documentId: version.documentId,
    sequence: version.sequence,
    revision: version.revision,
    parentId: version.parentId,
    contents: { ops: serializeWireOps(version.contents.ops) },
    changeFromParent:
      version.changeFromParent == null
        ? null
        : { ops: serializeWireOps(version.changeFromParent.ops) },
    meta: version.meta == null ? null : { ...version.meta },
  };
}

/**
 * Parse a Version wire document into a DocumentVersion instance.
 * Untrusted: sanitizes meta; validates ops; does not mutate any Document.
 */
export function parseDocumentVersion(
  input: SerializedDocumentVersion | string | unknown,
): DocumentVersion {
  const data = parseJsonInput(input);
  const obj = asRecord(data, 'version');

  if (obj.kind != null && obj.kind !== 'version') {
    throw new WireError(
      'unsupported_kind',
      `wire: expected kind "version", got ${String(obj.kind)}`,
    );
  }

  if (obj.schemaVersion == null) {
    // Legacy DocumentVersion.toJSON: { id, documentId, sequence, revision, parentId, ops, meta }
    return parseLegacyVersion(obj);
  }

  if (!isSupportedWireSchemaVersion(obj.schemaVersion)) {
    throw new WireError(
      'unknown_schema_version',
      `wire: unsupported schemaVersion ${String(obj.schemaVersion)}`,
    );
  }

  const id = assertWireId(obj.id, 'id');
  const documentId = assertWireId(obj.documentId, 'documentId');
  const sequence = assertNonNegInt(obj.sequence, 'sequence');
  const revision = assertNonNegInt(obj.revision, 'revision');

  let parentId: string | null = null;
  if (obj.parentId != null) {
    parentId = assertWireId(obj.parentId, 'parentId');
  }

  const contentsRaw = obj.contents;
  let contentsOps: unknown;
  if (
    contentsRaw &&
    typeof contentsRaw === 'object' &&
    !Array.isArray(contentsRaw) &&
    Array.isArray((contentsRaw as { ops?: unknown }).ops)
  ) {
    contentsOps = (contentsRaw as { ops: unknown }).ops;
  } else if (Array.isArray(obj.ops)) {
    // Tolerate contents flattened as ops (compat).
    contentsOps = obj.ops;
  } else {
    throw new WireError('missing_field', 'wire: version missing contents.ops');
  }

  const contents = new ChangeSet(parseWireOps(contentsOps)).freeze();

  let changeFromParent: ChangeSet | null = null;
  if (obj.changeFromParent != null) {
    const cfp = obj.changeFromParent;
    if (typeof cfp !== 'object' || Array.isArray(cfp)) {
      throw new WireError('invalid_type', 'wire: invalid changeFromParent');
    }
    const cfpOps = (cfp as { ops?: unknown }).ops;
    if (!Array.isArray(cfpOps)) {
      throw new WireError(
        'missing_field',
        'wire: changeFromParent missing ops',
      );
    }
    changeFromParent = new ChangeSet(parseWireOps(cfpOps)).freeze();
  }

  const meta =
    obj.meta == null
      ? null
      : sanitizeUntrustedChangeMeta(obj.meta);

  return new DocumentVersion({
    id,
    documentId,
    sequence,
    revision,
    contents,
    parentId,
    changeFromParent,
    meta,
  });
}

function parseLegacyVersion(obj: Record<string, unknown>): DocumentVersion {
  const id = assertWireId(obj.id, 'id');
  const documentId = assertWireId(obj.documentId, 'documentId');
  const sequence = assertNonNegInt(obj.sequence, 'sequence');
  const revision = assertNonNegInt(obj.revision, 'revision');
  let parentId: string | null = null;
  if (obj.parentId != null) {
    parentId = assertWireId(obj.parentId, 'parentId');
  }
  if (!Array.isArray(obj.ops)) {
    throw new WireError('missing_field', 'wire: legacy version missing ops');
  }
  const contents = new ChangeSet(parseWireOps(obj.ops)).freeze();
  // Legacy JSON omitted changeFromParent — lineage incomplete.
  const changeFromParent =
    obj.changeFromParent != null &&
    typeof obj.changeFromParent === 'object' &&
    !Array.isArray(obj.changeFromParent) &&
    Array.isArray((obj.changeFromParent as { ops?: unknown }).ops)
      ? new ChangeSet(
          parseWireOps((obj.changeFromParent as { ops: unknown }).ops),
        ).freeze()
      : null;
  const meta =
    obj.meta == null ? null : sanitizeUntrustedChangeMeta(obj.meta);
  return new DocumentVersion({
    id,
    documentId,
    sequence,
    revision,
    contents,
    parentId,
    changeFromParent,
    meta,
  });
}

function metaEqualForWire(
  a: ChangeMeta | null | undefined,
  b: ChangeMeta | null | undefined,
): boolean {
  const norm = (m: ChangeMeta | null | undefined) => {
    if (m == null) return null;
    const { untrustedInput: _u, ...rest } = m;
    return rest;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export function documentVersionsEqual(
  a: DocumentVersion,
  b: DocumentVersion,
): boolean {
  return (
    a.id === b.id &&
    a.documentId === b.documentId &&
    a.sequence === b.sequence &&
    a.revision === b.revision &&
    a.parentId === b.parentId &&
    JSON.stringify(a.contents.ops) === JSON.stringify(b.contents.ops) &&
    JSON.stringify(a.changeFromParent?.ops ?? null) ===
      JSON.stringify(b.changeFromParent?.ops ?? null) &&
    metaEqualForWire(a.meta, b.meta)
  );
}

/** Re-export for callers reconstructing contents-only blobs. */
export { parseChangeSet, serializeChangeSet };
