/**
 * PostgreSQL document lifecycle + home region (ADR-033 / ADR-035).
 */
import type { Pool } from 'pg';
import type {
  DocumentLifecycle,
  DocumentLifecycleState,
} from 'lextrix-change/persistence';
import { PersistenceError } from 'lextrix-change/persistence';
import type { DocumentRegionStore } from 'lextrix-collab';

const ALLOWED: Record<
  DocumentLifecycleState,
  readonly DocumentLifecycleState[]
> = {
  active: ['tombstoned'],
  tombstoned: ['archived', 'active'],
  archived: ['purged'],
  purged: [],
};

export class PostgresDocumentLifecycle implements DocumentLifecycle {
  constructor(private readonly pool: Pool) {}

  async getState(documentId: string): Promise<DocumentLifecycleState> {
    const res = await this.pool.query(
      `SELECT lifecycle_state FROM document_heads WHERE document_id = $1`,
      [documentId],
    );
    if (res.rows.length === 0) return 'active';
    return (res.rows[0] as { lifecycle_state: DocumentLifecycleState })
      .lifecycle_state;
  }

  async tombstone(documentId: string): Promise<void> {
    await this.transition(documentId, 'tombstoned');
  }

  async archive(documentId: string): Promise<void> {
    await this.transition(documentId, 'archived');
  }

  async purge(documentId: string): Promise<void> {
    await this.transition(documentId, 'purged');
  }

  async revive(documentId: string): Promise<void> {
    await this.transition(documentId, 'active');
  }

  private async transition(
    documentId: string,
    next: DocumentLifecycleState,
  ): Promise<void> {
    const cur = await this.getState(documentId);
    if (cur === next) return;
    if (!ALLOWED[cur].includes(next)) {
      throw new PersistenceError(
        'invalid_argument',
        `lifecycle: cannot transition ${cur} → ${next}`,
      );
    }
    await this.pool.query(
      `INSERT INTO document_heads (document_id, head_version_id, head_sequence, owner_epoch, lifecycle_state)
       VALUES ($1, NULL, -1, 0, $2)
       ON CONFLICT (document_id) DO UPDATE SET lifecycle_state = EXCLUDED.lifecycle_state`,
      [documentId, next],
    );
  }
}

export class PostgresDocumentRegionStore implements DocumentRegionStore {
  constructor(private readonly pool: Pool) {}

  async getHomeRegion(documentId: string): Promise<string | null> {
    const res = await this.pool.query(
      `SELECT home_region FROM document_heads WHERE document_id = $1`,
      [documentId],
    );
    if (res.rows.length === 0) return null;
    return (res.rows[0] as { home_region: string | null }).home_region;
  }

  async setHomeRegion(documentId: string, region: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO document_heads (document_id, head_version_id, head_sequence, owner_epoch, home_region)
       VALUES ($1, NULL, -1, 0, $2)
       ON CONFLICT (document_id) DO UPDATE SET home_region = EXCLUDED.home_region`,
      [documentId, region],
    );
  }
}
