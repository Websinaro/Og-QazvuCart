import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireSeller } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { SellerDashboardService } from '@/src/server/modules/seller/sellerDashboardService';

export async function GET(req: NextRequest) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  try {
    return apiSuccess(await SellerDashboardService.get(ctx.seller.id));
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load dashboard');
  }
}
