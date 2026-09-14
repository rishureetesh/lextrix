/**
 * Snapshot checkpoints (ADR-031). Keyed to an existing Version — never a second HEAD.
 */
import { createHash } from 'node:crypto';
import type ChangeSet from '../change/change-set.js';
import { DocumentVersion } from '../experimental/version.js';
import {
  serializeChangeSet,
  parseChangeSet,
  changeSetsEqual,
} from '../wire/changeset.js';
import { PersistenceError } from './errors.js';

export const SNAPSHOT_HASH_ALGORITHM = 'sha256' as const;

export type SnapshotIntegrity = {
  algorithm: typeof SNAPSHOT_HASH_ALGORITHM;
  /** Hex digest of canonical ADR-012 ChangeSet JSON. */
  contentHash: string;
};

export type DocumentSnapshot = {
  snapshotId: string;
  documentId: string;
  /** Authoritative Version this checkpoint equals. */
  versionId: string;
  sequence: number;
  /** Materialized DocumentState (insert-only ChangeSet). */
  contents: ChangeSet;
  createdAt: string;
  integrity: SnapshotIntegrity;
};

export type SerializedDocumentSnapshot = {
  snapshotId: string;
  documentId: string;
  versionId: string;
  sequence: number;
  contents: unknown;
  createdAt: string;
  integrity: SnapshotIntegrity;
};

export function hashChangeSetContents(contents: ChangeSet): string {
  const canonical = JSON.stringify(serializeChangeSet(contents));
  return createHash(SNAPSHOT_HASH_ALGORITHM).update(canonical).digest('hex');
}

export function createSnapshotFromVersion(
  version: DocumentVersion,
  options: { snapshotId?: string; createdAt?: string } = {},
): DocumentSnapshot {
  const contents = version.contents.clone().freeze();
  const contentHash = hashChangeSetContents(contents);
  return {
    snapshotId:
      options.snapshotId ?? `snap_${version.documentId}_${version.id}`,
    documentId: version.documentId,
    versionId: version.id,
    sequence: version.sequence,
    contents,
    createdAt: options.createdAt ?? new Date().toISOString(),
    integrity: {
      algorithm: SNAPSHOT_HASH_ALGORITHM,
      contentHash,
    },
  };
}

/**
 * Fail closed on integrity mismatch or Version binding mismatch.
 */
export function verifySnapshot(
  snapshot: DocumentSnapshot,
  authoritative?: DocumentVersion | null,
): void {
  if (snapshot.integrity.algorithm !== SNAPSHOT_HASH_ALGORITHM) {
    throw new PersistenceError(
      'invalid_argument',
      `unsupported snapshot hash algorithm: ${snapshot.integrity.algorithm}`,
    );
  }
  const expected = hashChangeSetContents(snapshot.contents);
  if (expected !== snapshot.integrity.contentHash) {
    throw new PersistenceError(
      'persistence_conflict',
      'snapshot integrity hash mismatch',
    );
  }
  if (authoritative) {
    if (authoritative.id !== snapshot.versionId) {
      throw new PersistenceError(
        'invalid_argument',
        'snapshot.versionId does not match authoritative Version',
      );
    }
    if (authoritative.documentId !== snapshot.documentId) {
      throw new PersistenceError(
        'invalid_argument',
        'snapshot.documentId mismatch',
      );
    }
    if (!changeSetsEqual(authoritative.contents, snapshot.contents)) {
      throw new PersistenceError(
        'persistence_conflict',
        'snapshot contents ≠ Version.contents',
      );
    }
  }
}

export function serializeDocumentSnapshot(
  snapshot: DocumentSnapshot,
): SerializedDocumentSnapshot {
  return {
    snapshotId: snapshot.snapshotId,
    documentId: snapshot.documentId,
    versionId: snapshot.versionId,
    sequence: snapshot.sequence,
    contents: serializeChangeSet(snapshot.contents),
    createdAt: snapshot.createdAt,
    integrity: { ...snapshot.integrity },
  };
}

