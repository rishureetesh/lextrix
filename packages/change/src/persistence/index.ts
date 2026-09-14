/**
 * Provider-neutral persistence contracts (ADR-018 / ADR-021 / ADR-031 / ADR-035).
 * Stores Versions only — never mutates Documents.
 *
 * In-memory adapters are reference implementations for tests/examples.
 * They are NOT production durable stores.
 */
export type { DocumentPersistence } from './types.js';
export type {
  AuthoritativeDocumentPersistence,
  CompareAndAppendResult,
  CompareAndAppendOptions,
} from './authority-types.js';
export { PersistenceError, type PersistenceErrorCode } from './errors.js';
export { InMemoryDocumentPersistence } from './memory.js';
export { InMemoryAuthoritativePersistence } from './authority-memory.js';
export {
  attachPersistence,
  type AttachPersistenceOptions,
  type PersistenceAttachment,
} from './attach.js';
export {
  validateVersionChain,
  type ValidateVersionChainOptions,
} from '../experimental/validate-version-chain.js';

export {
  type DocumentSnapshot,
  type SerializedDocumentSnapshot,
  type SnapshotIntegrity,
  type SnapshotPersistence,
  type SnapshotPolicy,
  SNAPSHOT_HASH_ALGORITHM,
  DEFAULT_SNAPSHOT_EVERY_N_VERSIONS,
  hashChangeSetContents,
  createSnapshotFromVersion,
  verifySnapshot,
  serializeDocumentSnapshot,
  parseDocumentSnapshot,
  InMemorySnapshotPersistence,
  defaultSnapshotPolicy,
  shouldSnapshotAtSequence,
} from './snapshot.js';

export {
  type VersionArchive,
  type VersionRetentionState,
  InMemoryVersionArchive,
} from './archive.js';

export {
  type DocumentLifecycle,
  type DocumentLifecycleState,
  InMemoryDocumentLifecycle,
  assertDocumentMutable,
} from './lifecycle.js';

export {
  CompactionController,
  type CompactionOptions,
  type CompactionPhase,
  type CompactionStatus,
} from './compaction.js';
