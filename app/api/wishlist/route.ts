import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { WishlistService } from '@/src/server/modules/wishlist/wishlistService';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const items = await WishlistService.getWishlist(authUser.userId);
  return apiSuccess(items);
}

// Toggles wishlist membership for a product: adds it if absent, removes it
// if already present. Returns { isWishlisted } reflecting the new state.
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const productId = Number(body.productId);
    if (!productId) return apiError('VALIDATION_ERROR', 'productId is required', 422);

    const alreadyIn = await WishlistService.isInWishlist(authUser.userId, productId);
    if (alreadyIn) {
      await WishlistService.removeFromWishlist(authUser.userId, productId);
      return apiSuccess({ isWishlisted: false });
    } else {
      await WishlistService.addToWishlist(authUser.userId, productId);
      return apiSuccess({ isWishlisted: true }, 201);
    }
  } catch (err) {
    return apiError('WISHLIST_FAILED', err instanceof Error ? err.message : 'Failed to update wishlist', 400);
  }
}
