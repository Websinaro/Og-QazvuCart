import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { AuthService } from '@/src/server/modules/auth/authService';
import { updateProfileSchema } from '@/src/server/validators/auth';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const result = await AuthService.getMe(authUser.userId);
    return apiSuccess(result);
  } catch (err) {
    return apiError('FETCH_FAILED', err instanceof Error ? err.message : 'Failed to load profile', 400);
  }
}

export async function PATCH(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
    }
    const result = await AuthService.updateProfile(authUser.userId, parsed.data);
    return apiSuccess(result);
  } catch (err) {
    return apiError('UPDATE_FAILED', err instanceof Error ? err.message : 'Failed to update profile', 400);
  }
}
