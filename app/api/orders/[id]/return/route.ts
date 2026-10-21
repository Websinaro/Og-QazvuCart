import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { OrderTrackingService } from '@/src/server/modules/orders/orderTrackingService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  const body = await req.json().catch(() => ({}));
  try {
    const result = await OrderTrackingService.requestReturn(authUser.userId, Number(id), String(body.reason || ''), body.details ? String(body.details) : undefined);
    return apiSuccess(result);
  } catch (err) {
    return apiError('RETURN_FAILED', err instanceof Error ? err.message : 'Failed to request return', 400);
  }
}
