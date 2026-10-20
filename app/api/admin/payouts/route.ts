import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { parseId, requireAdmin } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { PayoutService } from '@/src/server/modules/payouts/payoutService';
import { createPayoutSchema } from '@/src/server/validators/seller';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const sp = req.nextUrl.searchParams;
  try {
    return apiSuccess({
      payouts: await PayoutService.list({
        status: sp.get('status') || undefined,
        sellerId: parseId(sp.get('sellerId')) ?? undefined,
      }),
    });
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load payouts');
  }
}

/** Settles everything currently payable for one seller into a PROCESSING payout. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const body = await parseBody(req, createPayoutSchema);
  if (!body.ok) return body.response;
  try {
    const payout = await PayoutService.createPayout(auth.user.userId, body.data.sellerId, body.data.notes);
    return apiSuccess({ payout }, 201);
  } catch (err) {
    return handleError(err, 'PAYOUT_FAILED', 'Failed to create payout');
  }
}
