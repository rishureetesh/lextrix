/**
 * Compaction orchestration helpers (ADR-031).
 * Seal → archive → optional purge. Never purge first.
 */
import type { AuthoritativeDocumentPersistence } from './authority-types.js';
import type { VersionArchive } from './archive.js';
import type { SnapshotPersistence, SnapshotPolicy } from './snapshot.js';
import {
  createSnapshotFromVersion,
  defaultSnapshotPolicy,
  shouldSnapshotAtSequence,
  verifySnapshot,
} from './snapshot.js';
import { PersistenceError } from './errors.js';
import type { DocumentVersion } from '../experimental/version.js';

export type CompactionPhase =
  | 'idle'
  | 'snapshot_created'
  | 'sealed'
  | 'archived'
  | 'purged';

export type CompactionStatus = {
  documentId: string;
  phase: CompactionPhase;
  sealedVersionId: string | null;
  sealedSequence: number | null;
};

export type CompactionOptions = {
  persistence: AuthoritativeDocumentPersistence;
  snapshots: SnapshotPersistence;
  archive: VersionArchive;
  policy?: SnapshotPolicy;
  /** When true, purge archived Versions older than sealed checkpoint. */
  purgeAfterArchive?: boolean;
  /**
   * Remove Versions strictly older than sealed from the hot store.
   * Required for real compaction; archive must succeed first.
   */
  removeHotBeforeSeal?: (
    documentId: string,
    beforeSequence: number,
  ) => Promise<void> | void;
  observe?: (event: {
    name: string;
    documentId: string;
    detail?: Record<string, unknown>;
  }) => void;
};

export class CompactionController {
  private readonly status = new Map<string, CompactionStatus>();
  private readonly opts: CompactionOptions;
  private readonly policy: SnapshotPolicy;

  constructor(options: CompactionOptions) {
    this.opts = options;
    this.policy = options.policy ?? defaultSnapshotPolicy();
  }

  getStatus(documentId: string): CompactionStatus {
    return (
      this.status.get(documentId) ?? {
        documentId,
        phase: 'idle',
        sealedVersionId: null,
        sealedSequence: null,
      }
    );
  }

  /**
   * If HEAD matches cadence, create a verified snapshot (does not archive).
   */
  async maybeSnapshot(documentId: string): Promise<DocumentVersion | null> {
    const head = await Promise.resolve(
      this.opts.persistence.loadHead(documentId),
    );
    if (!head) return null;
    if (!shouldSnapshotAtSequence(head.sequence, this.policy)) return null;
    return this.createSnapshotAt(documentId, head);
  }

  async createSnapshotAt(
    documentId: string,
    version: DocumentVersion,
  ): Promise<DocumentVersion> {
    if (version.documentId !== documentId) {
      throw new PersistenceError(
        'invalid_argument',
        'createSnapshotAt: documentId mismatch',
      );
    }
    const snap = createSnapshotFromVersion(version);
    verifySnapshot(snap, version);
    await Promise.resolve(this.opts.snapshots.createSnapshot(snap));
    // Re-verify after persist
    const loaded = await Promise.resolve(
      this.opts.snapshots.getSnapshot(documentId, version.id),
    );
    if (!loaded) {
      throw new PersistenceError(
        'persistence_error',
        'snapshot missing after create',
      );
    }
    verifySnapshot(loaded, version);
    this.status.set(documentId, {
      documentId,
      phase: 'snapshot_created',
      sealedVersionId: version.id,
      sealedSequence: version.sequence,
    });
    this.opts.observe?.({
      name: 'snapshot_created',
      documentId,
      detail: { versionId: version.id, sequence: version.sequence },
    });
    return version;
  }

  /**
   * Seal boundary at version, archive older hot Versions, optionally purge.
   */
  async compactTo(
    documentId: string,
    sealedVersionId: string,
    options: { purge?: boolean } = {},
  ): Promise<CompactionStatus> {
    const sealed = await Promise.resolve(
      this.opts.persistence.loadVersion(documentId, sealedVersionId),
    );
    if (!sealed) {
      throw new PersistenceError(
        'not_found',
        `compactTo: sealed Version ${sealedVersionId} not in hot store`,
      );
    }
    const snap = await Promise.resolve(
      this.opts.snapshots.getSnapshot(documentId, sealedVersionId),
    );
    if (!snap) {
      throw new PersistenceError(
        'invalid_argument',
        'compactTo: snapshot required before seal',
      );
    }
    verifySnapshot(snap, sealed);

    this.status.set(documentId, {
      documentId,
      phase: 'sealed',
      sealedVersionId: sealed.id,
      sealedSequence: sealed.sequence,
    });
    this.opts.observe?.({
      name: 'compaction_sealed',
      documentId,
      detail: { versionId: sealed.id },
    });

    const chain = await Promise.resolve(
      this.opts.persistence.loadChain(documentId),
    );
    const older = chain.filter((v) => v.sequence < sealed.sequence);
    if (older.length > 0) {
      await Promise.resolve(
        this.opts.archive.archiveVersions(documentId, older),
      );
      // Confirm archive
      for (const v of older) {
        const a = await Promise.resolve(
          this.opts.archive.loadArchivedVersion(documentId, v.id),
        );
        if (!a) {
          throw new PersistenceError(
            'persistence_error',
            `archive incomplete for ${v.id}; abort purge`,
          );
        }
      }
    }

    this.status.set(documentId, {
      documentId,
      phase: 'archived',
      sealedVersionId: sealed.id,
      sealedSequence: sealed.sequence,
    });
    this.opts.observe?.({
      name: 'compaction_archived',
      documentId,
      detail: { count: older.length },
    });

    if (this.opts.removeHotBeforeSeal) {
      await Promise.resolve(
        this.opts.removeHotBeforeSeal(documentId, sealed.sequence),
      );
    }

    const doPurge = options.purge ?? this.opts.purgeAfterArchive ?? false;
    if (doPurge) {
      // Re-verify snapshot before purge
      verifySnapshot(snap, sealed);
      await Promise.resolve(
        this.opts.archive.purgeArchivedVersions(documentId, sealed.sequence),
      );
      this.status.set(documentId, {
        documentId,
        phase: 'purged',
        sealedVersionId: sealed.id,
        sealedSequence: sealed.sequence,
      });
      this.opts.observe?.({
        name: 'compaction_purged',
        documentId,
        detail: { beforeSequence: sealed.sequence },
      });
    }

    return this.getStatus(documentId);
  }
}
