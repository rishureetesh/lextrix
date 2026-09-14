/**
 * Document lifecycle / tombstones (ADR-035).
 */
import { PersistenceError } from './errors.js';

export type DocumentLifecycleState =
  | 'active'
  | 'tombstoned'
  | 'archived'
  | 'purged';

export interface DocumentLifecycle {
  getState(
    documentId: string,
  ): Promise<DocumentLifecycleState> | DocumentLifecycleState;
  tombstone(documentId: string): Promise<void> | void;
  archive(documentId: string): Promise<void> | void;
  purge(documentId: string): Promise<void> | void;
  /** Optional recovery from tombstone → active (before archive/purge). */
  revive?(documentId: string): Promise<void> | void;
}

const ALLOWED: Record<
  DocumentLifecycleState,
  readonly DocumentLifecycleState[]
> = {
  active: ['tombstoned'],
  tombstoned: ['archived', 'active'],
  archived: ['purged'],
  purged: [],
};

export class InMemoryDocumentLifecycle implements DocumentLifecycle {
  private readonly states = new Map<string, DocumentLifecycleState>();

  getState(documentId: string): DocumentLifecycleState {
    return this.states.get(documentId) ?? 'active';
  }

  tombstone(documentId: string): void {
    this.transition(documentId, 'tombstoned');
  }

  archive(documentId: string): void {
    this.transition(documentId, 'archived');
  }

  purge(documentId: string): void {
    this.transition(documentId, 'purged');
  }

  revive(documentId: string): void {
    this.transition(documentId, 'active');
  }

  private transition(
    documentId: string,
    next: DocumentLifecycleState,
  ): void {
    const cur = this.getState(documentId);
    if (cur === next) return;
    if (!ALLOWED[cur].includes(next)) {
      throw new PersistenceError(
        'invalid_argument',
        `lifecycle: cannot transition ${cur} → ${next}`,
      );
    }
    this.states.set(documentId, next);
  }

  clear(): void {
    this.states.clear();
  }
}

export function assertDocumentMutable(
  state: DocumentLifecycleState,
  documentId: string,
): void {
  if (state !== 'active') {
    throw new PersistenceError(
      'invalid_argument',
      `document ${documentId} is ${state}; mutations rejected`,
    );
  }
}
