/**
 * Client collaboration state machine (ADR-020 / ADR-022).
 * Optimistic local apply + pending rebase + sync/reconnect.
 */
import ChangeSet from 'lextrix-change';
import {
  DocumentHandle,
  DocumentVersion,
  type ChangeMeta,
} from 'lextrix-change/document';
import {
  parseCollabEnvelope,
  parseDocumentVersion,
  serializeCollabEnvelope,
} from 'lextrix-change/wire';
import {
  parseDocumentSnapshot,
  type DocumentSnapshot,
} from 'lextrix-change/persistence';
import type {
  AckFrame,
  CollabControlFrame,
  EnvelopeFrame,
  RejectFrame,
  SyncRequestFrame,
  SyncResponseFrame,
} from './frames.js';
import { isCollabControlFrame } from './frames.js';

/** Build a hydration root Version from a verified snapshot (ADR-031). */
function snapshotAsHydrationRoot(snap: DocumentSnapshot): DocumentVersion {
  return new DocumentVersion({
    id: snap.versionId,
    documentId: snap.documentId,
    sequence: snap.sequence,
    revision: 0,
    contents: snap.contents.clone().freeze(),
    parentId: null,
    changeFromParent: null,
    meta: null,
  });
}

export interface PendingLocalChange {
  changeId: string;
  /** Original ChangeSet as authored (pre-remote transforms). */
  original: ChangeSet;
  /** Current pending ChangeSet (may be transformed through remotes). */
  applied: ChangeSet;
  baseVersionId: string;
  inFlight: boolean;
}

export interface AuthoritativeClientOptions {
  handle: DocumentHandle;
  send: (frame: CollabControlFrame) => void | Promise<void>;
  maxRebaseDepth?: number;
  createChangeId?: () => string;
}

let changeCounter = 0;
function defaultChangeId(): string {
  changeCounter += 1;
  return `c_${Date.now().toString(36)}_${changeCounter.toString(36)}`;
}

/**
 * Client-side authoritative collaboration coordinator.
 * Confirmed advances only on history ACK with known versionId.
 */
export class AuthoritativeClientSession {
  private handle: DocumentHandle;
  private readonly send: AuthoritativeClientOptions['send'];
  private readonly maxRebaseDepth: number;
  private readonly createChangeId: () => string;
  private confirmed: DocumentVersion | null = null;
  private serverHeadId: string | null = null;
  private readonly pending: PendingLocalChange[] = [];
  private readonly ackLevels = new Map<string, AckFrame['level']>();
  private readonly seenRemote = new Set<string>();

  constructor(options: AuthoritativeClientOptions) {
    this.handle = options.handle;
    this.send = options.send;
    this.maxRebaseDepth = options.maxRebaseDepth ?? 64;
    this.createChangeId = options.createChangeId ?? defaultChangeId;
    this.confirmed = null;
    this.serverHeadId = options.handle.currentVersion().id;
  }

  getHandle(): DocumentHandle {
    return this.handle;
  }

  getLocalHead(): DocumentVersion {
    return this.handle.currentVersion();
  }

  getConfirmedVersion(): DocumentVersion | null {
    return this.confirmed;
  }

  getServerHeadId(): string | null {
    return this.serverHeadId;
  }

  getPending(): readonly PendingLocalChange[] {
    return this.pending;
  }

  /**
   * Apply locally then submit envelope (optimistic).
   */
  submitLocal(
    change: ChangeSet,
    options: {
      changeId?: string;
      meta?: Partial<ChangeMeta>;
    } = {},
  ): CollabControlFrame {
    if (change.length() === 0) {
      throw new Error('submitLocal: empty change');
    }
    const baseVersionId = this.handle.currentVersion().id;
    const changeId = options.changeId ?? this.createChangeId();
    this.handle.apply(change, {
      meta: {
        source: 'user',
        origin: 'editor',
        changeId,
        ...options.meta,
      },
      validate: true,
    });
    const applied = change.clone().freeze();
    this.pending.push({
      changeId,
      original: applied,
      applied,
      baseVersionId,
      inFlight: true,
    });
    const frame: EnvelopeFrame = {
      type: 'envelope',
      body: serializeCollabEnvelope({
        changeId,
        documentId: this.handle.documentId,
        baseVersionId,
        change: applied,
        dependsOn: this.pending
          .filter((p) => p.changeId !== changeId)
          .map((p) => p.changeId),
        meta: {
          source: 'user',
          origin: 'editor',
          changeId,
          ...options.meta,
        },
      }),
    };
    void Promise.resolve(this.send(frame));
    return frame;
  }

