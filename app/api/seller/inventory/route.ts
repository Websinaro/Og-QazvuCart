import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireSeller } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { SellerCatalogService } from '@/src/server/modules/seller/sellerCatalogService';
import { bulkStockSchema } from '@/src/server/validators/seller';

export async function GET(req: NextRequest) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  try {
    const items = await SellerCatalogService.inventory(ctx.seller.id, {
      lowStockOnly: req.nextUrl.searchParams.get('lowStock') === 'true',
    });
    return apiSuccess({ items });
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load inventory');
  }
}

/** All-or-nothing bulk stock update. */
export async function PATCH(req: NextRequest) {
  const ctx = await requireSeller(req, 'write');
  if (!ctx.ok) return ctx.response;
  const body = await parseBody(req, bulkStockSchema);
  if (!body.ok) return body.response;
  try {
    return apiSuccess(await SellerCatalogService.bulkUpdateStock(ctx.seller.id, body.data.updates));
  } catch (err) {
    return handleError(err, 'UPDATE_FAILED', 'Failed to update stock');
  }
}
