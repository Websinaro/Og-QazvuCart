import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { OrderTrackingService } from '@/src/server/modules/orders/orderTrackingService';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return apiSuccess(await OrderTrackingService.listReturns(req.nextUrl.searchParams.get('status') || undefined));
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load return requests');
  }
}
