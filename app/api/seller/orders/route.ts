import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireSeller } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { SellerOrderService } from '@/src/server/modules/seller/sellerOrderService';

export async function GET(req: NextRequest) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  const sp = req.nextUrl.searchParams;
  try {
    return apiSuccess(
      await SellerOrderService.list(ctx.seller.id, {
        status: sp.get('status') || undefined,
        q: sp.get('q') || undefined,
        page: Number(sp.get('page')) || 1,
        limit: Number(sp.get('limit')) || 20,
      })
    );
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load orders');
  }
}
