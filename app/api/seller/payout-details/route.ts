import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { users } from '@/src/db/schema';
import { apiSuccess, apiError } from '@/src/lib/response';
import { requireSeller } from '@/src/lib/sellerAuth';
import { verifyPassword } from '@/src/lib/password';
import { handleError } from '@/src/lib/routeHelpers';
import { SellerAccountService } from '@/src/server/modules/sellers/sellerAccountService';
import { NotificationService } from '@/src/server/modules/notifications/notificationService';
import { payoutDetailsSchema } from '@/src/server/validators/seller';

/** Masked view only — the full account number is never returned to anyone via the seller API. */
export async function GET(req: NextRequest) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  const profile = await SellerAccountService.getMine(ctx.user.userId);
  return apiSuccess({ payout: profile?.payout ?? null });
}

/**
 * Changing where money is sent is the most valuable thing an attacker with a
 * hijacked session could do, so it requires the account password again.
 */
export async function PUT(req: NextRequest) {
  const ctx = await requireSeller(req, 'read'); // suspended sellers must still be able to get paid
  if (!ctx.ok) return ctx.response;

  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be valid JSON', 400);
  }

  const { currentPassword, ...details } = raw as { currentPassword?: unknown } & Record<string, unknown>;
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return apiError('VALIDATION_ERROR', 'Enter your account password to confirm this change', 422);
  }

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, ctx.user.userId)).limit(1);
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
    return apiError('INVALID_PASSWORD', 'That password is not correct', 403);
  }

  const parsed = payoutDetailsSchema.safeParse(details);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
  }

  try {
    const payout = await SellerAccountService.savePayoutDetails(ctx.seller.id, parsed.data);
    void NotificationService.notifyUser(ctx.user.userId, {
      type: 'SYSTEM',
      title: 'Payout details changed',
      body: 'Your payout account details were updated. If this was not you, contact support immediately.',
      link: '/seller-center?tab=settings',
    });
    return apiSuccess({ payout });
  } catch (err) {
    return handleError(err, 'UPDATE_FAILED', 'Failed to save payout details');
  }
}
