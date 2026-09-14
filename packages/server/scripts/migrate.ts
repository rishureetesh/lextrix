/**
 * Apply SQL migrations. Usage:
 *   LEXTRIX_PG_URL=postgres://... npm run migrate -w lextrix-server
 */
import pg from 'pg';
import { migratePostgres } from '../src/postgres/index.js';

const url = process.env.LEXTRIX_PG_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Set LEXTRIX_PG_URL or DATABASE_URL');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url });
await migratePostgres(pool);
await pool.end();
console.log('migrations applied');
