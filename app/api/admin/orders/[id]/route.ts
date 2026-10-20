import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { AdminService } from '@/src/server/modules/admin/adminService';
import { NotFoundError } from '@/src/server/modules/orders/fulfilment';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  try {
    const body = await req.json();
    const nextStatus = String(body.status || '').toUpperCase();
    if (!nextStatus) return apiError('VALIDATION_ERROR', 'status is required', 422);

    // Optional: act on a single seller's parcel instead of the whole order.
    const sellerOrderId = body.sellerOrderId !== undefined ? Number(body.sellerOrderId) : undefined;
    if (sellerOrderId !== undefined && (!Number.isInteger(sellerOrderId) || sellerOrderId <= 0)) {
      return apiError('VALIDATION_ERROR', 'sellerOrderId must be a positive integer', 422);
    }

    // Transitions are validated against the shared order state machine.
    await AdminService.updateOrderStatus(Number(id), nextStatus, authUser.userId, sellerOrderId);
    return apiSuccess({ success: true });
  } catch (err) {
    if (err instanceof NotFoundError) return apiError('NOT_FOUND', err.message, 404);
    return apiError('UPDATE_FAILED', err instanceof Error ? err.message : 'Failed to update order status', 400);
  }
}