  /** Ingest a control frame from transport. */
  onFrame(frame: CollabControlFrame | unknown): void {
    if (!isCollabControlFrame(frame)) {
      return;
    }
    switch (frame.type) {
      case 'ack':
        this.onAck(frame);
        return;
      case 'envelope':
        this.onRemoteEnvelope(frame);
        return;
      case 'sync':
        if (frame.role === 'response') {
          this.onSyncResponse(frame);
        }
        return;
      case 'reject':
        this.onReject(frame);
        return;
      default:
        return;
    }
  }

  /**
   * Narrow reconnect: sync → (caller applies response) → rebase → resubmit.
   */
  beginReconnectSync(requestId?: string): SyncRequestFrame {
    const fromVersionId = this.confirmed?.id;
    const req: SyncRequestFrame = {
      type: 'sync',
      role: 'request',
      documentId: this.handle.documentId,
      fromVersionId,
      requestId,
    };
    void Promise.resolve(this.send(req));
    return req;
  }

  /**
   * After sync response applied: rebase pending against new HEAD and resubmit.
   */
  rebaseAndResubmit(): void {
    const head = this.handle.currentVersion();
    for (const p of this.pending) {
      p.inFlight = false;
      // Re-author from original against current contents via transform through
      // intervening remote-only history is already applied on handle;
      // pending.applied should match remaining local intent relative to HEAD.
      // After sync, handle is at server HEAD without locals — re-apply originals
      // in order with OT through each other.
    }
    // Rebuild: handle should be at server HEAD (no pending applied).
    // Apply each pending original sequentially with transform.
    const serverContents = this.handle.getContents().clone();
    let base = this.handle.currentVersion();
    const rebuilt: PendingLocalChange[] = [];
    let composedLocal = new ChangeSet();
    for (const p of this.pending) {
      let next = p.original.clone();
      // Transform through previously rebuilt locals (they have priority as earlier).
      for (const prev of rebuilt) {
        next = prev.applied.transform(next, true);
      }
      if (next.length() === 0) continue;
      this.handle.apply(next, {
        meta: {
          source: 'user',
          origin: 'editor',
          changeId: p.changeId,
        },
        validate: true,
      });
      const entry: PendingLocalChange = {
        changeId: p.changeId,
        original: p.original,
        applied: next.freeze(),
        baseVersionId: base.id,
        inFlight: true,
      };
      rebuilt.push(entry);
      base = this.handle.currentVersion();
      composedLocal = composedLocal.compose(next);
      void serverContents;
      const frame: EnvelopeFrame = {
        type: 'envelope',
        body: serializeCollabEnvelope({
          changeId: entry.changeId,
          documentId: this.handle.documentId,
          baseVersionId: entry.baseVersionId,
          change: entry.applied,
          dependsOn: rebuilt
            .filter((x) => x.changeId !== entry.changeId)
            .map((x) => x.changeId),
          meta: {
            source: 'user',
            origin: 'editor',
            changeId: entry.changeId,
          },
        }),
      };
      void Promise.resolve(this.send(frame));
    }
    this.pending.length = 0;
    this.pending.push(...rebuilt);
  }

  private onAck(ack: AckFrame): void {
    if (ack.documentId !== this.handle.documentId) return;
    const prev = this.ackLevels.get(ack.changeId);
    // Never regress ACK level order.
    const order = ['received', 'persisted', 'accepted', 'history'] as const;
    if (prev) {
      if (order.indexOf(ack.level) < order.indexOf(prev)) {
        return;
      }
    }
    this.ackLevels.set(ack.changeId, ack.level);

    if (ack.level === 'accepted') {
      // Do not clear confirmed; may clear nothing until history.
      return;
    }
    if (ack.level === 'history') {
      if (!ack.versionId) return;
      let version: DocumentVersion | undefined;
      try {
        version = this.handle.getVersion(ack.versionId);
      } catch {
        // Unknown Version — must sync before confirming.
        this.beginReconnectSync();
        return;
      }
      // Monotonic confirmed: only advance sequence.
      if (
        this.confirmed == null ||
        version.sequence >= this.confirmed.sequence
      ) {
        this.confirmed = version;
        this.serverHeadId = version.id;
      }
      const idx = this.pending.findIndex((p) => p.changeId === ack.changeId);
      if (idx >= 0) this.pending.splice(idx, 1);
    }
  }

