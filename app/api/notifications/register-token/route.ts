import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { NotificationService } from '@/src/server/modules/notifications/notificationService';

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return apiError('VALIDATION_ERROR', 'token is required', 422);

  await NotificationService.registerDeviceToken(authUser.userId, token);
  return apiSuccess({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return apiError('VALIDATION_ERROR', 'token is required', 422);

  await NotificationService.removeDeviceToken(token);
  return apiSuccess({ ok: true });
}
