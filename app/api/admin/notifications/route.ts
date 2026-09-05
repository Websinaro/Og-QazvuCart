import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { NotificationService } from '@/src/server/modules/notifications/notificationService';
import { NOTIFICATION_TARGETS } from '@/src/db/schema';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  const history = await NotificationService.getBroadcastHistory();
  return apiSuccess(history);
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (authUser.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const messageBody = typeof body.body === 'string' ? body.body.trim() : '';
  const link = typeof body.link === 'string' && body.link.trim() ? body.link.trim() : undefined;
  const target = NOTIFICATION_TARGETS.includes(body.target) ? body.target : 'ALL';

  if (!title || title.length > 200) {
    return apiError('VALIDATION_ERROR', 'title is required and must be under 200 characters', 422);
  }
  if (!messageBody || messageBody.length > 2000) {
    return apiError('VALIDATION_ERROR', 'body is required and must be under 2000 characters', 422);
  }

  try {
    const result = await NotificationService.sendBroadcast({
      sentBy: authUser.userId,
      title,
      body: messageBody,
      link,
      target,
    });
    return apiSuccess(result, 201);
  } catch (err) {
    return apiError('SEND_FAILED', err instanceof Error ? err.message : 'Failed to send notification', 500);
  }
}
