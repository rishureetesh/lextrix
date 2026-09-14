/**
 * lextrix-server — production host composition (Phase 11–12).
 *
 * Vendor adapters (pg, ws) live here — not in lextrix-change.
 */
export {
  PostgresAuthoritativePersistence,
  PostgresDocumentOwnership,
  PostgresSnapshotPersistence,
  PostgresVersionArchive,
  PostgresDocumentLifecycle,
  PostgresDocumentRegionStore,
  migratePostgres,
} from './postgres/index.js';

export { WsCollabServer, type WsCollabConnection, type WsCollabServerOptions } from './ws/index.js';

export {
  type CollabAuthHooks,
  type CollabPrincipal,
  type CollabAuthContext,
  type CollabAuthOp,
  allowAllAuth,
} from './auth.js';

export {
  type ServerObserver,
  type ServerMetricEvent,
  createCountingObserver,
} from './observe.js';

export { CollabHost, type CollabHostOptions } from './host.js';
