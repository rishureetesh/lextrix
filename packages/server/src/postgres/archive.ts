/**
 * PostgreSQL VersionArchive reference adapter (ADR-031).
 */
import type { Pool } from 'pg';
import { DocumentVersion } from 'lextrix-change/document';
import {
  type VersionArchive,
  PersistenceError,
} from 'lextrix-change/persistence';
import {
  serializeDocumentVersion,
  parseDocumentVersion,
} from 'lextrix-change/wire';

export class PostgresVersionArchive implements VersionArchive {
  constructor(private readonly pool: Pool) {}

  async archiveVersions(
    documentId: string,
    versions: readonly DocumentVersion[],
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const v of versions) {
        if (v.documentId !== documentId) {
          throw new PersistenceError(
            'invalid_argument',
            'archiveVersions: documentId mismatch',
          );
        }
        const wire = serializeDocumentVersion(v);
        await client.query(
          `INSERT INTO version_archive
            (version_id, document_id, sequence, revision, parent_id,
             change_from_parent, contents, meta)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
           ON CONFLICT (version_id) DO NOTHING`,
          [
            v.id,
            v.documentId,
            v.sequence,
            v.revision,
            v.parentId,
            wire.changeFromParent == null
              ? null
              : JSON.stringify(wire.changeFromParent),
            JSON.stringify(wire.contents),
            wire.meta == null ? null : JSON.stringify(wire.meta),
          ],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async loadArchivedVersion(
    documentId: string,
    versionId: string,
  ): Promise<DocumentVersion | null> {
    const res = await this.pool.query(
      `SELECT version_id, document_id, sequence, revision, parent_id,
              change_from_parent, contents, meta
       FROM version_archive
       WHERE document_id = $1 AND version_id = $2`,
      [documentId, versionId],
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0] as Record<string, unknown>;
    return parseDocumentVersion({
      schemaVersion: 1,
      kind: 'version',
      id: row.version_id,
      documentId: row.document_id,
      sequence: row.sequence,
      revision: row.revision,
      parentId: row.parent_id,
      contents: row.contents,
      changeFromParent: row.change_from_parent,
      meta: row.meta,
    });
  }

  async purgeArchivedVersions(
    documentId: string,
    beforeSequence: number,
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM version_archive
       WHERE document_id = $1 AND sequence < $2`,
      [documentId, beforeSequence],
    );
  }
}
