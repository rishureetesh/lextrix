/**
 * Minimal collaboration adapter port (ADR-019).
 * Adapters own pending state, dedup, ACK, remote ingest, causality —
 * and call Document/ChangeSet APIs (no second mutation system).
 */
import type ChangeSet from '../change/change-set.js';
import type { ChangeMeta } from '../experimental/change-meta.js';
import type {
  CollabApplyRemoteResult,
  CollabEnvelope,
  PendingLocal,
} from '../experimental/collaboration.js';
import type { DocumentHandle } from '../experimental/document-handle.js';
import type { DocumentVersion } from '../experimental/version.js';
import type { CollabAckLevel } from './transport.js';

/**
 * ACK notification for a previously submitted change.
 * Levels are distinct — never treat as interchangeable.
 */
export interface CollabAck {
  changeId: string;
  level: CollabAckLevel;
  /** Set when level is `history` (authoritative Version id). */
  versionId?: string;
}

/**
 * Smallest reusable collaboration adapter surface for future transports.
 * InMemoryCollaborationAdapter is a reference implementation, not this port alone.
 */
export interface CollaborationAdapter {
  getHandle(): DocumentHandle;

  /**
   * Latest Version acknowledged by the collaboration authority for this session.
   * NOT synonymous with Handle HEAD when pending locals exist.
   */
  getConfirmedVersion(): DocumentVersion | null;

  /** Local HEAD (same as handle.currentVersion()). */
  getLocalHead(): DocumentVersion;

  getPending(): readonly PendingLocal[];

  /**
   * After local ChangeSet applied to Document — publish envelope.
   */
  submitLocal(
    change: ChangeSet,
    options: {
      changeId?: string;
      baseVersionId: string;
      meta?: Partial<ChangeMeta>;
    },
  ): CollabEnvelope;

  ingestRemote(env: CollabEnvelope): CollabApplyRemoteResult;

  /** Process an explicit ACK ladder notification. */
  processAck(ack: CollabAck): void;

  destroy(): void;
}
