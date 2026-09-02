import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { OrderService } from '@/src/server/modules/orders/orderService';
import { createOrderSchema } from '@/src/server/validators/ecommerce';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const status = req.nextUrl.searchParams.get('status') || undefined;
  const orders = await OrderService.getUserOrders(authUser.userId, status);
  return apiSuccess(orders);
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
    }

    // The entire checkout (stock validation, inventory reservation, order +
    // items + timeline creation, cart clearing) runs inside a single
    // PostgreSQL transaction in OrderService.createOrder - it either fully
    // commits or fully rolls back.
    const order = await OrderService.createOrder(authUser.userId, parsed.data);
    return apiSuccess(order, 201);
  } catch (err) {
    return apiError('CHECKOUT_FAILED', err instanceof Error ? err.message : 'Failed to place order', 400);
  }
}
