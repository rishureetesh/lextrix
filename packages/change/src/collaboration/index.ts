/**
 * Provider-neutral collaboration ports (ADR-019).
 * Transport carries envelopes; adapters own OT coordination.
 * No production network libraries in this package.
 */
export type {
  CollaborationAdapter,
  CollabAck,
} from './adapter.js';
export {
  type CollaborationTransport,
  type CollabAckLevel,
  type TransportErrorCode,
  COLLAB_ACK_LEVELS,
  isCollabAckLevel,
  TransportError,
  InMemoryCollaborationTransport,
} from './transport.js';