export function parseDocumentSnapshot(
  input: SerializedDocumentSnapshot | unknown,
): DocumentSnapshot {
  if (input == null || typeof input !== 'object') {
    throw new PersistenceError('invalid_argument', 'invalid snapshot payload');
  }
  const o = input as Record<string, unknown>;
  if (
    typeof o.snapshotId !== 'string' ||
    typeof o.documentId !== 'string' ||
    typeof o.versionId !== 'string' ||
    typeof o.sequence !== 'number' ||
    typeof o.createdAt !== 'string'
  ) {
    throw new PersistenceError('invalid_argument', 'snapshot missing fields');
  }
  const integrity = o.integrity as SnapshotIntegrity | undefined;
  if (
    integrity == null ||
    integrity.algorithm !== SNAPSHOT_HASH_ALGORITHM ||
    typeof integrity.contentHash !== 'string'
  ) {
    throw new PersistenceError('invalid_argument', 'snapshot missing integrity');
  }
  const contents = parseChangeSet(o.contents);
  const snapshot: DocumentSnapshot = {
    snapshotId: o.snapshotId,
    documentId: o.documentId,
    versionId: o.versionId,
    sequence: o.sequence,
    contents: contents.clone().freeze(),
    createdAt: o.createdAt,
    integrity: {
      algorithm: SNAPSHOT_HASH_ALGORITHM,
      contentHash: integrity.contentHash,
    },
  };
  verifySnapshot(snapshot);
  return snapshot;
}

export interface SnapshotPersistence {
  createSnapshot(snapshot: DocumentSnapshot): Promise<void> | void;
  getSnapshot(
    documentId: string,
    versionId: string,
  ): Promise<DocumentSnapshot | null> | DocumentSnapshot | null;
  getLatestSnapshot(
    documentId: string,
  ): Promise<DocumentSnapshot | null> | DocumentSnapshot | null;
  listSnapshots?(
    documentId: string,
  ): Promise<readonly DocumentSnapshot[]> | readonly DocumentSnapshot[];
}

export class InMemorySnapshotPersistence implements SnapshotPersistence {
  private readonly byKey = new Map<string, DocumentSnapshot>();
  private readonly byDoc = new Map<string, DocumentSnapshot[]>();

  createSnapshot(snapshot: DocumentSnapshot): void {
    verifySnapshot(snapshot);
    const key = `${snapshot.documentId}\0${snapshot.versionId}`;
    const existing = this.byKey.get(key);
    if (existing) {
      if (
        existing.integrity.contentHash === snapshot.integrity.contentHash &&
        existing.snapshotId === snapshot.snapshotId
      ) {
        return;
      }
      if (existing.integrity.contentHash !== snapshot.integrity.contentHash) {
        throw new PersistenceError(
          'persistence_conflict',
          'conflicting snapshot for versionId',
        );
      }
    }
    const stored: DocumentSnapshot = {
      ...snapshot,
      contents: snapshot.contents.clone().freeze(),
      integrity: { ...snapshot.integrity },
    };
    this.byKey.set(key, stored);
    const list = this.byDoc.get(snapshot.documentId) ?? [];
    const filtered = list.filter((s) => s.versionId !== snapshot.versionId);
    filtered.push(stored);
    filtered.sort((a, b) => a.sequence - b.sequence);
    this.byDoc.set(snapshot.documentId, filtered);
  }

  getSnapshot(documentId: string, versionId: string): DocumentSnapshot | null {
    return this.byKey.get(`${documentId}\0${versionId}`) ?? null;
  }

  getLatestSnapshot(documentId: string): DocumentSnapshot | null {
    const list = this.byDoc.get(documentId);
    if (!list || list.length === 0) return null;
    return list[list.length - 1]!;
  }

  listSnapshots(documentId: string): readonly DocumentSnapshot[] {
    return Object.freeze([...(this.byDoc.get(documentId) ?? [])]);
  }

  clear(): void {
    this.byKey.clear();
    this.byDoc.clear();
  }
}

/** Default snapshot cadence (ADR-031 / Phase 12 open decision). */
export const DEFAULT_SNAPSHOT_EVERY_N_VERSIONS = 100;

export type SnapshotPolicy = {
  /** Create snapshot when (sequence+1) is divisible by N (default 100). */
  everyNVersions: number;
};

export function defaultSnapshotPolicy(
  overrides: Partial<SnapshotPolicy> = {},
): SnapshotPolicy {
  return {
    everyNVersions:
      overrides.everyNVersions ?? DEFAULT_SNAPSHOT_EVERY_N_VERSIONS,
  };
}

export function shouldSnapshotAtSequence(
  sequence: number,
  policy: SnapshotPolicy = defaultSnapshotPolicy(),
): boolean {
  const n = policy.everyNVersions;
  if (!Number.isInteger(n) || n <= 0) return false;
  return (sequence + 1) % n === 0;
}
