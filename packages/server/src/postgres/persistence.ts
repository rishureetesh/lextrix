/**
 * PostgreSQL AuthoritativeDocumentPersistence (ADR-023).
 */
import type { Pool, PoolClient } from 'pg';
import ChangeSet from 'lextrix-change';
import {
  DocumentVersion,
} from 'lextrix-change/document';
import type {
  AuthoritativeDocumentPersistence,
  CompareAndAppendOptions,
  CompareAndAppendResult,
} from 'lextrix-change/persistence';
import { serializeDocumentVersion, parseDocumentVersion } from 'lextrix-change/wire';

type VersionRow = {
  version_id: string;
  document_id: string;
  sequence: number;
  revision: number;
  parent_id: string | null;
  change_from_parent: unknown;
  contents: unknown;
  meta: unknown;
};

function rowToVersion(row: VersionRow): DocumentVersion {
  const wire = {
    schemaVersion: 1 as const,
    kind: 'version' as const,
    id: row.version_id,
    documentId: row.document_id,
    sequence: row.sequence,
    revision: row.revision,
    parentId: row.parent_id,
    contents: row.contents,
    changeFromParent: row.change_from_parent,
    meta: row.meta,
  };
  return parseDocumentVersion(wire);
}

function versionToPayload(v: DocumentVersion): {
  contents: unknown;
  changeFromParent: unknown;
  meta: unknown;
} {
  const json = serializeDocumentVersion(v);
  return {
    contents: json.contents,
    changeFromParent: json.changeFromParent,
    meta: json.meta,
  };
}

async function ensureHeadRow(client: PoolClient, documentId: string): Promise<void> {
  await client.query(
    `INSERT INTO document_heads (document_id, head_version_id, head_sequence, owner_epoch)
     VALUES ($1, NULL, -1, 0)
     ON CONFLICT (document_id) DO NOTHING`,
    [documentId],
  );
}

