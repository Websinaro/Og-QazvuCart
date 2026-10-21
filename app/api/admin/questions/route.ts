import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { QuestionService } from '@/src/server/modules/questions/questionService';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return apiSuccess(await QuestionService.listForModeration(req.nextUrl.searchParams.get('status') || 'PENDING'));
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load questions');
  }
}
