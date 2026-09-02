import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { AdminService } from '@/src/server/modules/admin/adminService';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  try {
    const body = await req.json();
    if (body.status && !['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(String(body.status).toUpperCase())) {
      return apiError('VALIDATION_ERROR', 'status must be ACTIVE, INACTIVE, or ARCHIVED', 422);
    }
    const result = await AdminService.updateProduct(Number(id), {
      discountPrice: body.discountPrice !== undefined ? Number(body.discountPrice) : undefined,
      stock: body.stock !== undefined ? Number(body.stock) : undefined,
      status: body.status ? String(body.status).toUpperCase() : undefined,
    });
    return apiSuccess(result);
  } catch (err) {
    return apiError('UPDATE_FAILED', err instanceof Error ? err.message : 'Failed to update product', 400);
  }
}
