import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { users } from '@/src/db/schema';
import { verifyAccessToken, UserTokenPayload } from './jwt';
import { config } from './env';

export interface AuthenticatedUser extends UserTokenPayload {
  phone: string;
  avatarUrl?: string | null;
}

/**
 * Resolves the authenticated user strictly from the HttpOnly access-token
 * cookie. The token is never accepted from a request header, because
 * accepting it there would imply client-side JavaScript had access to it
 * (e.g. to set an Authorization header), which defeats the purpose of an
 * HttpOnly cookie in the first place.
 */
export async function getAuthUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const token = req.cookies.get(config.cookieName)?.value;
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      phone: users.phone,
      role: users.role,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (!user) return null;

  return {
    userId: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role as 'CUSTOMER' | 'SELLER' | 'ADMIN',
    avatarUrl: user.avatarUrl,
  };
}
