/**
 * Persistence errors (Phase 9 / ADR-018).
 */
export type PersistenceErrorCode =
  | 'persistence_error'
  | 'persistence_conflict'
  | 'cas_conflict'
  | 'not_found'
  | 'invalid_argument';

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  readonly compatibility: 'stable' = 'stable';
  readonly causeError?: unknown;

  constructor(
    code: PersistenceErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
    this.causeError = options?.cause;
  }
}
