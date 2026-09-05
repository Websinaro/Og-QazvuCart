import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { NotificationService } from '@/src/server/modules/notifications/notificationService';

export async function PATCH(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  await NotificationService.markAllRead(authUser.userId);
  return apiSuccess({ ok: true });
}
