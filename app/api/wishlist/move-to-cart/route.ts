import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { WishlistService } from '@/src/server/modules/wishlist/wishlistService';
import { CartService } from '@/src/server/modules/cart/cartService';

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const productId = Number(body.productId);
    const variantId = body.variantId ? Number(body.variantId) : null;
    const quantity = Number(body.quantity) || 1;
    if (!productId) return apiError('VALIDATION_ERROR', 'productId is required', 422);

    const cart = await CartService.addItem(authUser.userId, productId, variantId, quantity);
    const items = await WishlistService.removeFromWishlist(authUser.userId, productId);
    return apiSuccess({ cart, wishlist: items });
  } catch (err) {
    return apiError('MOVE_FAILED', err instanceof Error ? err.message : 'Failed to move item to cart', 400);
  }
}
