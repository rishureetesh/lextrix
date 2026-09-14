/**
 * Phase 2 Strategy B + Phase 5B Hybrid B+:
 * - Local: editor-first → Document reconciliation
 * - External: Document.apply → editor projection (origin: projection)
 *
 * Never mutates Scroll / Blot / DOM from this module directly.
 */
import type ChangeSet from 'lextrix-change';
import type { EmitterSource } from '../emitter.js';
import {
  DocumentHandle,
  createDocument,
  type ChangeMeta,
  type ChangeSource,
  type Document,
  type DocumentVersion,
} from 'lextrix-change/experimental';

export type EditorBridgeOrigin = 'editor' | 'projection';

export interface ReconcileOptions {
  emitterSource: EmitterSource;
  /** Live editor document ChangeSet after mutation (for failure recovery). */
  liveContents: ChangeSet;
}

export type ProjectionStatus =
  | 'ok'
  | 'resync'
  | 'desync'
  | 'empty'
  | 'bridge_disabled';

export interface ExternalApplyResult {
  status: ProjectionStatus;
  version: DocumentVersion | null;
  applied: ChangeSet;
  /** True when Document advanced but editor contents still diverge. */
  desynchronized: boolean;
  error?: string;
}

function mapEmitterSource(source: EmitterSource): ChangeSource {
  if (source === 'user') return 'user';
  if (source === 'silent') return 'silent';
  return 'api';
}

function normalizeOps(ops: ChangeSet['ops']) {
  return ops.map((op) => {
    if (!op.attributes) return { ...op };
    const keys = Object.keys(op.attributes).sort();
    const attributes: Record<string, unknown> = {};
    for (const k of keys) attributes[k] = op.attributes[k];
    return { ...op, attributes };
  });
}

export function contentsEqual(a: ChangeSet, b: ChangeSet): boolean {
  return (
    JSON.stringify(normalizeOps(a.ops)) ===
    JSON.stringify(normalizeOps(b.ops))
  );
}

/**
 * Mirrors editor mutations into experimental DocumentState.
 * Synchronization direction for local edits: Editor → Document only.
 * External path uses {@link applyExternalChange} on Lextrix (Document → Editor).
 */
export class EditorDocumentBridge {
  private readonly handle: DocumentHandle;
  /**
   * When > 0, reconcile is skipped (projection-originated editor updates
   * that already applied to Document). Nesting-safe counter — not a boolean flag.
   */
  private projectionDepth = 0;
  private reconcileCount = 0;
  private resyncCount = 0;
  private projectionCount = 0;
  private lastDesync: string | null = null;

  constructor(initialContents: ChangeSet) {
    this.handle = DocumentHandle.create({
      contents: initialContents.clone(),
      validate: true,
    });
  }

  getDocument(): Document {
    return this.handle.document;
  }

  getHandle(): DocumentHandle {
    return this.handle;
  }

  getReconcileCount(): number {
    return this.reconcileCount;
  }

  getResyncCount(): number {
    return this.resyncCount;
  }

  getProjectionCount(): number {
    return this.projectionCount;
  }

  getProjectionDepth(): number {
    return this.projectionDepth;
  }

  isProjecting(): boolean {
    return this.projectionDepth > 0;
  }

  getLastDesyncReason(): string | null {
    return this.lastDesync;
  }

  /** @experimental Current mirrored Document Version. */
  currentVersion() {
    return this.handle.currentVersion();
  }

  /** @experimental List retained linear versions. */
  listVersions() {
    return this.handle.listVersions();
  }

  /**
   * Run an editor mutation that already applied the ChangeSet to Document
   * (Document-first / Hybrid B+ projection). Nested depth prevents feedback.
   * Always restores depth in `finally` so exceptions cannot stick the guard.
   */
  runAsProjection<T>(fn: () => T): T {
    this.projectionDepth += 1;
    try {
      return fn();
    } finally {
      this.projectionDepth -= 1;
    }
  }

  /**
   * Project a ChangeSet that **already** applied to Document (e.g. after
   * `acceptProposal`). Does not call Document.apply again — avoids double-apply.
   * Uses the same projectionDepth / runAsProjection guard as Hybrid B+.
   * Document is never rolled back if projection fails (returns `desync`).
   * Successful recovery via full resync returns `status: 'resync'`.
   */
  projectAppliedChange(
    change: ChangeSet,
    options: {
      project: (applied: ChangeSet) => void;
      resync: (documentContents: ChangeSet) => void;
      getEditorContents: () => ChangeSet;
    },
  ): ExternalApplyResult {
    if (change.length() === 0) {
      return {
        status: 'empty',
        version: this.handle.currentVersion(),
        applied: change,
        desynchronized: false,
      };
    }

    const version = this.handle.currentVersion();
    this.projectionCount += 1;
    return this.projectWithResync(change, version, options);
  }

