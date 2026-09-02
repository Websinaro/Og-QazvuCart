import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { SellerService } from '@/src/server/modules/sellers/sellerService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const searchParams = req.nextUrl.searchParams;

  try {
    const result = await SellerService.getSellerBySlug(slug, {
      page: Number(searchParams.get('page')) || 1,
      limit: Number(searchParams.get('limit')) || 12,
    });

    if (!result) {
      return apiError('NOT_FOUND', 'This store could not be found', 404);
    }

    return apiSuccess(result);
  } catch (err) {
    return apiError('SELLER_FETCH_FAILED', err instanceof Error ? err.message : 'Failed to load store', 500);
  }
}
