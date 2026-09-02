import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { CartService } from '@/src/server/modules/cart/cartService';
import { addToCartSchema } from '@/src/server/validators/ecommerce';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const cart = await CartService.getCart(authUser.userId);
  return apiSuccess(cart);
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const parsed = addToCartSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
    }
    const cart = await CartService.addItem(authUser.userId, parsed.data.productId, parsed.data.variantId, parsed.data.quantity);
    return apiSuccess(cart, 201);
  } catch (err) {
    return apiError('ADD_TO_CART_FAILED', err instanceof Error ? err.message : 'Failed to add item to cart', 400);
  }
}

export async function DELETE(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const cart = await CartService.clearCart(authUser.userId);
  return apiSuccess(cart);
}
