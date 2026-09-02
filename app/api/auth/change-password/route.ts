import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { AuthService } from '@/src/server/modules/auth/authService';
import { changePasswordSchema } from '@/src/server/validators/auth';
import { clearAuthCookies } from '@/src/lib/sessionService';

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
    }

    const result = await AuthService.changePassword(authUser.userId, parsed.data.currentPassword, parsed.data.newPassword);

    // All sessions (including this one's refresh token) were just revoked
    // server-side, so also clear this browser's cookies and force re-login.
    const response = apiSuccess(result);
    clearAuthCookies(response);
    return response;
  } catch (err) {
    return apiError('CHANGE_PASSWORD_FAILED', err instanceof Error ? err.message : 'Failed to change password', 400);
  }
}
