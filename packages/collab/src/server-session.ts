/**
 * Authoritative DocumentServerSession (ADR-020 / ADR-021 / ADR-022).
 * Reuses DocumentHandle + ChangeSet; CAS for durable history.
 */
import ChangeSet from 'lextrix-change';
import type {
  AuthoritativeDocumentPersistence,
  CompareAndAppendResult,
  DocumentLifecycle,
  SnapshotPersistence,
} from 'lextrix-change/persistence';
import {
  PersistenceError,
  assertDocumentMutable,
  serializeDocumentSnapshot,
} from 'lextrix-change/persistence';
import {
  DocumentHandle,
  DocumentVersion,
  type ChangeMeta,
} from 'lextrix-change/document';
import {
  parseCollabEnvelope,
  serializeCollabEnvelope,
  serializeDocumentVersion,
} from 'lextrix-change/wire';
import type {
  DocumentOwnership,
  DocumentOwnershipLease,
} from './ownership.js';
import type {
  AckFrame,
  CollabControlFrame,
  CollabObserver,
  RejectCode,
  RejectFrame,
  SyncRequestFrame,
  SyncResponseFrame,
  PresenceFrame,
} from './frames.js';
import {
  EphemeralPresenceStore,
  type PresenceLimits,
  type PresencePayload,
} from './presence.js';
import type { DocumentRegionStore } from './region.js';

export interface CollabEnvelopeLike {
  changeId: string;
  documentId: string;
  baseVersionId: string;
  change: ChangeSet;
  meta: Partial<ChangeMeta>;
  dependsOn: string[];
}

export type AuthorizeEnvelope = (info: {
  documentId: string;
  envelope: CollabEnvelopeLike;
  actorId?: string;
}) => boolean | Promise<boolean>;

export interface DocumentServerSessionOptions {
  persistence: AuthoritativeDocumentPersistence;
  /** Default 64 — reject with rebase_limit / sync_required beyond this. */
  maxRebaseDepth?: number;
  /** Default 256 — max queued accept work markers. */
  maxPendingEnvelopes?: number;
  authorizeEnvelope?: AuthorizeEnvelope;
  observe?: CollabObserver;
  /**
   * Stamp trusted actor into ChangeMeta (never trust client actorId).
   */
  resolveActorMeta?: (info: {
    envelope: CollabEnvelopeLike;
    actorId?: string;
  }) => Partial<ChangeMeta>;
  /**
   * Optional ownership — when set, acquire lease and fence CAS with owner_epoch.
   */
  ownership?: DocumentOwnership;
  /** Pre-acquired lease (host manages renew). */
  lease?: DocumentOwnershipLease;
  /** Phase 12: snapshots for sync-after-compaction. */
  snapshots?: SnapshotPersistence;
  /** Phase 12: lifecycle / tombstones. */
  lifecycle?: DocumentLifecycle;
  /** Phase 12: ephemeral presence (isolated from document accept). */
  presence?: EphemeralPresenceStore;
  presenceLimits?: Partial<PresenceLimits>;
  /** Phase 12: home region (routing metadata only). */
  regions?: DocumentRegionStore;
  /** This process's region id — rejects writes if not home (when regions set). */
  localRegion?: string;
}

export type AcceptResult =
  | {
      ok: true;
      duplicate: boolean;
      version: DocumentVersion;
      transformed: ChangeSet;
      frames: CollabControlFrame[];
    }
  | {
      ok: false;
      code: RejectCode;
      message: string;
      frames: CollabControlFrame[];
    };

type AcceptedRecord = {
  changeId: string;
  version: DocumentVersion;
  transformed: ChangeSet;
  envelope: CollabEnvelopeLike;
};

type Subscriber = (frame: CollabControlFrame) => void;

const DEFAULT_MAX_REBASE = 64;
const DEFAULT_MAX_PENDING = 256;

/**
 * Per-document serialized authoritative accept loop.
 * Reference implementation — not a production network host.
 */
