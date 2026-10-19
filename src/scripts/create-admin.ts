/**
 * One-time admin bootstrap (CLI only; never exposed over HTTP).
 *
 *   ADMIN_BOOTSTRAP_EMAIL=... ADMIN_BOOTSTRAP_PASSWORD=... npm run admin:bootstrap
 *
 * Guarantees:
 *  - Refuses to run if ANY admin already exists (checked inside a
 *    transaction holding a Postgres advisory lock, so two concurrent runs
 *    cannot both succeed).
 *  - Refuses weak passwords and existing email/username.
 *  - Never promotes an existing account, and never prints the password.
 */
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '@/src/db';
import { users } from '@/src/db/schema';
import { hashPassword } from '@/src/lib/password';
import { bootstrap } from '@/src/lib/env';

const BOOTSTRAP_LOCK_KEY = 727001; // arbitrary constant for pg_advisory_xact_lock

function isStrongPassword(p: string): boolean {
  return p.length >= 12 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p);
}

function fail(msg: string): never {
  throw new Error(msg);
}

async function main() {
  const email = bootstrap.adminEmail.trim().toLowerCase();
  const password = bootstrap.adminPassword;
  const username = (bootstrap.adminUsername ?? email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('ADMIN_BOOTSTRAP_EMAIL is not a valid email address.');
  if (username.length < 3) fail('Admin username must be at least 3 letters/digits/underscores.');
  if (!isStrongPassword(password)) {
    fail('ADMIN_BOOTSTRAP_PASSWORD is too weak: need 12+ characters with upper case, lower case and a digit.');
  }

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`);

    const [anyAdmin] = await tx.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN')).limit(1);
    if (anyAdmin) fail('An admin already exists. Bootstrap is one-time and has been permanently disabled.');

    const [byEmail] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (byEmail) fail('An account with that email already exists; bootstrap will not promote existing accounts. Use a different email.');

    const [byName] = await tx.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (byName) fail('That username is already taken. Set ADMIN_BOOTSTRAP_USERNAME to another value.');

    await tx.insert(users).values({
      username,
      email,
      phone: '',
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
      avatarUrl: null,
    });
  });

  console.log(`Admin account created for ${email}. Now remove ADMIN_BOOTSTRAP_* from your environment.`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Admin bootstrap failed:', err instanceof Error ? err.message : err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
