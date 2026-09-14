/**
 * In-memory collaboration adapter (Phase 5B / hardened 6L–6M).
 * Network-agnostic: pending locals, remote ingest, ack, dedup.
 * Document engine stays network-agnostic — adapter only calls Handle APIs.
 *
 * Coordinator:
 * - Accepts envelopes in **publish order** (total order / OT priority).
 * - Rejects publish when `dependsOn` references an unpublished changeId
 *   (no buffering / out-of-order apply — CausalDependencyError).
 * - Server-transforms each new change through previously accepted ops
 *   (accepted has priority: prev.transform(incoming, true)).
 * - Two-phase delivery: remotes first (pending intact), then local acks.
 * - Duplicate publish / duplicate ACK are idempotent.
 *
 * Client ingest:
 * - Transform remote only through pending locals that were accepted *after*
 *   the remote (not yet included in the server-transformed op).
 * - Skip pending that precede the remote (already baked into server op).
 */
import type {
  CollabAck,
  CollaborationAdapter,
} from '../collaboration/adapter.js';
import type { CollabAckLevel } from '../collaboration/transport.js';
import ChangeSet from '../change/change-set.js';
import type { ChangeMeta } from './change-meta.js';
import { sanitizeUntrustedChangeMeta } from './change-meta.js';
import { DocumentHandle } from './document-handle.js';
import type { DocumentVersion } from './version.js';

export type CollabFailureCategory =
  | 'duplicate'
  | 'wrong_document'
  | 'causal_dependency'
  | 'apply_failed'
  | 'empty_change';

export class CausalDependencyError extends Error {
  readonly code = 'causal_dependency' as const;
  readonly missingDependsOn: readonly string[];

  constructor(missingDependsOn: readonly string[], message?: string) {
    super(
      message ??
        `Cannot publish: dependsOn not yet accepted: ${missingDependsOn.join(',')}`,
    );
    this.name = 'CausalDependencyError';
    this.missingDependsOn = missingDependsOn;
  }
}

export interface CollabEnvelope {
  changeId: string;
  documentId: string;
  /** Version id the change was authored against. */
  baseVersionId: string;
  change: ChangeSet;
  meta: Partial<ChangeMeta>;
  /**
   * Earlier local changeIds this change is causally after (same client).
   * Coordinator must not re-transform against these (already applied in authorship).
   * All ids MUST already be published/accepted — otherwise publish throws
   * {@link CausalDependencyError} (no out-of-order buffering in this adapter).
   */
  dependsOn: string[];
}

export interface PendingLocal {
  changeId: string;
  /** Applied ChangeSet (as committed locally). */
  applied: ChangeSet;
  baseVersionId: string;
  sent: boolean;
}

export type CollabApplyRemoteResult =
  | {
      ok: true;
      duplicate: false;
      version: DocumentVersion;
      applied: ChangeSet;
    }
  | { ok: true; duplicate: true }
  | {
      ok: false;
      reason: string;
      category: CollabFailureCategory;
      /** Document mutation did not occur for this ingest. */
      documentMutated: false;
    };

let changeIdCounter = 0;

