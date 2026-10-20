import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { parseId, requireSeller } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { SellerCatalogService } from '@/src/server/modules/seller/sellerCatalogService';
import { updateProductSchema } from '@/src/server/validators/seller';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Product not found', 404);
  try {
    return apiSuccess({ product: await SellerCatalogService.get(ctx.seller.id, id) });
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load product');
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await requireSeller(req, 'write');
  if (!ctx.ok) return ctx.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Product not found', 404);
  const body = await parseBody(req, updateProductSchema);
  if (!body.ok) return body.response;
  try {
    return apiSuccess({ product: await SellerCatalogService.update(ctx.seller.id, id, body.data) });
  } catch (err) {
    return handleError(err, 'UPDATE_FAILED', 'Failed to update product');
  }
}

/** "Delete" archives the product: it disappears from the storefront but order history stays intact. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await requireSeller(req, 'write');
  if (!ctx.ok) return ctx.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Product not found', 404);
  try {
    return apiSuccess(await SellerCatalogService.archive(ctx.seller.id, id));
  } catch (err) {
    return handleError(err, 'DELETE_FAILED', 'Failed to archive product');
  }
}
