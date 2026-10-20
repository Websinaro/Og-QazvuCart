import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireSeller } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { SellerEarningsService } from '@/src/server/modules/seller/sellerEarningsService';

export async function GET(req: NextRequest) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  try {
    return apiSuccess({ payouts: await SellerEarningsService.listPayouts(ctx.seller.id) });
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load payouts');
  }
}
