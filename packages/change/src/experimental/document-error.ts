/**
 * Typed runtime errors for Document / DocumentHandle (Phase 8–9).
 * Compatibility: `code` values are stable for the runtime contract.
 */
export type DocumentErrorCode =
  | 'transaction_open'
  | 'nested_transaction'
  | 'wrong_document'
  | 'unknown_version'
  | 'version_unavailable'
  | 'reference_unavailable'
  | 'document_tombstoned'
  | 'invalid_state'
  | 'reentrancy'
  | 'observer_failed'
  | 'invalid_argument'
  | 'lineage_error'
  | 'hydration_error';

export class DocumentError extends Error {
  readonly code: DocumentErrorCode;
  readonly compatibility: 'stable' = 'stable';
  /** Present when code is observer_failed — first listener error. */
  readonly causeError?: unknown;

  constructor(
    code: DocumentErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = 'DocumentError';
    this.code = code;
    this.causeError = options?.cause;
  }
}
