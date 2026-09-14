/**
 * Thin collab host: owns sessions, proxies to document owners (ADR-024/025).
 * Clients speak documentId — not partition topology.
 */
import ChangeSet from 'lextrix-change';
import type {
  AuthoritativeDocumentPersistence,
  DocumentLifecycle,
  SnapshotPersistence,
} from 'lextrix-change/persistence';
import {
  DocumentServerSession,
  type CollabControlFrame,
  type DocumentOwnership,
  type DocumentOwnershipLease,
  type DocumentRegionStore,
  partitionForDocument,
} from 'lextrix-collab';
import type { CollabAuthHooks, CollabPrincipal } from './auth.js';
import type { ServerObserver } from './observe.js';
import type { WsCollabConnection } from './ws/index.js';

export interface CollabHostOptions {
  persistence: AuthoritativeDocumentPersistence;
  ownership: DocumentOwnership;
  auth: CollabAuthHooks;
  observe?: ServerObserver;
  partitionCount?: number;
  ownedPartitions?: readonly number[];
  ownerId: string;
  maxRebaseDepth?: number;
  snapshots?: SnapshotPersistence;
  lifecycle?: DocumentLifecycle;
  regions?: DocumentRegionStore;
  localRegion?: string;
}

type ConnState = {
  principal: CollabPrincipal;
  documentId?: string;
};

/**
 * In-process multi-document host. For multi-instance, each process owns a
 * partition subset; non-owned documents are rejected with sync/error so a
 * front proxy can retry on the owning instance (reference: proxy preferred).
 */
export class CollabHost {
  private readonly sessions = new Map<string, DocumentServerSession>();
  private readonly connState = new Map<string, ConnState>();
  private readonly subscribers = new Map<string, Set<WsCollabConnection>>();
  private readonly leases = new Map<string, DocumentOwnershipLease>();

  constructor(private readonly options: CollabHostOptions) {}

  async onConnect(
    conn: WsCollabConnection,
    info: { token?: string; headers: Record<string, string | string[] | undefined> },
  ): Promise<void> {
    const principal = await Promise.resolve(
      this.options.auth.authenticate({
        token: info.token,
        headers: info.headers,
        connectionId: conn.id,
      }),
    );
    if (!principal) {
      conn.send({
        type: 'error',
        code: 'unauthorized',
        message: 'authentication failed',
      });
      conn.close();
      return;
    }
    this.connState.set(conn.id, { principal });
    this.options.observe?.({
      name: 'client_connected',
      detail: { connectionId: conn.id, principalId: principal.principalId },
    });
  }

  onClose(conn: WsCollabConnection): void {
    const state = this.connState.get(conn.id);
    if (state?.documentId) {
      this.subscribers.get(state.documentId)?.delete(conn);
    }
    this.connState.delete(conn.id);
    this.options.observe?.({
      name: 'client_disconnected',
      detail: { connectionId: conn.id },
    });
  }

  async onMessage(
    conn: WsCollabConnection,
    frame: CollabControlFrame,
  ): Promise<void> {
    const state = this.connState.get(conn.id);
    if (!state) {
      conn.send({
        type: 'error',
        code: 'unauthorized',
        message: 'not authenticated',
      });
      return;
    }

    if (frame.type === 'sync' && frame.role === 'request') {
      await this.handleSync(conn, state, frame);
      return;
    }
    if (frame.type === 'envelope') {
      await this.handleEnvelope(conn, state, frame);
      return;
    }
    if (frame.type === 'presence') {
      await this.handlePresence(conn, state, frame);
      return;
    }
    // Clients may send ack/noop; ignore
  }

