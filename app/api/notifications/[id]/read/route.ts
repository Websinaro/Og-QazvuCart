import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { NotificationService } from '@/src/server/modules/notifications/notificationService';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const { id } = await params;
  const notificationId = Number(id);
  if (!Number.isInteger(notificationId)) {
    return apiError('VALIDATION_ERROR', 'Invalid notification id', 422);
  }

  await NotificationService.markRead(authUser.userId, notificationId);
  return apiSuccess({ ok: true });
}
