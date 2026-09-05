import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { CouponService } from '@/src/server/modules/coupons/couponService';
import { COUPON_TYPES } from '@/src/db/schema';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  const coupons = await CouponService.listAll();
  return apiSuccess(coupons);
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const type = COUPON_TYPES.includes(body.type) ? body.type : null;
  const value = Number(body.value);

  if (!code || code.length > 30) {
    return apiError('VALIDATION_ERROR', 'code is required and must be under 30 characters', 422);
  }
  if (!type) {
    return apiError('VALIDATION_ERROR', 'type must be PERCENT or FIXED', 422);
  }
  if (!Number.isFinite(value) || value <= 0 || (type === 'PERCENT' && value > 100)) {
    return apiError('VALIDATION_ERROR', 'value must be a positive number (max 100 for PERCENT)', 422);
  }

  try {
    const coupon = await CouponService.create(authUser.userId, {
      code,
      description: typeof body.description === 'string' ? body.description : undefined,
      type,
      value,
      minOrderValue: body.minOrderValue !== undefined ? Number(body.minOrderValue) : undefined,
      maxDiscountAmount:
        body.maxDiscountAmount !== undefined && body.maxDiscountAmount !== null && body.maxDiscountAmount !== ''
          ? Number(body.maxDiscountAmount)
          : null,
      usageLimit:
        body.usageLimit !== undefined && body.usageLimit !== null && body.usageLimit !== ''
          ? Number(body.usageLimit)
          : null,
      perUserLimit: body.perUserLimit !== undefined ? Number(body.perUserLimit) : undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });
    return apiSuccess(coupon, 201);
  } catch (err) {
    return apiError('CREATE_FAILED', err instanceof Error ? err.message : 'Failed to create coupon', 400);
  }
}
