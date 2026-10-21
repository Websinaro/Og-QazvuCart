import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { QuestionService } from '@/src/server/modules/questions/questionService';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { status } = await req.json().catch(() => ({}));
  if (status !== 'APPROVED' && status !== 'REJECTED') return apiError('VALIDATION_ERROR', 'status must be APPROVED or REJECTED', 422);
  try {
    await QuestionService.moderate(Number(id), status);
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiError('NOT_FOUND', err instanceof Error ? err.message : 'Failed', 404);
  }
}
