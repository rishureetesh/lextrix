/**
 * Wire parse / validation errors (ADR-012).
 * Compatibility: `code` values are stable for schemaVersion 1.
 */

export type WireErrorCode =
  | 'invalid_json'
  | 'invalid_type'
  | 'missing_field'
  | 'unknown_schema_version'
  | 'unsupported_kind'
  | 'malformed_op'
  | 'limit_exceeded'
  | 'forbidden_key'
  | 'invalid_id'
  | 'invalid_meta';

export class WireError extends Error {
  readonly code: WireErrorCode;
  /** Compatibility status for this code under the current WIRE_SCHEMA_VERSION. */
  readonly compatibility: 'stable';

  constructor(code: WireErrorCode, message: string) {
    super(message);
    this.name = 'WireError';
    this.code = code;
    this.compatibility = 'stable';
  }
}
