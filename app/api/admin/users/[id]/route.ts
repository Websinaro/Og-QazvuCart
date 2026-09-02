import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { AdminService } from '@/src/server/modules/admin/adminService';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  try {
    const body = await req.json();
    const role = String(body.role || '').toUpperCase();
    if (!['CUSTOMER', 'SELLER', 'ADMIN'].includes(role)) {
      return apiError('VALIDATION_ERROR', 'role must be CUSTOMER, SELLER, or ADMIN', 422);
    }
    const result = await AdminService.updateUserRole(Number(params.id), role as 'CUSTOMER' | 'SELLER' | 'ADMIN');
    return apiSuccess(result);
  } catch (err) {
    return apiError('UPDATE_FAILED', err instanceof Error ? err.message : 'Failed to update user role', 400);
  }
}
