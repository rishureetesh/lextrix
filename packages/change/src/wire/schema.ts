/**
 * Lextrix wire schema constants (ADR-012).
 * schemaVersion versions the *wire document envelope*, not Document.revision.
 */

/** Current normative wire schema version. */
export const WIRE_SCHEMA_VERSION = 1 as const;

/** Schemas this implementation can parse. */
export const SUPPORTED_WIRE_SCHEMA_VERSIONS = [1] as const;

export type WireSchemaVersion = (typeof SUPPORTED_WIRE_SCHEMA_VERSIONS)[number];

export type WireDocumentKind =
  | 'changeset'
  | 'version'
  | 'proposal'
  | 'collab-envelope';

/** Shared size / complexity caps for untrusted wire (ADR-012 / ADR-015). */
export const WIRE_LIMITS = {
  maxOps: 4096,
  maxInsertChars: 256 * 1024,
  maxSingleInsertChars: 64 * 1024,
  maxIdLength: 256,
  maxDependsOn: 256,
  maxEmbedJsonChars: 16 * 1024,
  maxEmbedKeys: 64,
  maxAttributeKeys: 64,
  maxCreatedAtLength: 64,
} as const;

export function isSupportedWireSchemaVersion(
  value: unknown,
): value is WireSchemaVersion {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (SUPPORTED_WIRE_SCHEMA_VERSIONS as readonly number[]).includes(value)
  );
}
