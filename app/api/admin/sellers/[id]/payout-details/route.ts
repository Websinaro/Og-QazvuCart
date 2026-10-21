import { NextRequest } from 'next/server';
import { db } from '@/src/db';
import { apiSuccess, apiError } from '@/src/lib/response';
import { parseId, requireAdminPermission } from '@/src/lib/sellerAuth';
import { ADMIN_PERMISSIONS, MIN_AUDIT_REASON_LENGTH, changedPayoutFields } from '@/src/lib/adminAccessPolicy';
import { clientIp, recordAdminAudit, verifyAdminStepUp } from '@/src/lib/adminSecurity';
import { handleError } from '@/src/lib/routeHelpers';
import { SellerAccountService } from '@/src/server/modules/sellers/sellerAccountService';
import { NotificationService } from '@/src/server/modules/notifications/notificationService';
import { payoutDetailsSchema } from '@/src/server/validators/seller';

/**
 * Admin change of a seller's payout destination — the one place an admin may
 * do this (the seller-facing route refuses admin "view as" requests).
 *
 * Requires, all three:
 *   1. the ADMIN role AND the explicit `seller_payout_details:write` permission,
 *   2. step-up: the admin's own password, re-entered for this request,
 *   3. a written reason, stored in the audit log.
 * The change and its audit row commit in one transaction; the full account
 * number is never written to the log.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission(req, ADMIN_PERMISSIONS.SELLER_PAYOUT_DETAILS_WRITE);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const sellerId = parseId(id);
  if (!sellerId) return apiError('VALIDATION_ERROR', 'Invalid seller id', 422);

  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be valid JSON', 400);
  }

  const { currentPassword, reason, ...details } = raw as { currentPassword?: unknown; reason?: unknown } & Record<string, unknown>;
  const why = typeof reason === 'string' ? reason.trim() : '';
  if (why.length < MIN_AUDIT_REASON_LENGTH) {
    return apiError('VALIDATION_ERROR', `Give a reason of at least ${MIN_AUDIT_REASON_LENGTH} characters; it is recorded in the audit log`, 422);
  }
  const parsed = payoutDetailsSchema.safeParse(details);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
  }

  const stepUp = await verifyAdminStepUp(req, auth.user.userId, currentPassword);
  if (!stepUp.ok) return apiError(stepUp.code, stepUp.message, stepUp.status);

  const before = await SellerAccountService.getRawById(sellerId);
  if (!before) return apiError('NOT_FOUND', 'Seller not found', 404);

  try {
    const payout = await db.transaction(async (tx) => {
      const after = await SellerAccountService.savePayoutDetails(sellerId, parsed.data, tx);
      await recordAdminAudit(tx, {
        adminUserId: auth.user.userId,
        action: 'seller.payout_details_updated',
        targetType: 'seller',
        targetId: sellerId,
        reason: why,
        ip: clientIp(req),
        metadata: {
          changedFields: changedPayoutFields(parsed.data),
          before: SellerAccountService.maskedDestinationSnapshot(before),
          after,
        },
      });
      return after;
    });

    void NotificationService.notifyUser(before.userId, {
      type: 'SYSTEM',
      title: 'Payout details changed by platform support',
      body: 'An administrator updated your payout account details. If you did not expect this, contact support immediately.',
      link: '/seller-center?tab=settings',
    });
    return apiSuccess({ payout });
  } catch (err) {
    return handleError(err, 'UPDATE_FAILED', 'Failed to save payout details');
  }
}
