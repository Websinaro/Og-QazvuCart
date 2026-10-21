import { sql } from 'drizzle-orm';
import { db } from '@/src/db';

let cached: Promise<boolean> | null = null;
/** True when the pg_trgm extension is installed (typo-tolerant search); otherwise search falls back to ILIKE. */
export function hasTrigram(): Promise<boolean> {
  if (!cached) {
    cached = db
      .execute(sql`SELECT 1 AS ok FROM pg_extension WHERE extname = 'pg_trgm'`)
      .then((r: any) => ((r.rows ?? r) as unknown[]).length > 0)
      .catch(() => false);
  }
  return cached;
}
