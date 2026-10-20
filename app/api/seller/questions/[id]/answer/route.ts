import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { parseId, requireSeller } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { SellerQuestionService } from '@/src/server/modules/seller/sellerOrderService';
import { sellerAnswerSchema } from '@/src/server/validators/seller';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Question not found', 404);
  const body = await parseBody(req, sellerAnswerSchema);
  if (!body.ok) return body.response;
  try {
    const answer = await SellerQuestionService.answer(ctx.seller.id, ctx.user.userId, id, body.data.answerText);
    return apiSuccess({ answer }, 201);
  } catch (err) {
    return handleError(err, 'ANSWER_FAILED', 'Failed to post answer');
  }
}
