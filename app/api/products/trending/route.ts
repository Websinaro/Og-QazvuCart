import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { ProductService } from '@/src/server/modules/products/productService';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = sp.get('limit') ? Math.min(24, Math.max(1, Number(sp.get('limit')))) : 8;
  const days = sp.get('days') ? Math.min(90, Math.max(1, Number(sp.get('days')))) : 30;

  const result = await ProductService.getTrending(limit, days);
  return apiSuccess(result);
}
