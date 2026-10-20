import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { PayoutService } from '@/src/server/modules/payouts/payoutService';
import { adjustmentSchema } from '@/src/server/validators/seller';

/** Manual signed credit/debit applied to the seller's next payout. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const body = await parseBody(req, adjustmentSchema);
  if (!body.ok) return body.response;
  try {
    const adjustment = await PayoutService.addAdjustment(auth.user.userId, body.data.sellerId, body.data.amount, body.data.reason);
    return apiSuccess({ adjustment }, 201);
  } catch (err) {
    return handleError(err, 'ADJUST_FAILED', 'Failed to add adjustment');
  }
}
