import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireSeller } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { SellerEarningsService } from '@/src/server/modules/seller/sellerEarningsService';

export async function GET(req: NextRequest) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  const sp = req.nextUrl.searchParams;
  try {
    const [summary, ledger] = await Promise.all([
      SellerEarningsService.getSummary(ctx.seller.id),
      SellerEarningsService.listEarnings(ctx.seller.id, {
        settlement: sp.get('settlement') || undefined,
        page: Number(sp.get('page')) || 1,
        limit: Number(sp.get('limit')) || 20,
      }),
    ]);
    return apiSuccess({ summary, ...ledger });
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load earnings');
  }
}
