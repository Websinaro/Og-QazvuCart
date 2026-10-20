import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { parseId, requireAdmin } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { SellerAccountService } from '@/src/server/modules/sellers/sellerAccountService';
import { PayoutService } from '@/src/server/modules/payouts/payoutService';
import { computeBuckets } from '@/src/server/modules/seller/sellerEarningsService';
import { adminSellerActionSchema } from '@/src/server/validators/seller';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Seller not found', 404);
  try {
    const { sellers } = await SellerAccountService.listForAdmin({ id });
    if (sellers.length === 0) return apiError('NOT_FOUND', 'Seller not found', 404);
    const [buckets, payouts, rateCard] = await Promise.all([
      computeBuckets(id),
      PayoutService.list({ sellerId: id }),
      SellerAccountService.getRateCard(id),
    ]);
    return apiSuccess({ seller: sellers[0], earnings: buckets.get(id), payouts, rateCard });
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load seller');
  }
}

/** Lifecycle + commission: approve | reject | suspend | reinstate | set_commission. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Seller not found', 404);
  const body = await parseBody(req, adminSellerActionSchema);
  if (!body.ok) return body.response;

  try {
    const a = body.data;
    let seller;
    switch (a.action) {
      case 'approve':
        seller = await SellerAccountService.approve(id, auth.user.userId);
        break;
      case 'reject':
        seller = await SellerAccountService.reject(id, a.reason);
        break;
      case 'suspend':
        seller = await SellerAccountService.suspend(id, a.reason);
        break;
      case 'reinstate':
        seller = await SellerAccountService.reinstate(id);
        break;
      case 'set_commission':
        seller = await SellerAccountService.setCommission(id, a.commissionPercent);
        break;
    }
    return apiSuccess({ seller });
  } catch (err) {
    return handleError(err, 'UPDATE_FAILED', 'Failed to update seller');
  }
}
