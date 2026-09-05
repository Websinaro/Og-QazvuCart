import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { ProductService } from '@/src/server/modules/products/productService';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const parseIntList = (raw: string | null) =>
    raw
      ? raw
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n) && n > 0)
      : undefined;

  const result = await ProductService.getProducts({
    q: sp.get('q') || undefined,
    category: sp.get('category') || undefined,
    categories: parseIntList(sp.get('categories')),
    ids: parseIntList(sp.get('ids')),
    excludeIds: parseIntList(sp.get('excludeIds')),
    minPrice: sp.get('minPrice') ? Number(sp.get('minPrice')) : undefined,
    maxPrice: sp.get('maxPrice') ? Number(sp.get('maxPrice')) : undefined,
    minRating: sp.get('minRating') ? Number(sp.get('minRating')) : undefined,
    minDiscount: sp.get('minDiscount') ? Number(sp.get('minDiscount')) : undefined,
    inStock: sp.get('inStock') === 'true',
    isDeal: sp.get('isDeal') === 'true',
    isFeatured: sp.get('isFeatured') === 'true',
    sort: (sp.get('sort') as any) || undefined,
    page: sp.get('page') ? Number(sp.get('page')) : undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
  });

  return apiSuccess(result);
}
