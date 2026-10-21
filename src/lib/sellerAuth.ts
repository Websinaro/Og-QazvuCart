import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { adminPermissions, sellers } from '@/src/db/schema';
import { getAuthUser, AuthenticatedUser } from './auth';
import { apiError } from './response';
import { isReadOnlyMethod, type AdminPermission } from './adminAccessPolicy';
import { clientIp, recordAdminAudit } from './adminSecurity';

export type SellerRecord = typeof sellers.$inferSelect;

export type SellerContext =
  // `viewAs` is true when an ADMIN is looking at this seller's data (read-only).
  | { ok: true; user: AuthenticatedUser; seller: SellerRecord; viewAs: boolean }
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
 *
 * Admin "view as seller" (`x-view-seller-id`) is READ-ONLY: any request that
 * is not GET/HEAD/OPTIONS is refused, whatever `mode` the route asked for.
 * Admins change seller data through the dedicated /api/admin/* endpoints,
 * which are separately permissioned and audited (sensitive ones such as
 * payout details also require a distinct permission + step-up).
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
    if (!isReadOnlyMethod(req.method)) {
      return {
        ok: false,
        response: apiError('ADMIN_VIEW_READ_ONLY', 'Viewing as a seller is read-only. Use the admin tools to change seller data.', 403),
      };
    }
    const target = parseId(req.headers.get('x-view-seller-id'));
    if (!target) {
      return { ok: false, response: apiError('FORBIDDEN', 'Choose a seller to view from Admin → Sellers', 403) };
    }
    const [asSeller] = await db.select().from(sellers).where(eq(sellers.id, target)).limit(1);
    if (!asSeller) return { ok: false, response: apiError('NOT_FOUND', 'Seller not found', 404) };
    return { ok: true, user, seller: asSeller, viewAs: true };
  }
  if (user.role !== 'SELLER') {
    return { ok: false, response: apiError('FORBIDDEN', 'A seller account is required', 403) };
  }

  const [seller] = await db.select().from(sellers).where(eq(sellers.userId, user.userId)).limit(1);
  if (!seller) {
    return { ok: false, response: apiError('FORBIDDEN', 'No seller profile is linked to this account', 403) };
  }

  if (seller.status === 'APPROVED') return { ok: true, user, seller, viewAs: false };
  if (seller.status === 'SUSPENDED' && mode === 'read') return { ok: true, user, seller, viewAs: false };

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

/**
 * ADMIN role AND an explicitly granted permission (admin_permissions). The
 * role alone never authorises sensitive actions. Denials are audited.
 */
export async function requireAdminPermission(req: NextRequest, permission: AdminPermission) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth;
  const [grant] = await db
    .select({ id: adminPermissions.id })
    .from(adminPermissions)
    .where(and(eq(adminPermissions.userId, auth.user.userId), eq(adminPermissions.permission, permission)))
    .limit(1);
  if (!grant) {
    await recordAdminAudit(db, {
      adminUserId: auth.user.userId, action: 'admin.permission_denied', targetType: 'permission', targetId: null,
      metadata: { permission, path: req.nextUrl.pathname, method: req.method }, ip: clientIp(req),
    }).catch((err) => console.error('[audit] failed to record permission denial:', err));
    return { ok: false as const, response: apiError('FORBIDDEN', 'Your admin account does not have permission to do this', 403) };
  }
  return auth;
}

/** Parses a positive integer path/query id; returns null when invalid. */
export function parseId(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
