import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { CouponService } from '@/src/server/modules/coupons/couponService';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  const { id } = await params;
  const couponId = Number(id);
  if (!Number.isInteger(couponId)) return apiError('VALIDATION_ERROR', 'Invalid coupon id', 422);

  const body = await req.json().catch(() => ({}));
  if (typeof body.isActive !== 'boolean') {
    return apiError('VALIDATION_ERROR', 'isActive (boolean) is required', 422);
  }

  const coupon = await CouponService.setActive(couponId, body.isActive);
  if (!coupon) return apiError('NOT_FOUND', 'Coupon not found', 404);
  return apiSuccess(coupon);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  const { id } = await params;
  const couponId = Number(id);
  if (!Number.isInteger(couponId)) return apiError('VALIDATION_ERROR', 'Invalid coupon id', 422);

  await CouponService.remove(couponId);
  return apiSuccess({ ok: true });
}
