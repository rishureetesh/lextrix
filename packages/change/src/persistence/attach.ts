/**
 * Attach persistence as a Handle observer consumer (ADR-018 Model B).
 * Does not change Handle.apply semantics. Persist failure → dirty, no rollback.
 */
import type { DocumentChangeEvent } from '../experimental/document-event.js';
import type { DocumentHandle } from '../experimental/document-handle.js';
import type { DocumentVersion } from '../experimental/version.js';
import { PersistenceError } from './errors.js';
import type { DocumentPersistence } from './types.js';

export interface PersistenceAttachment {
  /** Versions committed in-memory but not yet successfully persisted. */
  getDirtyVersions(): readonly DocumentVersion[];
  /** Latest Version known persisted (null if none). */
  getDurableHead(): DocumentVersion | null;
  /** True when dirty queue non-empty. */
  isDirty(): boolean;
  /** Retry append for all dirty Versions in order. */
  flush(): Promise<void>;
  /** Last persistence failure (if any). */
  getLastError(): unknown;
  unsubscribe(): void;
}

export interface AttachPersistenceOptions {
  /** Known durable HEAD before attachment (e.g. last successfully loaded Version). */
  initialDurableHead?: DocumentVersion | null;
  /**
   * Called when append fails after Document commit (durability lag).
   * Handle remains valid.
   */
  onDurabilityLag?: (info: {
    version: DocumentVersion;
    error: unknown;
    dirty: readonly DocumentVersion[];
  }) => void;
}

/**
 * Subscribe to Handle applied/restored events and append Versions.
 * Persistence errors do not roll back the Handle and are not rethrown into
 * the observer notification path (durability ≠ observer failure).
 */
export function attachPersistence(
  handle: DocumentHandle,
  persistence: DocumentPersistence,
  options: AttachPersistenceOptions = {},
): PersistenceAttachment {
  const dirty: DocumentVersion[] = [];
  let durableHead: DocumentVersion | null = options.initialDurableHead ?? null;
  let lastError: unknown;
  let closed = false;

  const markDirty = (version: DocumentVersion, err: unknown): void => {
    lastError = err;
    if (!dirty.some((v) => v.id === version.id)) {
      dirty.push(version);
    }
    options.onDurabilityLag?.({
      version,
      error: err,
      dirty: [...dirty],
    });
  };

  const markClean = (version: DocumentVersion): void => {
    const idx = dirty.findIndex((v) => v.id === version.id);
    if (idx >= 0) dirty.splice(idx, 1);
    if (durableHead == null || version.sequence >= durableHead.sequence) {
      durableHead = version;
    }
    lastError = undefined;
  };

  const unsub = handle.subscribe((event: DocumentChangeEvent) => {
    if (closed) return;
    const version = event.version;
    try {
      const result = persistence.appendVersion(version);
      if (result != null && typeof (result as Promise<void>).then === 'function') {
        if (!dirty.some((v) => v.id === version.id)) {
          dirty.push(version);
        }
        void (result as Promise<void>).then(
          () => markClean(version),
          (err: unknown) => markDirty(version, err),
        );
        return;
      }
      markClean(version);
    } catch (err) {
      // swallow — durability lag is recorded, Handle commit stays valid
      markDirty(version, err);
    }
  });

  return {
    getDirtyVersions: () => Object.freeze([...dirty]),
    getDurableHead: () => durableHead,
    isDirty: () => dirty.length > 0,
    getLastError: () => lastError,
    async flush() {
      const pending = [...dirty];
      for (const v of pending) {
        try {
          await Promise.resolve(persistence.appendVersion(v));
          markClean(v);
        } catch (err) {
          markDirty(v, err);
          throw err;
        }
      }
      if (dirty.length > 0) {
        throw new PersistenceError(
          'persistence_error',
          'flush incomplete: dirty Versions remain',
          { cause: lastError },
        );
      }
    },
    unsubscribe() {
      closed = true;
      unsub();
    },
  };
}