export class DocumentServerSession {
  readonly documentId: string;
  private readonly persistence: AuthoritativeDocumentPersistence;
  private readonly maxRebaseDepth: number;
  private readonly maxPendingEnvelopes: number;
  private readonly authorizeEnvelope?: AuthorizeEnvelope;
  private readonly observe?: CollabObserver;
  private readonly resolveActorMeta?: DocumentServerSessionOptions['resolveActorMeta'];
  private readonly ownership?: DocumentOwnership;
  private lease: DocumentOwnershipLease | null;
  private readonly snapshots?: SnapshotPersistence;
  private readonly lifecycle?: DocumentLifecycle;
  private readonly presence: EphemeralPresenceStore;
  private readonly regions?: DocumentRegionStore;
  private readonly localRegion?: string;
  private handle!: DocumentHandle;
  private readonly acceptedByChangeId = new Map<string, AcceptedRecord>();
  private readonly rejectedByChangeId = new Map<
    string,
    { code: RejectCode; message: string }
  >();
  private readonly subscribers = new Set<Subscriber>();
  private queue: Promise<void> = Promise.resolve();
  private closed = false;

  private constructor(
    documentId: string,
    options: DocumentServerSessionOptions,
  ) {
    this.documentId = documentId;
    this.persistence = options.persistence;
    this.maxRebaseDepth = options.maxRebaseDepth ?? DEFAULT_MAX_REBASE;
    this.maxPendingEnvelopes =
      options.maxPendingEnvelopes ?? DEFAULT_MAX_PENDING;
    this.authorizeEnvelope = options.authorizeEnvelope;
    this.observe = options.observe;
    this.resolveActorMeta = options.resolveActorMeta;
    this.ownership = options.ownership;
    this.lease = options.lease ?? null;
    this.snapshots = options.snapshots;
    this.lifecycle = options.lifecycle;
    this.presence =
      options.presence ?? new EphemeralPresenceStore(options.presenceLimits);
    this.regions = options.regions;
    this.localRegion = options.localRegion;
  }

  static async open(
    documentId: string,
    options: DocumentServerSessionOptions,
    bootstrap?: {
      contents?: ChangeSet;
      /** If persistence empty, create root and CAS-append. */
      createIfMissing?: boolean;
    },
  ): Promise<DocumentServerSession> {
    const session = new DocumentServerSession(documentId, options);
    await session.hydrate(bootstrap);
    return session;
  }

  getHandle(): DocumentHandle {
    return this.handle;
  }

