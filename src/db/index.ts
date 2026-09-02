import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '@/src/lib/env';
import * as schema from './schema';

// PostgreSQL is the ONLY production database. There is no SQLite / sql.js /
// PGlite / in-memory fallback anywhere in this codebase. If DATABASE_URL is
// missing or the pool cannot connect, requests fail loudly (500) rather than
// silently degrading to a local, non-persistent database.
const connectionString = env.DATABASE_URL;

// Reuse a single pool across hot reloads in dev so we don't exhaust
// connections, mirroring the standard Next.js singleton pattern.
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const pool =
  global.__pgPool ??
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool;
}

pool.on('error', (err) => {
  // Unexpected error on an idle client - log it, do not crash the process,
  // and do NOT fall back to any other storage engine.
  console.error('Unexpected PostgreSQL pool error:', err);
});

export const db = drizzle(pool, { schema });
export { pool };