export function createChangeId(prefix = 'chg'): string {
  changeIdCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${changeIdCounter.toString(36)}`;
}

type EnvelopeListener = {
  onRemote: (env: CollabEnvelope) => void;
  onAck: (env: CollabEnvelope) => void;
};

/** Shared in-memory bus for multi-client tests (not a network server). */
export class InMemoryCollabCoordinator {
  private readonly delivered = new Map<string, CollabEnvelope>();
  /** Total accept order — earlier changeId has OT priority. */
  private readonly order: string[] = [];
  /** Server-transformed accepted ChangeSets (same order as `order`). */
  private readonly accepted: ChangeSet[] = [];
  private readonly listeners = new Set<EnvelopeListener>();
  private readonly buffer: CollabEnvelope[] = [];
  private autoDeliver = true;

  setAutoDeliver(enabled: boolean): void {
    this.autoDeliver = enabled;
  }

  /**
   * Publish in total order. Duplicate changeId → no-op (idempotent).
   * Missing dependsOn predecessors → {@link CausalDependencyError} (no mutation).
   */
  publish(env: CollabEnvelope): void {
    if (this.delivered.has(env.changeId)) {
      return;
    }
    const dependsOn = env.dependsOn ?? [];
    const missing = dependsOn.filter((id) => !this.delivered.has(id));
    if (missing.length > 0) {
      throw new CausalDependencyError(missing);
    }

    const skip = new Set(dependsOn);
    // Transform incoming through already-accepted ops (accepted has priority),
    // but not through causal predecessors from the same client.
    let transformed = env.change.clone();
    for (let i = 0; i < this.accepted.length; i += 1) {
      const prevId = this.order[i]!;
      if (skip.has(prevId)) continue;
      transformed = this.accepted[i]!.transform(transformed, true);
    }
    transformed = transformed.freeze();
    this.accepted.push(transformed);

    const stored: CollabEnvelope = {
      ...env,
      dependsOn: [...dependsOn],
      change: transformed,
    };
    this.delivered.set(env.changeId, stored);
    this.order.push(env.changeId);
    if (this.autoDeliver) {
      this.deliverBatch([stored]);
    } else {
      this.buffer.push(stored);
    }
  }

  flush(): void {
    const pending = this.buffer.splice(0, this.buffer.length);
    this.deliverBatch(pending);
  }

  precedes(aId: string, bId: string): boolean {
    const ia = this.order.indexOf(aId);
    const ib = this.order.indexOf(bId);
    if (ia < 0 || ib < 0) {
      throw new Error(`Unknown changeId in order: ${aId} / ${bId}`);
    }
    return ia < ib;
  }

  subscribe(listener: EnvelopeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  has(changeId: string): boolean {
    return this.delivered.has(changeId);
  }

  /** Accepted changeIds in publish order (tests / diagnostics). */
  getAcceptedOrder(): readonly string[] {
    return this.order;
  }

  private deliverBatch(envs: CollabEnvelope[]): void {
    for (const env of envs) {
      for (const listener of this.listeners) {
        listener.onRemote(env);
      }
    }
    for (const env of envs) {
      for (const listener of this.listeners) {
        listener.onAck(env);
      }
    }
  }
}

/**
 * Per-client adapter bound to one DocumentHandle.
 * Implements the CollaborationAdapter port (ADR-019) for in-memory tests.
 *
 * HEAD vs confirmed:
 * - getLocalHead() === Handle HEAD (local materialized Version)
 * - getConfirmedVersion() === latest Version marked via processAck(level: 'history')
 *   (null until a history ACK). Never treat confirmed as synonymous with HEAD
 *   when pending locals exist.
 */
export class InMemoryCollaborationAdapter implements CollaborationAdapter {
  private readonly handle: DocumentHandle;
  private readonly coordinator: InMemoryCollabCoordinator;
  private readonly pending: PendingLocal[] = [];
  private readonly seenIds = new Set<string>();
  private readonly localIds = new Set<string>();
  private readonly unsubscribe: () => void;
  /** Last remote ingest result (including failures from the bus). */
  private lastRemoteResult: CollabApplyRemoteResult | null = null;
  /** Highest ACK level seen per changeId (distinct ladder steps). */
  private readonly ackLevels = new Map<string, CollabAckLevel>();
  /** Authoritative confirmed Version (history ACK only) — not Handle HEAD. */
  private confirmedVersion: DocumentVersion | null = null;

  constructor(handle: DocumentHandle, coordinator: InMemoryCollabCoordinator) {
    this.handle = handle;
    this.coordinator = coordinator;
    this.unsubscribe = coordinator.subscribe({
      onRemote: (env) => this.onRemote(env),
      onAck: (env) => this.onAck(env),
    });
  }

  destroy(): void {
    this.unsubscribe();
  }

  getHandle(): DocumentHandle {
    return this.handle;
  }

  /** Local Handle HEAD — may include unacked pending locals. */
  getLocalHead(): DocumentVersion {
    return this.handle.currentVersion();
  }

  /**
   * Latest Version acknowledged at ACK level `history` by the collaboration
   * authority. Null until a history ACK. Not equal to HEAD when dirty/pending.
   */
  getConfirmedVersion(): DocumentVersion | null {
    return this.confirmedVersion;
  }

  /** Highest ACK level recorded for a changeId (tests / diagnostics). */
  getAckLevel(changeId: string): CollabAckLevel | undefined {
    return this.ackLevels.get(changeId);
  }

  getPending(): readonly PendingLocal[] {
    return this.pending;
  }

  getLastRemoteResult(): CollabApplyRemoteResult | null {
    return this.lastRemoteResult;
  }

  /**
   * Call **after** the local ChangeSet has been applied to Document.
   * Publishes an envelope and tracks pending until ack (echo).
   * On {@link CausalDependencyError}, pending/local tracking is rolled back.
   */
  submitLocal(
    change: ChangeSet,
    options: {
      changeId?: string;
      baseVersionId: string;
      meta?: Partial<ChangeMeta>;
    },
  ): CollabEnvelope {
    if (change.length() === 0) {
      throw new Error('submitLocal: empty change');
    }
    const changeId = options.changeId ?? createChangeId('local');
    const applied = change.clone().freeze();
    const dependsOn = this.pending.map((p) => p.changeId);
    this.localIds.add(changeId);
    this.pending.push({
      changeId,
      applied,
      baseVersionId: options.baseVersionId,
      sent: true,
    });
    const env: CollabEnvelope = {
      changeId,
      documentId: this.handle.documentId,
      baseVersionId: options.baseVersionId,
      change: applied,
      dependsOn,
      meta: {
        source: 'user',
        origin: 'editor',
        ...options.meta,
      },
    };
    try {
      this.coordinator.publish(env);
    } catch (err) {
      const idx = this.pending.findIndex((p) => p.changeId === changeId);
      if (idx >= 0) this.pending.splice(idx, 1);
      this.localIds.delete(changeId);
      throw err;
    }
    return env;
  }

  acknowledge(changeId: string): void {
    const idx = this.pending.findIndex((p) => p.changeId === changeId);
    if (idx >= 0) this.pending.splice(idx, 1);
  }

  /**
   * Process an explicit ACK ladder notification.
   * Levels are distinct: received/persisted do not clear pending or confirm;
   * accepted clears pending for that changeId; history advances confirmedVersion.
   */
  processAck(ack: CollabAck): void {
    const prev = this.ackLevels.get(ack.changeId);
    this.ackLevels.set(ack.changeId, ack.level);
    if (ack.level === 'received' || ack.level === 'persisted') {
      return;
    }
    if (ack.level === 'accepted') {
      if (this.localIds.has(ack.changeId)) {
        this.acknowledge(ack.changeId);
        this.seenIds.add(ack.changeId);
      }
      return;
    }
    // history
    if (this.localIds.has(ack.changeId)) {
      this.acknowledge(ack.changeId);
      this.seenIds.add(ack.changeId);
    }
    if (ack.versionId) {
      const found = this.handle.listVersions().find((v) => v.id === ack.versionId);
      if (found) {
        this.confirmedVersion = found;
      }
    } else if (prev !== 'history' && this.pending.length === 0) {
      // Without versionId, do not invent confirmed = HEAD when still ambiguous.
      // Only allow convergence hint when no pending remain and caller omitted id —
      // still leave confirmed unset unless versionId provided (fail closed).
    }
  }

  /**
   * Ingest remote (server-transformed) change.
   * Only transform through pending locals accepted *after* this remote.
   * Duplicate changeId → ok duplicate (no second mutation).
   */
  ingestRemote(env: CollabEnvelope): CollabApplyRemoteResult {
    if (env.documentId !== this.handle.documentId) {
      const result: CollabApplyRemoteResult = {
        ok: false,
        reason: 'wrong_document',
        category: 'wrong_document',
        documentMutated: false,
      };
      this.lastRemoteResult = result;
      return result;
    }
    if (this.seenIds.has(env.changeId) || this.localIds.has(env.changeId)) {
      const result: CollabApplyRemoteResult = { ok: true, duplicate: true };
      this.lastRemoteResult = result;
      return result;
    }

    const beforeId = this.handle.currentVersion().id;
    const beforeCount = this.handle.listVersions().length;

    try {
      let server = env.change.clone();
      for (const p of this.pending) {
        // Server op already includes transforms through earlier accepted locals.
        if (this.coordinator.precedes(p.changeId, env.changeId)) {
          continue;
        }
        const local = p.applied;
        // Local accepted after remote ⇒ remote has priority.
        const newServer = local.transform(server, false);
        const newLocal = server.transform(local, true);
        p.applied = newLocal.freeze();
        server = newServer;
      }

      if (server.length() > 0) {
        const remoteMeta = sanitizeUntrustedChangeMeta(env.meta, {
          source: 'remote',
          origin: 'system',
        });
        this.handle.apply(server, {
          meta: {
            ...remoteMeta,
            // Remote claims never escalate authority (ADR-015).
            source: 'remote',
            origin: 'system',
            changeId: env.changeId,
            untrustedInput: true,
          },
          validate: true,
        });
      }

      for (const p of this.pending) {
        p.baseVersionId = this.handle.currentVersion().id;
      }

      this.seenIds.add(env.changeId);
      const result: CollabApplyRemoteResult = {
        ok: true,
        duplicate: false,
        version: this.handle.currentVersion(),
        applied: server,
      };
      this.lastRemoteResult = result;
      return result;
    } catch (err) {
      // Apply is atomic — ensure we did not leave a partial version.
      if (
        this.handle.currentVersion().id !== beforeId ||
        this.handle.listVersions().length !== beforeCount
      ) {
        throw new Error(
          `ingestRemote invariant broken after failure: ${String(err)}`,
        );
      }
      const result: CollabApplyRemoteResult = {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
        category: 'apply_failed',
        documentMutated: false,
      };
      this.lastRemoteResult = result;
      return result;
    }
  }

  private onRemote(env: CollabEnvelope): void {
    if (this.localIds.has(env.changeId)) {
      return;
    }
    this.ingestRemote(env);
  }

  private onAck(env: CollabEnvelope): void {
    if (!this.localIds.has(env.changeId)) {
      return;
    }
    // In-memory coordinator ACK = OT accepted, not durable history.
    this.processAck({ changeId: env.changeId, level: 'accepted' });
  }
}

/** Create two clients sharing a coordinator with identical starting contents. */
export function createInMemoryCollabPair(
  contents?: ChangeSet | ConstructorParameters<typeof ChangeSet>[0],
): {
  coordinator: InMemoryCollabCoordinator;
  clientA: InMemoryCollaborationAdapter;
  clientB: InMemoryCollaborationAdapter;
  handleA: DocumentHandle;
  handleB: DocumentHandle;
} {
  const coordinator = new InMemoryCollabCoordinator();
  const handleA = DocumentHandle.create({ contents, validate: true });
  const handleB = DocumentHandle.create({
    contents: handleA.getContents().clone(),
    documentId: handleA.documentId,
    validate: true,
  });
  return {
    coordinator,
    clientA: new InMemoryCollaborationAdapter(handleA, coordinator),
    clientB: new InMemoryCollaborationAdapter(handleB, coordinator),
    handleA,
    handleB,
  };
}
