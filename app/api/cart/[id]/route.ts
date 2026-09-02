import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { CartService } from '@/src/server/modules/cart/cartService';
import { updateCartItemSchema } from '@/src/server/validators/ecommerce';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const parsed = updateCartItemSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
    }
    const cart = await CartService.updateItem(authUser.userId, Number(id), parsed.data.quantity);
    return apiSuccess(cart);
  } catch (err) {
    return apiError('UPDATE_FAILED', err instanceof Error ? err.message : 'Failed to update cart item', 400);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const cart = await CartService.removeItem(authUser.userId, Number(id));
  return apiSuccess(cart);
}