  private async handlePresence(
    conn: WsCollabConnection,
    state: ConnState,
    frame: Extract<CollabControlFrame, { type: 'presence' }>,
  ): Promise<void> {
    const documentId = frame.documentId;
    const allowed = await Promise.resolve(
      this.options.auth.authorize({
        principal: state.principal,
        documentId,
        op: 'presence_publish',
        connectionId: conn.id,
      }),
    );
    if (!allowed) {
      conn.send({
        type: 'reject',
        documentId,
        code: 'authorization_failed',
        message: 'presence not authorized',
      });
      return;
    }
    try {
      const session = await this.getOrOpenSession(documentId);
      this.bindConn(conn, state, documentId);
      if (frame.role === 'update') {
        // Stamp actor from principal — never trust client actorId.
        const out = session.publishPresence(
          state.principal.principalId,
          frame.generation ?? 0,
          frame.payload ?? {},
        );
        if (out.type === 'reject') {
          conn.send(out);
          this.options.observe?.({
            name: 'presence_dropped',
            documentId,
            detail: { code: out.code },
          });
          return;
        }
        conn.send(out);
        this.broadcast(documentId, out);
        this.options.observe?.({ name: 'presence_update', documentId });
      } else if (frame.role === 'state') {
        conn.send(session.presenceState());
      }
    } catch (err) {
      // Presence failure must not take down the connection for documents.
      this.options.observe?.({
        name: 'presence_error',
        documentId,
        detail: { message: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  private async handleSync(
    conn: WsCollabConnection,
    state: ConnState,
    frame: Extract<CollabControlFrame, { type: 'sync' }>,
  ): Promise<void> {
    if (frame.role !== 'request') return;
    const documentId = frame.documentId;
    const allowed = await Promise.resolve(
      this.options.auth.authorize({
        principal: state.principal,
        documentId,
        op: 'sync',
        connectionId: conn.id,
      }),
    );
    if (!allowed) {
      conn.send({
        type: 'reject',
        documentId,
        code: 'authorization_failed',
        message: 'sync not authorized',
      });
      return;
    }
    try {
      const session = await this.getOrOpenSession(documentId);
      this.bindConn(conn, state, documentId);
      const resp = await session.sync(frame);
      conn.send(resp);
    } catch (err) {
      conn.send({
        type: 'error',
        documentId,
        code: 'sync_failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async handleEnvelope(
    conn: WsCollabConnection,
    state: ConnState,
    frame: Extract<CollabControlFrame, { type: 'envelope' }>,
  ): Promise<void> {
    // Peek documentId from body when possible
    let documentId = state.documentId;
    const body = frame.body as { documentId?: string };
    if (typeof body?.documentId === 'string') {
      documentId = body.documentId;
    }
    if (!documentId) {
      conn.send({
        type: 'error',
        code: 'invalid_envelope',
        message: 'missing documentId',
      });
      return;
    }
    const allowed = await Promise.resolve(
      this.options.auth.authorize({
        principal: state.principal,
        documentId,
        op: 'submit',
        connectionId: conn.id,
      }),
    );
    if (!allowed) {
      conn.send({
        type: 'reject',
        documentId,
        code: 'authorization_failed',
        message: 'submit not authorized',
      });
      return;
    }
    this.options.observe?.({ name: 'submissions', documentId });
    try {
      const session = await this.getOrOpenSession(documentId);
      this.bindConn(conn, state, documentId);
      const result = await session.accept(frame, {
        actorId: state.principal.principalId,
      });
      for (const f of result.frames) {
        this.broadcast(documentId, f);
      }
      if (result.ok) {
        this.options.observe?.({
          name: result.duplicate ? 'duplicate_changeId' : 'accepted',
          documentId,
        });
        this.options.observe?.({ name: 'history_ack', documentId });
      } else {
        this.options.observe?.({
          name: 'rejected',
          documentId,
          detail: { code: result.code },
        });
      }
    } catch (err) {
      conn.send({
        type: 'error',
        documentId,
        code: 'accept_failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private bindConn(
    conn: WsCollabConnection,
    state: ConnState,
    documentId: string,
  ): void {
    if (state.documentId && state.documentId !== documentId) {
      this.subscribers.get(state.documentId)?.delete(conn);
    }
    state.documentId = documentId;
    let set = this.subscribers.get(documentId);
    if (!set) {
      set = new Set();
      this.subscribers.set(documentId, set);
    }
    set.add(conn);
  }

  private broadcast(documentId: string, frame: CollabControlFrame): void {
    const set = this.subscribers.get(documentId);
    if (!set) return;
    for (const c of set) {
      c.send(frame);
    }
    this.options.observe?.({
      name: 'broadcast',
      documentId,
      detail: { subscribers: set.size },
    });
  }

  private async getOrOpenSession(
    documentId: string,
  ): Promise<DocumentServerSession> {
    const existing = this.sessions.get(documentId);
    if (existing) return existing;

    const partitionCount = this.options.partitionCount ?? 16;
    const partition = partitionForDocument(documentId, partitionCount);
    if (
      this.options.ownedPartitions &&
      this.options.ownedPartitions.length > 0 &&
      !this.options.ownedPartitions.includes(partition)
    ) {
      throw new Error(
        `document ${documentId} owned by another partition (${partition}) — proxy to owner`,
      );
    }

    let lease = this.leases.get(documentId);
    if (!lease) {
      lease = await this.options.ownership.acquire(documentId);
      this.leases.set(documentId, lease);
      this.options.observe?.({
        name: 'ownership_acquisition',
        documentId,
        detail: { ownerEpoch: lease.ownerEpoch },
      });
    }

    const session = await DocumentServerSession.open(
      documentId,
      {
        persistence: this.options.persistence,
        ownership: this.options.ownership,
        lease,
        maxRebaseDepth: this.options.maxRebaseDepth,
        authorizeEnvelope: async () => true, // host already AuthZ'd
        resolveActorMeta: ({ actorId }) => ({
          actorId: actorId,
        }),
        observe: (e) => this.options.observe?.(e),
        snapshots: this.options.snapshots,
        lifecycle: this.options.lifecycle,
        regions: this.options.regions,
        localRegion: this.options.localRegion,
      },
      {
        contents: new ChangeSet([{ insert: '\n' }]),
        createIfMissing: true,
      },
    );
    this.sessions.set(documentId, session);
    return session;
  }

  /** Test helper: drop in-memory session (forces rehydrate). */
  dropSession(documentId: string): void {
    const s = this.sessions.get(documentId);
    s?.close();
    this.sessions.delete(documentId);
  }

  async releaseAll(): Promise<void> {
    for (const [docId, lease] of this.leases) {
      await this.options.ownership.release(lease);
      this.options.observe?.({ name: 'ownership_loss', documentId: docId });
    }
    this.leases.clear();
    for (const s of this.sessions.values()) s.close();
    this.sessions.clear();
  }
}
