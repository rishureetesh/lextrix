/**
 * PostgreSQL-backed document ownership + epoch fencing (ADR-025).
 * No Redis — durable coordination stays in PostgreSQL.
 */
import type { Pool } from 'pg';
import {
  type DocumentOwnership,
  type DocumentOwnershipLease,
  partitionForDocument,
} from 'lextrix-collab';

async function ensureHead(pool: Pool, documentId: string): Promise<void> {
  await pool.query(
    `INSERT INTO document_heads (document_id, head_version_id, head_sequence, owner_epoch)
     VALUES ($1, NULL, -1, 0)
     ON CONFLICT (document_id) DO NOTHING`,
    [documentId],
  );
}

export class PostgresDocumentOwnership implements DocumentOwnership {
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      ownerId: string;
      partitionCount: number;
      /** Empty/undefined = all partitions (dev). */
      ownedPartitions?: readonly number[];
      leaseTtlMs?: number;
    },
  ) {}

  private ownsPartition(partition: number): boolean {
    if (!this.options.ownedPartitions || this.options.ownedPartitions.length === 0) {
      return true;
    }
    return this.options.ownedPartitions.includes(partition);
  }

  async acquire(documentId: string): Promise<DocumentOwnershipLease> {
    const partition = partitionForDocument(
      documentId,
      this.options.partitionCount,
    );
    if (!this.ownsPartition(partition)) {
      throw new Error(
        `PostgresDocumentOwnership: partition ${partition} not assigned to ${this.options.ownerId}`,
      );
    }
    await ensureHead(this.pool, documentId);
    const ttl = this.options.leaseTtlMs ?? 30_000;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT owner_epoch FROM document_heads WHERE document_id = $1 FOR UPDATE`,
        [documentId],
      );
      const bumped = await client.query(
        `UPDATE document_heads
         SET owner_epoch = owner_epoch + 1, updated_at = now()
         WHERE document_id = $1
         RETURNING owner_epoch`,
        [documentId],
      );
      const epoch = Number((bumped.rows[0] as { owner_epoch: string | number }).owner_epoch);
      const expiresAt = new Date(Date.now() + ttl);
      await client.query(
        `INSERT INTO document_ownership (document_id, owner_id, owner_epoch, partition, lease_expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (document_id) DO UPDATE SET
           owner_id = EXCLUDED.owner_id,
           owner_epoch = EXCLUDED.owner_epoch,
           partition = EXCLUDED.partition,
           lease_expires_at = EXCLUDED.lease_expires_at,
           updated_at = now()`,
        [documentId, this.options.ownerId, epoch, partition, expiresAt.toISOString()],
      );
      await client.query('COMMIT');
      return {
        documentId,
        ownerId: this.options.ownerId,
        ownerEpoch: epoch,
        partition,
        expiresAt: expiresAt.getTime(),
      };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async renew(lease: DocumentOwnershipLease): Promise<boolean> {
    const ttl = this.options.leaseTtlMs ?? 30_000;
    const r = await this.pool.query(
      `UPDATE document_ownership
       SET lease_expires_at = $4, updated_at = now()
       WHERE document_id = $1 AND owner_id = $2 AND owner_epoch = $3
       RETURNING document_id`,
      [
        lease.documentId,
        lease.ownerId,
        lease.ownerEpoch,
        new Date(Date.now() + ttl).toISOString(),
      ],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async release(lease: DocumentOwnershipLease): Promise<void> {
    await this.pool.query(
      `DELETE FROM document_ownership
       WHERE document_id = $1 AND owner_id = $2 AND owner_epoch = $3`,
      [lease.documentId, lease.ownerId, lease.ownerEpoch],
    );
  }

  async getEpoch(documentId: string): Promise<number> {
    const r = await this.pool.query(
      `SELECT owner_epoch FROM document_heads WHERE document_id = $1`,
      [documentId],
    );
    if (r.rowCount === 0) return 0;
    return Number((r.rows[0] as { owner_epoch: string | number }).owner_epoch);
  }
}
