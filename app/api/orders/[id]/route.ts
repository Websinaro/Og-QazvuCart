import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { OrderService } from '@/src/server/modules/orders/orderService';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const order = await OrderService.getOrderById(authUser.userId, params.id);
  if (!order) return apiError('NOT_FOUND', 'Order not found', 404);
  return apiSuccess(order);
}
