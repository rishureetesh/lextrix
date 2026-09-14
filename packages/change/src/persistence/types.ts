/**
 * Provider-neutral document persistence port (ADR-018).
 * Stores Versions — never mutates Documents.
 */
import type { DocumentVersion } from '../experimental/version.js';

export interface DocumentPersistence {
  /**
   * Append a Version. Idempotent on `version.id` when payload matches.
   * Conflicting same-id payload → PersistenceError persistence_conflict.
   */
  appendVersion(version: DocumentVersion): void | Promise<void>;

  /**
   * Load the linear Version chain for a document (sequence order).
   * Empty array if unknown. Optional headVersionId truncates to that id inclusive.
   */
  loadChain(
    documentId: string,
    headVersionId?: string,
  ): readonly DocumentVersion[] | Promise<readonly DocumentVersion[]>;
}
