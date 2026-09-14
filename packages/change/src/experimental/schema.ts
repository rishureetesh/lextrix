/**
 * Minimal schema for Phase 1 DocumentState validation.
 */
import type ChangeSet from '../change/change-set.js';

export type SchemaValidationResult =
  | { ok: true }
  | { ok: false; issues: string[] };

export interface DocumentSchema {
  readonly name: string;
  validate(contents: ChangeSet): SchemaValidationResult;
}

/**
 * Default schema: contents must be insert-only (a document ChangeSet).
 * Prefer a trailing newline (warning-level not enforced as hard error if empty ops already normalized).
 */
export const DEFAULT_DOCUMENT_SCHEMA: DocumentSchema = {
  name: 'default',
  validate(contents: ChangeSet): SchemaValidationResult {
    const issues: string[] = [];
    for (let i = 0; i < contents.ops.length; i += 1) {
      const op = contents.ops[i]!;
      if (op.delete != null) {
        issues.push(`op[${i}] is a delete — documents must be insert-only`);
      }
      if (op.retain != null && op.insert == null) {
        issues.push(`op[${i}] is a retain — documents must be insert-only`);
      }
      if (op.insert == null && op.delete == null && op.retain == null) {
        issues.push(`op[${i}] is empty`);
      }
    }
    if (contents.ops.length === 0) {
      issues.push('document has no ops');
    }
    return issues.length === 0 ? { ok: true } : { ok: false, issues };
  },
};