  getHead(): DocumentVersion {
    return this.handle.currentVersion();
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /** Serialize accept onto the per-document writer queue. */
  accept(
    input: CollabEnvelopeLike | unknown,
    options: { actorId?: string } = {},
  ): Promise<AcceptResult> {
    return new Promise((resolve, reject) => {
      this.queue = this.queue
        .then(async () => {
          if (this.closed) {
            resolve({
              ok: false,
              code: 'persistence_error',
              message: 'session closed',
              frames: [
                this.errorFrame('session_closed', 'session closed'),
              ],
            });
            return;
          }
          const result = await this.acceptUnlocked(input, options);
          resolve(result);
        })
        .catch(reject);
    });
  }

  async sync(request: SyncRequestFrame): Promise<SyncResponseFrame | RejectFrame> {
    if (request.documentId !== this.documentId) {
      return {
        type: 'reject',
        documentId: this.documentId,
        code: 'wrong_document',
        message: 'documentId mismatch',
      };
    }
    try {
      const head = this.getHead();
      try {
        const versions = await Promise.resolve(
          this.persistence.loadChain(
            this.documentId,
            request.fromVersionId,
          ),
        );
        return {
          type: 'sync',
          role: 'response',
          documentId: this.documentId,
          fromVersionId: request.fromVersionId,
          versions: versions.map((v) => serializeDocumentVersion(v)),
          headVersionId: head.id,
          requestId: request.requestId,
        };
      } catch (err) {
        if (
          !(err instanceof PersistenceError && err.code === 'not_found') ||
          !this.snapshots
        ) {
          throw err;
        }
        // Compacted base: serve latest sealed snapshot + hot deltas.
        const snap = await Promise.resolve(
          this.snapshots.getLatestSnapshot(this.documentId),
        );
        if (!snap) {
          return {
            type: 'reject',
            documentId: this.documentId,
            code: 'sync_required',
            message: `unknown fromVersionId ${String(request.fromVersionId)}`,
          };
        }
        const deltas = await Promise.resolve(
          this.persistence.loadChain(this.documentId, snap.versionId),
        );
        this.emit('sync_from_snapshot', {
          snapshotId: snap.snapshotId,
          versionId: snap.versionId,
          deltaCount: deltas.length,
        });
        return {
          type: 'sync',
          role: 'response',
          documentId: this.documentId,
          fromVersionId: request.fromVersionId,
          versions: deltas.map((v) => serializeDocumentVersion(v)),
          headVersionId: head.id,
          requestId: request.requestId,
          baseSnapshot: serializeDocumentSnapshot(snap),
          compactionApplied: true,
        };
      }
    } catch (err) {
      if (err instanceof PersistenceError && err.code === 'not_found') {
        return {
          type: 'reject',
          documentId: this.documentId,
          code: 'sync_required',
          message: `unknown fromVersionId ${String(request.fromVersionId)}`,
        };
      }
      return {
        type: 'reject',
        documentId: this.documentId,
        code: 'persistence_error',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Publish presence (never touches Version / accept queue).
   */
  publishPresence(
    actorId: string,
    generation: number,
    payload: PresencePayload,
  ): PresenceFrame | RejectFrame {
    const result = this.presence.publish(
      this.documentId,
      actorId,
      generation,
      payload,
    );
    if (!result.ok) {
      this.emit('presence_dropped', { reason: result.reason, actorId });
      return {
        type: 'reject',
        documentId: this.documentId,
        code: 'presence_rejected',
        message: result.reason,
      };
    }
    this.emit('presence_update', { actorId, generation });
    const frame: PresenceFrame = {
      type: 'presence',
      role: 'update',
      documentId: this.documentId,
      actorId: result.entry.actorId,
      generation: result.entry.generation,
      payload: result.entry.payload,
    };
    this.broadcast([frame]);
    return frame;
  }

  presenceState(): PresenceFrame {
    const entries = this.presence.list(this.documentId).map((e) => ({
      actorId: e.actorId,
      generation: e.generation,
      serverTime: e.serverTime,
      payload: e.payload,
    }));
    return {
      type: 'presence',
      role: 'state',
      documentId: this.documentId,
      entries,
    };
  }

  clearPresence(): void {
    this.presence.clearDocument(this.documentId);
  }

  getPresenceStore(): EphemeralPresenceStore {
    return this.presence;
  }

  close(): void {
    this.closed = true;
    this.subscribers.clear();
  }

  getLease(): DocumentOwnershipLease | null {
    return this.lease;
  }

  async ensureOwnership(): Promise<DocumentOwnershipLease> {
    if (this.lease) return this.lease;
    if (!this.ownership) {
      throw new Error('DocumentServerSession: ownership not configured');
    }
    this.lease = await this.ownership.acquire(this.documentId);
    this.emit('ownership_acquired', {
      ownerEpoch: this.lease.ownerEpoch,
      ownerId: this.lease.ownerId,
    });
    return this.lease;
  }

  private async hydrate(bootstrap?: {
    contents?: ChangeSet;
    createIfMissing?: boolean;
  }): Promise<void> {
    if (this.ownership && !this.lease) {
      await this.ensureOwnership();
    }
    const chain = await Promise.resolve(
      this.persistence.loadChain(this.documentId),
    );
    if (chain.length > 0) {
      const compactedRoot = chain[0]!.sequence !== 0;
      this.handle = DocumentHandle.fromVersions(chain, {
        validate: true,
        compactedRoot,
      });
      return;
    }
    if (bootstrap?.createIfMissing === false) {
      throw new Error(
        `DocumentServerSession: no Versions for ${this.documentId}`,
      );
    }
    this.handle = DocumentHandle.create({
      contents: bootstrap?.contents,
      documentId: this.documentId,
      validate: true,
    });
    const root = this.handle.currentVersion();
    const cas = await Promise.resolve(
      this.persistence.compareAndAppend(this.documentId, null, root, {
        ownerEpoch: this.lease?.ownerEpoch,
      }),
    );
    if (!cas.ok) {
      throw new Error(`DocumentServerSession: failed to persist root: ${cas.message}`);
    }
  }

  private async acceptUnlocked(
    input: CollabEnvelopeLike | unknown,
    options: { actorId?: string },
  ): Promise<AcceptResult> {
    this.emit('change_received', {});

    let envelope: CollabEnvelopeLike;
    try {
      envelope = this.parseInput(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const frames = [
        this.rejectFrame(undefined, 'invalid_envelope', message),
      ];
      this.broadcast(frames);
      return { ok: false, code: 'invalid_envelope', message, frames };
    }

    if (this.lifecycle) {
      const state = await Promise.resolve(
        this.lifecycle.getState(this.documentId),
      );
      try {
        assertDocumentMutable(state, this.documentId);
      } catch {
        const frames = [
          this.rejectFrame(
            envelope.changeId,
            'document_tombstoned',
            `document is ${state}`,
          ),
        ];
        this.broadcast(frames);
        return {
          ok: false,
          code: 'document_tombstoned',
          message: `document is ${state}`,
          frames,
        };
      }
    }

    if (this.regions && this.localRegion) {
      const home = await Promise.resolve(
        this.regions.getHomeRegion(this.documentId),
      );
      if (home != null && home !== this.localRegion) {
        const frames = [
          this.rejectFrame(
            envelope.changeId,
            'stale_owner',
            `not home region (home=${home}, local=${this.localRegion})`,
          ),
        ];
        this.broadcast(frames);
        return {
          ok: false,
          code: 'stale_owner',
          message: `not home region`,
          frames,
        };
      }
    }

    const received: AckFrame = {
      type: 'ack',
      documentId: this.documentId,
      changeId: envelope.changeId,
      level: 'received',
    };

    if (envelope.documentId !== this.documentId) {
      const frames = [
        received,
        this.rejectFrame(envelope.changeId, 'wrong_document', 'documentId mismatch'),
      ];
      this.broadcast(frames);
      return { ok: false, code: 'wrong_document', message: 'documentId mismatch', frames };
    }

    if (envelope.change.length() === 0) {
      const frames = [
        received,
        this.rejectFrame(envelope.changeId, 'empty_change', 'empty ChangeSet'),
      ];
      this.broadcast(frames);
      return { ok: false, code: 'empty_change', message: 'empty ChangeSet', frames };
    }

    if (this.authorizeEnvelope) {
      const allowed = await Promise.resolve(
        this.authorizeEnvelope({
          documentId: this.documentId,
          envelope,
          actorId: options.actorId,
        }),
      );
      if (!allowed) {
        const frames = [
          received,
          this.rejectFrame(
            envelope.changeId,
            'authorization_failed',
            'authorization failed',
          ),
        ];
        this.broadcast(frames);
        return {
          ok: false,
          code: 'authorization_failed',
          message: 'authorization failed',
          frames,
        };
      }
    }

    const prior = this.acceptedByChangeId.get(envelope.changeId);
    if (prior) {
      const frames = this.successFrames(envelope.changeId, prior.version, prior.transformed, true);
      this.broadcast(frames);
      return {
        ok: true,
        duplicate: true,
        version: prior.version,
        transformed: prior.transformed,
        frames,
      };
    }

    // Durable idempotency (production / Phase 11)
    if (this.persistence.lookupChangeId) {
      const durable = await Promise.resolve(
        this.persistence.lookupChangeId(this.documentId, envelope.changeId),
      );
      if (durable) {
        try {
          const v = this.handle.getVersion(durable.versionId);
          const record: AcceptedRecord = {
            changeId: envelope.changeId,
            version: v,
            transformed: new ChangeSet(),
            envelope,
          };
          this.acceptedByChangeId.set(envelope.changeId, record);
          const frames = this.successFrames(
            envelope.changeId,
            v,
            new ChangeSet(),
            true,
          );
          this.broadcast(frames);
          return {
            ok: true,
            duplicate: true,
            version: v,
            transformed: new ChangeSet(),
            frames,
          };
        } catch {
          /* version not in local handle — sync required path below */
        }
      }
    }

    const priorReject = this.rejectedByChangeId.get(envelope.changeId);
    if (priorReject) {
      const frames = [
        received,
        this.rejectFrame(envelope.changeId, priorReject.code, priorReject.message),
      ];
      this.broadcast(frames);
      return {
        ok: false,
        code: priorReject.code,
        message: priorReject.message,
        frames,
      };
    }

    if (this.acceptedByChangeId.size + 1 > this.maxPendingEnvelopes * 4) {
      // Bound accepted map growth is soft; queue limit on concurrent waiters:
    }
    if (this.subscribers.size > this.maxPendingEnvelopes * 10) {
      /* no-op: subscriber bound soft */
    }

    const dependsOn = envelope.dependsOn ?? [];
    const missing = dependsOn.filter((id) => !this.acceptedByChangeId.has(id));
    if (missing.length > 0) {
      const message = `missing dependsOn: ${missing.join(',')}`;
      this.rejectedByChangeId.set(envelope.changeId, {
        code: 'causal_dependency',
        message,
      });
      const frames = [
        received,
        this.rejectFrame(envelope.changeId, 'causal_dependency', message),
      ];
      this.emit('causal_dependency_missing', { missing });
      this.broadcast(frames);
      return { ok: false, code: 'causal_dependency', message, frames };
    }

    const headBefore = this.handle.currentVersion();
    const baseId = envelope.baseVersionId;
    let base: DocumentVersion;
    try {
      base = this.handle.getVersion(baseId);
    } catch {
      const message = `unknown baseVersionId ${baseId}`;
      this.rejectedByChangeId.set(envelope.changeId, {
        code: 'unknown_base',
        message,
      });
      const frames = [
        received,
        this.rejectFrame(envelope.changeId, 'unknown_base', message),
        this.rejectFrame(envelope.changeId, 'sync_required', message),
      ];
      this.broadcast(frames);
      return { ok: false, code: 'sync_required', message, frames };
    }

    let transformed = envelope.change.clone();
    if (base.id !== headBefore.id) {
      let steps: ChangeSet[];
      try {
        steps = this.handle.changesBetween(base, headBefore);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const frames = [
          received,
          this.rejectFrame(envelope.changeId, 'sync_required', message),
        ];
        this.broadcast(frames);
        return { ok: false, code: 'sync_required', message, frames };
      }
      if (steps.length > this.maxRebaseDepth) {
        const message = `rebase depth ${steps.length} exceeds maxRebaseDepth ${this.maxRebaseDepth}`;
        this.rejectedByChangeId.set(envelope.changeId, {
          code: 'rebase_limit',
          message,
        });
        const frames = [
          received,
          this.rejectFrame(envelope.changeId, 'rebase_limit', message),
          this.rejectFrame(envelope.changeId, 'sync_required', message),
        ];
        this.emit('change_rejected', { code: 'rebase_limit' });
        this.broadcast(frames);
        return { ok: false, code: 'sync_required', message, frames };
      }
      for (const step of steps) {
        // Accepted history has priority over incoming.
        transformed = step.transform(transformed, true);
      }
    }

    if (transformed.length() === 0) {
      // No-op after transform — treat as duplicate-success against HEAD without new Version?
      // Spec: empty after transform → reject empty_change (no mutation).
      const message = 'transformed ChangeSet empty';
      const frames = [
        received,
        this.rejectFrame(envelope.changeId, 'empty_change', message),
      ];
      this.broadcast(frames);
      return { ok: false, code: 'empty_change', message, frames };
    }

    const actorMeta = this.resolveActorMeta?.({
      envelope,
      actorId: options.actorId,
    }) ?? {};
    const meta: Partial<ChangeMeta> = {
      ...actorMeta,
      changeId: envelope.changeId,
      untrustedInput: true,
      // Force remote/system so client cannot escalate authority.
      source: 'remote',
      origin: 'system',
    };

    try {
      this.handle.apply(transformed, { meta, validate: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const frames = [
        received,
        this.rejectFrame(envelope.changeId, 'apply_failed', message),
      ];
      this.broadcast(frames);
      return { ok: false, code: 'apply_failed', message, frames };
    }

    const newVersion = this.handle.currentVersion();
    if (newVersion.parentId !== headBefore.id) {
      this.rehydrateFromVersions(this.handle.listVersions().slice(0, -1));
      const message = 'version parent invariant broken';
      const frames = [
        received,
        this.rejectFrame(envelope.changeId, 'apply_failed', message),
      ];
      this.broadcast(frames);
      return { ok: false, code: 'apply_failed', message, frames };
    }

    const cas: CompareAndAppendResult = await Promise.resolve(
      this.persistence.compareAndAppend(
        this.documentId,
        headBefore.id,
        newVersion,
        {
          ownerEpoch: this.lease?.ownerEpoch,
          changeId: envelope.changeId,
        },
      ),
    );

    if (!cas.ok) {
      // Roll back in-memory authority; never emit history.
      // restoreVersion() would append a new Version — rehydrate instead.
      this.rehydrateFromVersions(this.handle.listVersions().slice(0, -1));
      this.emit('persistence_failed', { reason: cas.reason });
      const code: RejectCode =
        cas.reason === 'cas_conflict'
          ? 'cas_conflict'
          : cas.reason === 'stale_owner'
            ? 'stale_owner'
            : 'persistence_error';
      if (code === 'stale_owner') {
        this.emit('stale_owner_fenced', { ownerEpoch: this.lease?.ownerEpoch });
        this.lease = null;
      }
      const frames = [
        received,
        this.rejectFrame(envelope.changeId, code, cas.message),
      ];
      this.broadcast(frames);
      return { ok: false, code, message: cas.message, frames };
    }

    if (cas.duplicate) {
      this.rehydrateFromVersions(this.handle.listVersions().slice(0, -1));
      try {
        const existing = this.handle.listVersions().length
          ? this.handle.getVersion(cas.version.id)
          : cas.version;
        // Re-open from durable head after duplicate
        const chain = await Promise.resolve(
          this.persistence.loadChain(this.documentId),
        );
        this.handle = DocumentHandle.fromVersions(chain, {
          validate: false,
          compactedRoot: chain[0]!.sequence !== 0,
        });
        const frames = this.successFrames(
          envelope.changeId,
          cas.version,
          transformed.freeze(),
          true,
        );
        this.acceptedByChangeId.set(envelope.changeId, {
          changeId: envelope.changeId,
          version: cas.version,
          transformed: transformed.freeze(),
          envelope,
        });
        this.broadcast(frames);
        void existing;
        return {
          ok: true,
          duplicate: true,
          version: cas.version,
          transformed: transformed.freeze(),
          frames,
        };
      } catch {
        /* fall through to success path using cas.version */
      }
    }

    const record: AcceptedRecord = {
      changeId: envelope.changeId,
      version: cas.version,
      transformed: transformed.freeze(),
      envelope: {
        ...envelope,
        change: transformed.freeze(),
      },
    };
    this.acceptedByChangeId.set(envelope.changeId, record);
    this.emit('version_persisted', { versionId: cas.version.id });
    this.emit('change_accepted', { changeId: envelope.changeId });
    this.emit('history_ack', { versionId: cas.version.id });

    const frames = this.successFrames(
      envelope.changeId,
      cas.version,
      record.transformed,
      false,
    );
    this.broadcast(frames);
    return {
      ok: true,
      duplicate: false,
      version: cas.version,
      transformed: record.transformed,
      frames,
    };
  }

  private successFrames(
    changeId: string,
    version: DocumentVersion,
    transformed: ChangeSet,
    duplicate: boolean,
  ): CollabControlFrame[] {
    const env: CollabEnvelopeLike = {
      changeId,
      documentId: this.documentId,
      baseVersionId: version.parentId ?? version.id,
      change: transformed,
      dependsOn: [],
      meta: {
        source: 'remote',
        origin: 'system',
        changeId,
      },
    };
    const envelopeFrame: EnvelopeFrame = {
      type: 'envelope',
      body: serializeCollabEnvelope({
        changeId: env.changeId,
        documentId: env.documentId,
        baseVersionId: env.baseVersionId,
        change: env.change,
        dependsOn: env.dependsOn,
        meta: env.meta,
      }),
    };
    // Phase 10 v1: co-emit accepted + history after durable CAS.
    const accepted: AckFrame = {
      type: 'ack',
      documentId: this.documentId,
      changeId,
      level: 'accepted',
      versionId: version.id,
    };
    const history: AckFrame = {
      type: 'ack',
      documentId: this.documentId,
      changeId,
      level: 'history',
      versionId: version.id,
    };
    void duplicate;
    return [
      {
        type: 'ack',
        documentId: this.documentId,
        changeId,
        level: 'received',
      },
      envelopeFrame,
      accepted,
      history,
    ];
  }

  private rehydrateFromVersions(versions: readonly DocumentVersion[]): void {
    if (versions.length === 0) {
      throw new Error('DocumentServerSession: cannot rehydrate empty chain');
    }
    this.handle = DocumentHandle.fromVersions(versions, {
      validate: false,
      verifyComposeIntegrity: true,
      compactedRoot: versions[0]!.sequence !== 0,
    });
  }

  private parseInput(input: CollabEnvelopeLike | unknown): CollabEnvelopeLike {
    if (
      input &&
      typeof input === 'object' &&
      'change' in input &&
      (input as CollabEnvelopeLike).change instanceof ChangeSet
    ) {
      const env = input as CollabEnvelopeLike;
      return {
        changeId: env.changeId,
        documentId: env.documentId,
        baseVersionId: env.baseVersionId,
        change: env.change,
        dependsOn: [...(env.dependsOn ?? [])],
        meta: { ...(env.meta ?? {}) },
      };
    }
    if (
      input &&
      typeof input === 'object' &&
      (input as EnvelopeFrame).type === 'envelope'
    ) {
      return parseCollabEnvelope((input as EnvelopeFrame).body);
    }
    return parseCollabEnvelope(input);
  }

  private rejectFrame(
    changeId: string | undefined,
    code: RejectCode,
    message: string,
  ): RejectFrame {
    return {
      type: 'reject',
      documentId: this.documentId,
      changeId,
      code,
      message,
    };
  }

  private errorFrame(code: string, message: string): CollabControlFrame {
    return {
      type: 'error',
      documentId: this.documentId,
      code,
      message,
    };
  }

  private broadcast(frames: CollabControlFrame[]): void {
    for (const frame of frames) {
      for (const sub of this.subscribers) {
        sub(frame);
      }
    }
  }

  private emit(name: string, detail: Record<string, unknown>): void {
    this.observe?.({ name, documentId: this.documentId, detail });
  }
}
