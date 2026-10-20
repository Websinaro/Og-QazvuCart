import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sellers } from '@/src/db/schema';
import { getAuthUser, AuthenticatedUser } from './auth';
import { apiError } from './response';

export type SellerRecord = typeof sellers.$inferSelect;

export type SellerContext =
  | { ok: true; user: AuthenticatedUser; seller: SellerRecord }
  | { ok: false; response: ReturnType<typeof apiError> };

/**
 * The ONLY way seller routes learn which seller is calling.
 *
 * The seller id is always derived server-side from the authenticated user's
 * session — never from a URL, query string or request body — so one seller
 * can't address another seller's data just by changing an id. Every service
 * method that follows additionally filters by `seller.id`, so ids that belong
 * to somebody else simply 404.
 *
 * `mode`:
 *  - 'read'  : APPROVED or SUSPENDED sellers (suspended sellers can still see
 *              their data and fulfil open orders, but not change the catalog)
 *  - 'write' : APPROVED sellers only (catalog / settings changes)
 */
export async function requireSeller(
  req: NextRequest,
  mode: 'read' | 'write' = 'read'
): Promise<SellerContext> {
  const user = await getAuthUser(req);
  if (!user) return { ok: false, response: apiError('UNAUTHORIZED', 'Please log in to continue', 401) };
  // Admins may open any seller's Seller Center by sending the target seller id
  // in `x-view-seller-id`. Honoured ONLY for ADMIN users; sellers cannot use it.
  if (user.role === 'ADMIN') {
    const target = parseId(req.headers.get('x-view-seller-id'));
    if (!target) {
      return { ok: false, response: apiError('FORBIDDEN', 'Choose a seller to view from Admin → Sellers', 403) };
    }
    const [asSeller] = await db.select().from(sellers).where(eq(sellers.id, target)).limit(1);
    if (!asSeller) return { ok: false, response: apiError('NOT_FOUND', 'Seller not found', 404) };
    return { ok: true, user, seller: asSeller };
  }
  if (user.role !== 'SELLER') {
    return { ok: false, response: apiError('FORBIDDEN', 'A seller account is required', 403) };
  }

  const [seller] = await db.select().from(sellers).where(eq(sellers.userId, user.userId)).limit(1);
  if (!seller) {
    return { ok: false, response: apiError('FORBIDDEN', 'No seller profile is linked to this account', 403) };
  }

  if (seller.status === 'APPROVED') return { ok: true, user, seller };
  if (seller.status === 'SUSPENDED' && mode === 'read') return { ok: true, user, seller };

  const message =
    seller.status === 'SUSPENDED'
      ? 'Your seller account is suspended. You can view your data but cannot make changes.'
      : seller.status === 'PENDING'
        ? 'Your seller application is still under review.'
        : 'Your seller application was not approved.';
  return { ok: false, response: apiError('SELLER_NOT_ACTIVE', message, 403) };
}

export async function requireAdmin(
  req: NextRequest
): Promise<{ ok: true; user: AuthenticatedUser } | { ok: false; response: ReturnType<typeof apiError> }> {
  const user = await getAuthUser(req);
  if (!user) return { ok: false, response: apiError('UNAUTHORIZED', 'Please log in to continue', 401) };
  if (user.role !== 'ADMIN') return { ok: false, response: apiError('FORBIDDEN', 'Admin access required', 403) };
  return { ok: true, user };
}

/** Parses a positive integer path/query id; returns null when invalid. */
export function parseId(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
