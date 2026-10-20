import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireSeller } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { SellerCatalogService } from '@/src/server/modules/seller/sellerCatalogService';
import { createProductSchema } from '@/src/server/validators/seller';

export async function GET(req: NextRequest) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  const sp = req.nextUrl.searchParams;
  try {
    const result = await SellerCatalogService.list(ctx.seller.id, {
      q: sp.get('q') || undefined,
      status: sp.get('status') || undefined,
      lowStock: sp.get('lowStock') === 'true',
      page: Number(sp.get('page')) || 1,
      limit: Number(sp.get('limit')) || 20,
    });
    return apiSuccess(result);
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load products');
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireSeller(req, 'write');
  if (!ctx.ok) return ctx.response;
  const body = await parseBody(req, createProductSchema);
  if (!body.ok) return body.response;
  try {
    // The seller id is taken from the session, never from the body.
    const product = await SellerCatalogService.create(ctx.seller.id, body.data);
    return apiSuccess(product, 201);
  } catch (err) {
    return handleError(err, 'CREATE_FAILED', 'Failed to create product');
  }
}
