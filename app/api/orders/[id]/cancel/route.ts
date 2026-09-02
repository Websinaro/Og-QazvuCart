import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { OrderService } from '@/src/server/modules/orders/orderService';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const order = await OrderService.cancelOrder(authUser.userId, Number(params.id));
    return apiSuccess({ order });
  } catch (err) {
    return apiError('CANCEL_FAILED', err instanceof Error ? err.message : 'Failed to cancel order', 400);
  }
}
