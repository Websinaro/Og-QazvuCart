import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { SellerAccountService } from '@/src/server/modules/sellers/sellerAccountService';
import { sellerApplicationSchema } from '@/src/server/validators/seller';

/** A signed-in customer applies to become a seller (or re-applies after a rejection). */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const body = await parseBody(req, sellerApplicationSchema);
  if (!body.ok) return body.response;

  try {
    const seller = await SellerAccountService.apply(user.userId, body.data);
    return apiSuccess({ seller }, 201);
  } catch (err) {
    return handleError(err, 'APPLY_FAILED', 'Failed to submit your application');
  }
}
