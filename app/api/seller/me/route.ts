import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { requireSeller } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { SellerAccountService } from '@/src/server/modules/sellers/sellerAccountService';
import { sellerProfileUpdateSchema } from '@/src/server/validators/seller';

/**
 * Any signed-in user can ask "what's the state of MY seller application?".
 * Returns { seller: null } if they never applied. Only ever the caller's own record.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  const seller = await SellerAccountService.getMine(user.userId);
  return apiSuccess({ seller });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireSeller(req, 'write');
  if (!ctx.ok) return ctx.response;
  const body = await parseBody(req, sellerProfileUpdateSchema);
  if (!body.ok) return body.response;
  try {
    const seller = await SellerAccountService.updateProfile(ctx.seller.id, body.data);
    return apiSuccess({ seller });
  } catch (err) {
    return handleError(err, 'UPDATE_FAILED', 'Failed to update store profile');
  }
}
