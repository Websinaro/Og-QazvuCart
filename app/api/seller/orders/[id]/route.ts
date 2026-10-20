import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { parseId, requireSeller } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { SellerOrderService } from '@/src/server/modules/seller/sellerOrderService';
import { sellerOrderUpdateSchema } from '@/src/server/validators/seller';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Order not found', 404);
  try {
    return apiSuccess({ order: await SellerOrderService.get(ctx.seller.id, id) });
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load order');
  }
}

/**
 * Seller fulfilment: PACKED -> SHIPPED -> OUT_FOR_DELIVERY -> DELIVERED (or
 * CANCELLED before dispatch), plus carrier / tracking number. `id` is the
 * seller's PARCEL id; a parcel that belongs to another seller returns 404.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  // Suspended sellers can still fulfil orders they already took.
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Order not found', 404);
  const body = await parseBody(req, sellerOrderUpdateSchema);
  if (!body.ok) return body.response;
  try {
    return apiSuccess({ order: await SellerOrderService.update(ctx.seller.id, id, body.data) });
  } catch (err) {
    return handleError(err, 'UPDATE_FAILED', 'Failed to update order');
  }
}
