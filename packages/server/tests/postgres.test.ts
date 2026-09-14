/**
 * PostgreSQL integration tests — skipped unless LEXTRIX_PG_URL is set.
 * Local: docker compose -f packages/server/docker-compose.yml up -d
 *        LEXTRIX_PG_URL=postgres://lextrix:lextrix@127.0.0.1:54329/lextrix
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import ChangeSet from 'lextrix-change';
import { DocumentServerSession } from 'lextrix-collab';
import {
  migratePostgres,
  PostgresAuthoritativePersistence,
  PostgresDocumentOwnership,
} from '../src/postgres/index.js';

const url = process.env.LEXTRIX_PG_URL ?? process.env.DATABASE_URL;
const describePg = url ? describe : describe.skip;

describePg('Phase 11 PostgreSQL', () => {
  let pool: pg.Pool;
  let persistence: PostgresAuthoritativePersistence;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await migratePostgres(pool);
    await pool.query('TRUNCATE change_ids, versions, document_ownership, document_heads CASCADE');
    persistence = new PostgresAuthoritativePersistence(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('compareAndAppend CAS + idempotency', async () => {
    const ownership = new PostgresDocumentOwnership(pool, {
      ownerId: 'pg_test',
      partitionCount: 8,
    });
    const session = await DocumentServerSession.open(
      'pg_doc_1',
      { persistence, ownership },
      { contents: new ChangeSet([{ insert: 'pg\n' }]), createIfMissing: true },
    );
    const head = session.getHead().id;
    const a = await session.accept({
      changeId: 'pg_c1',
      documentId: 'pg_doc_1',
      baseVersionId: head,
      change: new ChangeSet([{ insert: 'A' }]),
      dependsOn: [],
      meta: {},
    });
    expect(a.ok).toBe(true);
    const b = await session.accept({
      changeId: 'pg_c1',
      documentId: 'pg_doc_1',
      baseVersionId: head,
      change: new ChangeSet([{ insert: 'A' }]),
      dependsOn: [],
      meta: {},
    });
    expect(b.ok && b.duplicate).toBe(true);
    const chain = await persistence.loadChain('pg_doc_1');
    expect(chain.length).toBe(2);
  });

  it('stale owner_epoch rejected by database', async () => {
    const ownershipA = new PostgresDocumentOwnership(pool, {
      ownerId: 'ownerA',
      partitionCount: 8,
    });
    const session = await DocumentServerSession.open(
      'pg_doc_fence',
      { persistence, ownership: ownershipA },
      { contents: new ChangeSet([{ insert: 'x\n' }]), createIfMissing: true },
    );
    const leaseA = session.getLease()!;
    const ownershipB = new PostgresDocumentOwnership(pool, {
      ownerId: 'ownerB',
      partitionCount: 8,
    });
    await ownershipB.acquire('pg_doc_fence');

    const result = await session.accept({
      changeId: 'pg_stale',
      documentId: 'pg_doc_fence',
      baseVersionId: session.getHead().id,
      change: new ChangeSet([{ insert: 'S' }]),
      dependsOn: [],
      meta: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('stale_owner');
    void leaseA;
  });

  it('hydrate after restart simulation', async () => {
    const ownership = new PostgresDocumentOwnership(pool, {
      ownerId: 'restart',
      partitionCount: 8,
    });
    const s1 = await DocumentServerSession.open(
      'pg_doc_restart',
      { persistence, ownership },
      { contents: new ChangeSet([{ insert: 'r\n' }]), createIfMissing: true },
    );
    await s1.accept({
      changeId: 'r1',
      documentId: 'pg_doc_restart',
      baseVersionId: s1.getHead().id,
      change: new ChangeSet([{ insert: '1' }]),
      dependsOn: [],
      meta: {},
    });
    const headId = s1.getHead().id;
    s1.close();
    const s2 = await DocumentServerSession.open(
      'pg_doc_restart',
      {
        persistence,
        ownership,
        lease: await ownership.acquire('pg_doc_restart'),
      },
      { createIfMissing: false },
    );
    expect(s2.getHead().id).toBe(headId);
  });

  it('backup/restore lineage validate', async () => {
    const { DocumentHandle, validateVersionChain } = await import(
      'lextrix-change/document'
    );
    const chain = await persistence.loadChain('pg_doc_1');
    expect(chain.length).toBeGreaterThan(0);
    validateVersionChain(chain);
    const h = DocumentHandle.fromVersions(chain);
    expect(h.getContents().ops).toEqual(chain[chain.length - 1]!.contents.ops);
  });
});