  /**
   * Document-authoritative external apply (Hybrid B+).
   * Caller supplies `project` / `resync` that update the editor inside the
   * projection guard. Document is never rolled back if projection fails.
   */
  applyExternalChange(
    change: ChangeSet,
    options: {
      meta?: Partial<ChangeMeta>;
      project: (applied: ChangeSet) => void;
      resync: (documentContents: ChangeSet) => void;
      getEditorContents: () => ChangeSet;
    },
  ): ExternalApplyResult {
    if (change.length() === 0) {
      return {
        status: 'empty',
        version: this.handle.currentVersion(),
        applied: change,
        desynchronized: false,
      };
    }

    const meta: Partial<ChangeMeta> = {
      source: 'remote',
      origin: 'projection',
      ...options.meta,
    };

    this.handle.apply(change, { meta, validate: true });
    const version = this.handle.currentVersion();
    this.projectionCount += 1;
    return this.projectWithResync(change, version, options);
  }

  /**
   * Shared project → optional resync. Never mutates Document here.
   */
  private projectWithResync(
    change: ChangeSet,
    version: DocumentVersion,
    options: {
      project: (applied: ChangeSet) => void;
      resync: (documentContents: ChangeSet) => void;
      getEditorContents: () => ChangeSet;
    },
  ): ExternalApplyResult {
    let recoveredViaResync = false;

    try {
      this.runAsProjection(() => {
        options.project(change);
      });
    } catch {
      try {
        this.runAsProjection(() => {
          options.resync(this.handle.getContents().clone());
        });
        this.resyncCount += 1;
        recoveredViaResync = true;
      } catch (resyncErr) {
        const message =
          resyncErr instanceof Error ? resyncErr.message : String(resyncErr);
        this.lastDesync = message;
        return {
          status: 'desync',
          version,
          applied: change,
          desynchronized: true,
          error: message,
        };
      }
    }

    if (!contentsEqual(options.getEditorContents(), this.handle.getContents())) {
      try {
        this.runAsProjection(() => {
          options.resync(this.handle.getContents().clone());
        });
        this.resyncCount += 1;
        recoveredViaResync = true;
      } catch (resyncErr) {
        const message =
          resyncErr instanceof Error ? resyncErr.message : String(resyncErr);
        this.lastDesync = message;
        return {
          status: 'desync',
          version,
          applied: change,
          desynchronized: true,
          error: message,
        };
      }
    }

    if (!contentsEqual(options.getEditorContents(), this.handle.getContents())) {
      this.lastDesync = 'editor-document-contents-mismatch-after-resync';
      return {
        status: 'desync',
        version,
        applied: change,
        desynchronized: true,
        error: this.lastDesync,
      };
    }

    this.lastDesync = null;
    return {
      status: recoveredViaResync ? 'resync' : 'ok',
      version,
      applied: change,
      desynchronized: false,
    };
  }

  /**
   * One-way reconcile after `modify()` settles a non-empty change.
   */
  reconcileEditorChange(
    change: ChangeSet,
    options: ReconcileOptions,
  ): void {
    if (this.projectionDepth > 0) {
      return;
    }
    if (change.length() === 0) {
      return;
    }
    const meta: Partial<ChangeMeta> = {
      source: mapEmitterSource(options.emitterSource),
      origin: 'editor',
    };
    try {
      this.handle.apply(change, { meta, validate: true });
      this.reconcileCount += 1;
    } catch {
      // Editor remains authoritative: rebuild Document from live snapshot.
      this.handle.replaceFromContents(options.liveContents, {
        validate: true,
        meta: { source: 'system', origin: 'system', intent: 'resync-after-apply-failure' },
      });
      this.resyncCount += 1;
    }
  }

  /** Force Document to match live editor contents (tests / recovery). */
  resyncFromEditor(liveContents: ChangeSet): void {
    this.handle.replaceFromContents(liveContents, {
      validate: true,
      meta: { source: 'system', origin: 'system', intent: 'explicit-resync' },
    });
    this.resyncCount += 1;
  }
}

export function createEditorDocumentBridge(
  initialContents: ChangeSet,
): EditorDocumentBridge {
  return new EditorDocumentBridge(initialContents);
}

// Re-export createDocument for local clarity in tests
export { createDocument };
