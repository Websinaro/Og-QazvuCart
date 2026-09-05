import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { CouponService } from '@/src/server/modules/coupons/couponService';

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === 'string' ? body.code : '';
  const subtotal = Number(body.subtotal);

  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return apiError('VALIDATION_ERROR', 'A valid subtotal is required', 422);
  }

  const result = await CouponService.validate(code, authUser.userId, subtotal);
  return apiSuccess(result);
}
