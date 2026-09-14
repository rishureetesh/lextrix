/**
 * lextrix-collab — authoritative collaboration protocol (Phase 10–12).
 *
 * Stable protocol types: frames, ACK/sync/reject/presence.
 * Reference: DocumentServerSession, AuthoritativeClientSession,
 * InMemoryAuthoritativePersistence (via lextrix-change/persistence).
 *
 * No DB / WebSocket / Auth vendor dependencies.
 */
export {
  type CollabFrameType,
  type CollabControlFrame,
  type EnvelopeFrame,
  type AckFrame,
  type SyncRequestFrame,
  type SyncResponseFrame,
  type RejectFrame,
  type RejectCode,
  type ErrorFrame,
  type PresenceFrame,
  type CollabObserver,
  isCollabControlFrame,
} from './frames.js';

export {
  DocumentServerSession,
  type DocumentServerSessionOptions,
  type AuthorizeEnvelope,
  type AcceptResult,
  type CollabEnvelopeLike,
} from './server-session.js';

export {
  AuthoritativeClientSession,
  type AuthoritativeClientOptions,
  type PendingLocalChange,
} from './client-session.js';

export {
  DEFAULT_COLLAB_LIMITS,
  type CollabLimits,
} from './limits.js';

export {
  type DocumentOwnership,
  type DocumentOwnershipLease,
  type PartitionConfig,
  partitionForDocument,
  InMemoryDocumentOwnership,
} from './ownership.js';

export {
  EphemeralPresenceStore,
  DEFAULT_PRESENCE_LIMITS,
  type PresenceEntry,
  type PresencePayload,
  type PresenceLimits,
  type PresencePublishResult,
} from './presence.js';

export {
  type DocumentRegionStore,
  InMemoryDocumentRegionStore,
  assignHomeRegion,
  promoteDocumentRegion,
  type RegionPromotionResult,
} from './region.js';
