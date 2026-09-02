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
    const nextStatus = String(body.status || '').toUpperCase();
    if (!nextStatus) return apiError('VALIDATION_ERROR', 'status is required', 422);

    // Transition is validated against the shared order state machine -
    // arbitrary jumps like DELIVERED -> PROCESSING are rejected here.
    await AdminService.updateOrderStatus(Number(id), nextStatus);
    return apiSuccess({ success: true });
  } catch (err) {
    return apiError('UPDATE_FAILED', err instanceof Error ? err.message : 'Failed to update order status', 400);
  }
}
