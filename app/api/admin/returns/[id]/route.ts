import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { OrderTrackingService } from '@/src/server/modules/orders/orderTrackingService';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.decision !== 'APPROVE' && body.decision !== 'REJECT') return apiError('VALIDATION_ERROR', 'decision must be APPROVE or REJECT', 422);
  try {
    await OrderTrackingService.resolveReturn(auth.user.userId, Number(id), body.decision, body.note);
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiError('RETURN_FAILED', err instanceof Error ? err.message : 'Failed to update return', 400);
  }
}
