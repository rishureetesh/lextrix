import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

export async function migratePostgres(pool: Pool): Promise<void> {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');
  for (const file of ['001_init.sql', '002_phase12.sql']) {
    const sql = readFileSync(join(dir, file), 'utf8');
    await pool.query(sql);
  }
}

export { PostgresAuthoritativePersistence } from './persistence.js';
export { PostgresDocumentOwnership } from './ownership.js';
export { PostgresSnapshotPersistence } from './snapshots.js';
export { PostgresVersionArchive } from './archive.js';
export {
  PostgresDocumentLifecycle,
  PostgresDocumentRegionStore,
} from './lifecycle.js';
