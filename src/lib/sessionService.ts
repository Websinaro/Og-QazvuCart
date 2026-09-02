import crypto from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/src/db';
import { sessions } from '@/src/db/schema';
import { config } from './env';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, mirrors config.jwtRefreshExpiresIn

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface CreateSessionParams {
  userId: number;
  refreshToken: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Persists a refresh session so it can later be looked up, revoked
 * individually (logout) or in bulk (password change) from PostgreSQL,
 * rather than trusting a JWT signature alone for the lifetime of the token.
 */
export async function createSession(params: CreateSessionParams) {
  const [session] = await db
    .insert(sessions)
    .values({
      userId: params.userId,
      tokenHash: hashToken(params.refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgent: params.userAgent || null,
      ipAddress: params.ipAddress || null,
    })
    .returning();
  return session;
}

export async function findActiveSessionByToken(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
    .limit(1);

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

export async function revokeSessionByToken(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, tokenHash));
}

export async function revokeSessionById(sessionId: number) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

/** Used on password change: force every other device to re-authenticate. */
export async function revokeAllSessionsForUser(userId: number) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export function setAuthCookies(
  response: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } },
  accessToken: string,
  refreshToken: string
) {
  const secure = process.env.NODE_ENV === 'production';

  response.cookies.set(config.cookieName, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 minutes, matches config.jwtExpiresIn
    path: '/',
  });

  response.cookies.set(config.refreshCookieName, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });
}

export function clearAuthCookies(response: {
  cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void };
}) {
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(config.cookieName, '', { httpOnly: true, secure, sameSite: 'lax', maxAge: 0, path: '/' });
  response.cookies.set(config.refreshCookieName, '', { httpOnly: true, secure, sameSite: 'lax', maxAge: 0, path: '/' });
}
