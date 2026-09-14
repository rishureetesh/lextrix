/**
 * PostgreSQL SnapshotPersistence (ADR-031).
 */
import type { Pool } from 'pg';
import {
  type DocumentSnapshot,
  type SnapshotPersistence,
  SNAPSHOT_HASH_ALGORITHM,
  parseDocumentSnapshot,
  serializeDocumentSnapshot,
  verifySnapshot,
  PersistenceError,
} from 'lextrix-change/persistence';

export class PostgresSnapshotPersistence implements SnapshotPersistence {
  constructor(private readonly pool: Pool) {}

  async createSnapshot(snapshot: DocumentSnapshot): Promise<void> {
    verifySnapshot(snapshot);
    const wire = serializeDocumentSnapshot(snapshot);
    await this.pool.query(
      `INSERT INTO document_snapshots
        (snapshot_id, document_id, version_id, sequence, contents, content_hash, hash_algorithm, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::timestamptz)
       ON CONFLICT (document_id, version_id) DO UPDATE SET
         contents = EXCLUDED.contents,
         content_hash = EXCLUDED.content_hash,
         snapshot_id = EXCLUDED.snapshot_id
       WHERE document_snapshots.content_hash = EXCLUDED.content_hash
          OR document_snapshots.content_hash IS NULL`,
      [
        snapshot.snapshotId,
        snapshot.documentId,
        snapshot.versionId,
        snapshot.sequence,
        JSON.stringify(wire.contents),
        snapshot.integrity.contentHash,
        SNAPSHOT_HASH_ALGORITHM,
        snapshot.createdAt,
      ],
    );
    // Detect conflict (different hash)
    const check = await this.pool.query(
      `SELECT content_hash FROM document_snapshots
       WHERE document_id = $1 AND version_id = $2`,
      [snapshot.documentId, snapshot.versionId],
    );
    const row = check.rows[0] as { content_hash: string } | undefined;
    if (row && row.content_hash !== snapshot.integrity.contentHash) {
      throw new PersistenceError(
        'persistence_conflict',
        'conflicting snapshot hash for versionId',
      );
    }
  }

  async getSnapshot(
    documentId: string,
    versionId: string,
  ): Promise<DocumentSnapshot | null> {
    const res = await this.pool.query(
      `SELECT snapshot_id, document_id, version_id, sequence, contents,
              content_hash, hash_algorithm, created_at
       FROM document_snapshots
       WHERE document_id = $1 AND version_id = $2`,
      [documentId, versionId],
    );
    if (res.rows.length === 0) return null;
    return rowToSnapshot(res.rows[0]);
  }

  async getLatestSnapshot(documentId: string): Promise<DocumentSnapshot | null> {
    const res = await this.pool.query(
      `SELECT snapshot_id, document_id, version_id, sequence, contents,
              content_hash, hash_algorithm, created_at
       FROM document_snapshots
       WHERE document_id = $1
       ORDER BY sequence DESC
       LIMIT 1`,
      [documentId],
    );
    if (res.rows.length === 0) return null;
    return rowToSnapshot(res.rows[0]);
  }
}

function rowToSnapshot(row: Record<string, unknown>): DocumentSnapshot {
  return parseDocumentSnapshot({
    snapshotId: row.snapshot_id,
    documentId: row.document_id,
    versionId: row.version_id,
    sequence: row.sequence,
    contents: row.contents,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    integrity: {
      algorithm: SNAPSHOT_HASH_ALGORITHM,
      contentHash: String(row.content_hash),
    },
  });
}
