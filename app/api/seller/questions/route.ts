import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireSeller } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { SellerQuestionService } from '@/src/server/modules/seller/sellerOrderService';

export async function GET(req: NextRequest) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  try {
    const questions = await SellerQuestionService.list(ctx.seller.id, {
      unansweredOnly: req.nextUrl.searchParams.get('unanswered') === 'true',
    });
    return apiSuccess({ questions });
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load questions');
  }
}
