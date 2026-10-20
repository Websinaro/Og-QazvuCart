import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { PayoutService } from '@/src/server/modules/payouts/payoutService';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return apiSuccess(await PayoutService.payableOverview());
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load payable balances');
  }
}
