import { and, eq, gte, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db } from '@/src/db';
import { adminAuditLog, users } from '@/src/db/schema';
import { verifyPassword } from './password';
import { STEP_UP_MAX_FAILURES, STEP_UP_WINDOW_MINUTES, isStepUpLocked } from './adminAccessPolicy';

/** Accepts `db` or a transaction handle, so the audit row can commit atomically with the change it records. */
type AuditClient = Pick<typeof db, 'insert'>;

export interface AuditEntry {
  adminUserId: number;
  action: string;
  targetType: string;
  targetId: number | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export async function recordAdminAudit(client: AuditClient, e: AuditEntry) {
  await client.insert(adminAuditLog).values({
    adminUserId: e.adminUserId,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    reason: e.reason ?? null,
    metadata: e.metadata ?? null,
    ip: e.ip ?? null,
  });
}

export function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
}

export type StepUpResult =
  | { ok: true }
  | { ok: false; code: 'STEP_UP_REQUIRED' | 'INVALID_PASSWORD' | 'STEP_UP_LOCKED'; status: number; message: string };

/**
 * Step-up authentication: a valid session is not enough for a sensitive admin
 * change, the admin must prove it is really them by re-entering their own
 * password for THIS action. Failures are audited and lock the admin out
 * after STEP_UP_MAX_FAILURES in STEP_UP_WINDOW_MINUTES, so a hijacked
 * session cannot be used to guess the password.
 */
export async function verifyAdminStepUp(req: NextRequest, adminUserId: number, password: unknown): Promise<StepUpResult> {
  if (typeof password !== 'string' || !password) {
    return { ok: false, code: 'STEP_UP_REQUIRED', status: 422, message: 'Re-enter your admin password to confirm this change' };
  }

  const since = new Date(Date.now() - STEP_UP_WINDOW_MINUTES * 60_000);
  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(adminAuditLog)
    .where(and(eq(adminAuditLog.adminUserId, adminUserId), eq(adminAuditLog.action, 'admin.step_up_failed'), gte(adminAuditLog.createdAt, since)));
  if (isStepUpLocked(recent?.n ?? 0)) {
    return { ok: false, code: 'STEP_UP_LOCKED', status: 429, message: `Too many incorrect passwords. Try again in ${STEP_UP_WINDOW_MINUTES} minutes.` };
  }

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, adminUserId)).limit(1);
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    await recordAdminAudit(db, { adminUserId, action: 'admin.step_up_failed', targetType: 'user', targetId: adminUserId, ip: clientIp(req) });
    return { ok: false, code: 'INVALID_PASSWORD', status: 403, message: 'That password is not correct' };
  }
  return { ok: true };
}
