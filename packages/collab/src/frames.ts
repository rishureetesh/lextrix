/**
 * Collaboration control frames (ADR-022 / ADR-031 / ADR-032).
 * Ride beside ADR-012 envelopes — ADR-012 kinds unchanged.
 */
import type { CollabAckLevel } from 'lextrix-change/collaboration';
import type { DocumentVersion } from 'lextrix-change/document';
import type { SerializedCollabEnvelope } from 'lextrix-change/wire';
import type { SerializedDocumentSnapshot } from 'lextrix-change/persistence';
import type { PresencePayload } from './presence.js';

export type CollabFrameType =
  | 'envelope'
  | 'ack'
  | 'sync'
  | 'reject'
  | 'error'
  | 'presence';

export interface EnvelopeFrame {
  type: 'envelope';
  body: SerializedCollabEnvelope | unknown;
}

export interface AckFrame {
  type: 'ack';
  changeId: string;
  level: CollabAckLevel;
  versionId?: string;
  documentId: string;
}

export interface SyncRequestFrame {
  type: 'sync';
  role: 'request';
  documentId: string;
  fromVersionId?: string;
  requestId?: string;
}

export interface SyncResponseFrame {
  type: 'sync';
  role: 'response';
  documentId: string;
  fromVersionId?: string;
  /** Authoritative Versions after base through HEAD (wire or Version). */
  versions: unknown[];
  headVersionId: string | null;
  requestId?: string;
  /**
   * Additive (ADR-031): when client's base is compacted, hydrate from this
   * checkpoint then apply `versions` deltas. Not an ADR-012 document kind.
   */
  baseSnapshot?: SerializedDocumentSnapshot;
  compactionApplied?: boolean;
}

export type RejectCode =
  | 'sync_required'
  | 'unknown_base'
  | 'causal_dependency'
  | 'authorization_failed'
  | 'duplicate_change'
  | 'queue_full'
  | 'rebase_limit'
  | 'invalid_envelope'
  | 'wrong_document'
  | 'empty_change'
  | 'apply_failed'
  | 'cas_conflict'
  | 'persistence_error'
  | 'stale_owner'
  | 'document_tombstoned'
  | 'version_unavailable'
  | 'presence_rejected';

export interface RejectFrame {
  type: 'reject';
  documentId: string;
  changeId?: string;
  code: RejectCode;
  message: string;
}

export interface ErrorFrame {
  type: 'error';
  documentId?: string;
  code: string;
  message: string;
}

/** Presence control frame — never a document mutation. */
export interface PresenceFrame {
  type: 'presence';
  role: 'update' | 'remove' | 'state';
  documentId: string;
  /** Stamped by server from AuthN — clients must not trust peer claims. */
  actorId?: string;
  generation?: number;
  payload?: PresencePayload;
  /** Full roster for `state` role. */
  entries?: Array<{
    actorId: string;
    generation: number;
    serverTime: number;
    payload: PresencePayload;
  }>;
}

export type CollabControlFrame =
  | EnvelopeFrame
  | AckFrame
  | SyncRequestFrame
  | SyncResponseFrame
  | RejectFrame
  | ErrorFrame
  | PresenceFrame;

export function isCollabControlFrame(value: unknown): value is CollabControlFrame {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const t = (value as { type?: unknown }).type;
  return (
    t === 'envelope' ||
    t === 'ack' ||
    t === 'sync' ||
    t === 'reject' ||
    t === 'error' ||
    t === 'presence'
  );
}

/** Observability-neutral hook (no vendor). */
export type CollabObserver = (event: {
  name: string;
  documentId?: string;
  detail?: Record<string, unknown>;
}) => void;

export type { DocumentVersion };