  private onRemoteEnvelope(frame: EnvelopeFrame): void {
    let env;
    try {
      env = parseCollabEnvelope(frame.body);
    } catch {
      return;
    }
    if (env.documentId !== this.handle.documentId) return;
    if (this.seenRemote.has(env.changeId)) return;
    if (this.pending.some((p) => p.changeId === env.changeId)) {
      // Echo of our own change (server broadcast) — skip apply; wait for history.
      this.seenRemote.add(env.changeId);
      return;
    }
    this.seenRemote.add(env.changeId);

    let server = env.change.clone();
    for (const p of this.pending) {
      const local = p.applied;
      const newServer = local.transform(server, false);
      const newLocal = server.transform(local, true);
      p.applied = newLocal.freeze();
      server = newServer;
    }
    if (server.length() > 0) {
      this.handle.apply(server, {
        meta: {
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
    this.serverHeadId = this.handle.currentVersion().id;
  }

  private onSyncResponse(frame: SyncResponseFrame): void {
    if (frame.documentId !== this.handle.documentId) return;

    const pendingSnapshot = this.pending.map((p) => ({
      changeId: p.changeId,
      original: p.original.clone().freeze(),
      baseVersionId: p.baseVersionId,
    }));

    // Snapshot + deltas path (ADR-031)
    if (frame.baseSnapshot) {
      try {
        const snap = parseDocumentSnapshot(frame.baseSnapshot);
        const base = snapshotAsHydrationRoot(snap);
        const parsed: DocumentVersion[] = [base];
        const seen = new Set([base.id]);
        for (const raw of frame.versions) {
          const v = parseDocumentVersion(raw);
          if (!seen.has(v.id)) {
            parsed.push(v);
            seen.add(v.id);
          }
        }
        this.handle = DocumentHandle.fromVersions(parsed, {
          validate: true,
          verifyComposeIntegrity: true,
          compactedRoot: true,
        });
        this.serverHeadId =
          frame.headVersionId ?? this.handle.currentVersion().id;
        this.confirmed = this.handle.currentVersion();
        this.pending.length = 0;
        for (const p of pendingSnapshot) {
          this.pending.push({
            changeId: p.changeId,
            original: p.original,
            applied: p.original,
            baseVersionId: p.baseVersionId,
            inFlight: false,
          });
        }
        this.rebaseAndResubmit();
        return;
      } catch {
        return;
      }
    }

    // Materialize missing Versions onto a clean server view:
    // Drop local pending from handle by rehydrating confirmed+sync chain.
    const confirmedId = this.confirmed?.id;
    const existing = this.handle.listVersions();
    const parsed: DocumentVersion[] = [];
    for (const raw of frame.versions) {
      parsed.push(parseDocumentVersion(raw));
    }
    if (parsed.length === 0) {
      this.serverHeadId = frame.headVersionId;
      return;
    }
    // Build full chain: keep versions up to confirmed, then append sync slice.
    let prefix: DocumentVersion[] = [];
    if (confirmedId) {
      const idx = existing.findIndex((v) => v.id === confirmedId);
      if (idx >= 0) {
        prefix = [...existing.slice(0, idx + 1)];
      } else {
        // Confirmed missing — fail closed, keep pending, request again later.
        return;
      }
    } else {
      // No confirmed yet — use root only from existing if present.
      prefix = existing.length > 0 ? [existing[0]!] : [];
      if (prefix.length === 0) {
        // Need full chain from server — if sync returned only deltas, cannot proceed.
        return;
      }
    }
    // Ensure no duplicate ids when appending.
    const seen = new Set(prefix.map((v) => v.id));
    for (const v of parsed) {
      if (!seen.has(v.id)) {
        prefix.push(v);
        seen.add(v.id);
      }
    }
    this.handle = DocumentHandle.fromVersions(prefix, {
      validate: true,
      verifyComposeIntegrity: true,
      compactedRoot: prefix[0]!.sequence !== 0,
    });
    this.serverHeadId = frame.headVersionId ?? this.handle.currentVersion().id;
    if (frame.headVersionId) {
      try {
        this.confirmed =
          this.confirmed &&
          this.handle.listVersions().some((v) => v.id === this.confirmed!.id)
            ? this.handle.getVersion(this.confirmed.id)
            : this.handle.currentVersion();
      } catch {
        this.confirmed = this.handle.currentVersion();
      }
    }
    this.pending.length = 0;
    for (const p of pendingSnapshot) {
      this.pending.push({
        changeId: p.changeId,
        original: p.original,
        applied: p.original,
        baseVersionId: p.baseVersionId,
        inFlight: false,
      });
    }
    void this.maxRebaseDepth;
    this.rebaseAndResubmit();
  }

  private onReject(frame: RejectFrame): void {
    if (frame.documentId !== this.handle.documentId) return;
    if (frame.code === 'sync_required' || frame.code === 'unknown_base') {
      this.beginReconnectSync();
    }
    // Keep pending for retry unless authorization/invalid.
    if (
      frame.code === 'authorization_failed' ||
      frame.code === 'invalid_envelope'
    ) {
      if (frame.changeId) {
        const idx = this.pending.findIndex((p) => p.changeId === frame.changeId);
        if (idx >= 0) this.pending.splice(idx, 1);
      }
    }
  }
}