export class PostgresAuthoritativePersistence
  implements AuthoritativeDocumentPersistence
{
  constructor(private readonly pool: Pool) {}

  async loadHead(documentId: string): Promise<DocumentVersion | null> {
    const r = await this.pool.query(
      `SELECT v.* FROM document_heads h
       JOIN versions v ON v.version_id = h.head_version_id
       WHERE h.document_id = $1`,
      [documentId],
    );
    if (r.rowCount === 0) return null;
    return rowToVersion(r.rows[0] as VersionRow);
  }

  async loadVersion(
    documentId: string,
    versionId: string,
  ): Promise<DocumentVersion | null> {
    const r = await this.pool.query(
      `SELECT * FROM versions WHERE document_id = $1 AND version_id = $2`,
      [documentId, versionId],
    );
    if (r.rowCount === 0) return null;
    return rowToVersion(r.rows[0] as VersionRow);
  }

  async loadChain(
    documentId: string,
    fromVersionId?: string,
  ): Promise<readonly DocumentVersion[]> {
    if (fromVersionId == null) {
      const r = await this.pool.query(
        `SELECT * FROM versions WHERE document_id = $1 ORDER BY sequence ASC`,
        [documentId],
      );
      return Object.freeze(r.rows.map((row) => rowToVersion(row as VersionRow)));
    }
    const base = await this.pool.query(
      `SELECT sequence FROM versions WHERE document_id = $1 AND version_id = $2`,
      [documentId, fromVersionId],
    );
    if (base.rowCount === 0) {
      const { PersistenceError } = await import('lextrix-change/persistence');
      throw new PersistenceError(
        'not_found',
        `unknown fromVersionId ${fromVersionId}`,
      );
    }
    const seq = (base.rows[0] as { sequence: number }).sequence;
    const r = await this.pool.query(
      `SELECT * FROM versions WHERE document_id = $1 AND sequence > $2 ORDER BY sequence ASC`,
      [documentId, seq],
    );
    return Object.freeze(r.rows.map((row) => rowToVersion(row as VersionRow)));
  }

  async lookupChangeId(
    documentId: string,
    changeId: string,
  ): Promise<{ versionId: string } | null> {
    const r = await this.pool.query(
      `SELECT version_id FROM change_ids WHERE document_id = $1 AND change_id = $2`,
      [documentId, changeId],
    );
    if (r.rowCount === 0) return null;
    return { versionId: (r.rows[0] as { version_id: string }).version_id };
  }

  async compareAndAppend(
    documentId: string,
    expectedHeadId: string | null,
    version: DocumentVersion,
    options: CompareAndAppendOptions = {},
  ): Promise<CompareAndAppendResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await ensureHeadRow(client, documentId);

      const headLock = await client.query(
        `SELECT head_version_id, owner_epoch FROM document_heads
         WHERE document_id = $1 FOR UPDATE`,
        [documentId],
      );
      const headRow = headLock.rows[0] as {
        head_version_id: string | null;
        owner_epoch: string | number;
      };
      const durableHeadId = headRow.head_version_id;
      const durableEpoch = Number(headRow.owner_epoch);

      if (options.ownerEpoch != null && options.ownerEpoch !== durableEpoch) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          reason: 'stale_owner',
          durableHead:
            durableHeadId == null
              ? null
              : await this.loadVersion(documentId, durableHeadId),
          message: `stale owner_epoch: got ${options.ownerEpoch}, durable ${durableEpoch}`,
        };
      }

      if (options.changeId) {
        const prior = await client.query(
          `SELECT version_id FROM change_ids WHERE document_id = $1 AND change_id = $2`,
          [documentId, options.changeId],
        );
        if (prior.rowCount && prior.rowCount > 0) {
          const versionId = (prior.rows[0] as { version_id: string }).version_id;
          await client.query('COMMIT');
          const v = await this.loadVersion(documentId, versionId);
          const head = await this.loadHead(documentId);
          if (!v) {
            return {
              ok: false,
              reason: 'persistence_error',
              durableHead: head,
              message: 'idempotent changeId missing Version',
            };
          }
          return { ok: true, version: v, head: head ?? v, duplicate: true };
        }
      }

      if (durableHeadId !== expectedHeadId) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          reason: 'cas_conflict',
          durableHead:
            durableHeadId == null
              ? null
              : await this.loadVersion(documentId, durableHeadId),
          message: `CAS conflict: expected ${String(expectedHeadId)}, durable ${String(durableHeadId)}`,
        };
      }

      if (version.documentId !== documentId) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          reason: 'invalid_argument',
          durableHead: null,
          message: 'documentId mismatch',
        };
      }

      const existing = await client.query(
        `SELECT * FROM versions WHERE version_id = $1`,
        [version.id],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        const existingV = rowToVersion(existing.rows[0] as VersionRow);
        const same =
          JSON.stringify(serializeDocumentVersion(existingV)) ===
          JSON.stringify(serializeDocumentVersion(version));
        if (!same) {
          await client.query('ROLLBACK');
          return {
            ok: false,
            reason: 'idempotency_conflict',
            durableHead:
              durableHeadId == null
                ? null
                : await this.loadVersion(documentId, durableHeadId),
            message: `conflicting Version id ${version.id}`,
          };
        }
        if (options.changeId) {
          await client.query(
            `INSERT INTO change_ids (document_id, change_id, version_id)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [documentId, options.changeId, version.id],
          );
        }
        await client.query('COMMIT');
        return {
          ok: true,
          version: existingV,
          head: existingV,
          duplicate: true,
        };
      }

      const payload = versionToPayload(version);
      await client.query(
        `INSERT INTO versions (
           version_id, document_id, sequence, revision, parent_id,
           change_from_parent, contents, meta
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)`,
        [
          version.id,
          documentId,
          version.sequence,
          version.revision,
          version.parentId,
          payload.changeFromParent == null
            ? null
            : JSON.stringify(payload.changeFromParent),
          JSON.stringify(payload.contents),
          payload.meta == null ? null : JSON.stringify(payload.meta),
        ],
      );

      await client.query(
        `UPDATE document_heads
         SET head_version_id = $2, head_sequence = $3, updated_at = now()
         WHERE document_id = $1`,
        [documentId, version.id, version.sequence],
      );

      if (options.changeId) {
        await client.query(
          `INSERT INTO change_ids (document_id, change_id, version_id)
           VALUES ($1, $2, $3)`,
          [documentId, options.changeId, version.id],
        );
      }

      await client.query('COMMIT');
      return { ok: true, version, head: version };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        reason: 'persistence_error',
        durableHead: null,
        message: err instanceof Error ? err.message : String(err),
      };
    } finally {
      client.release();
    }
  }
}

void ChangeSet;
