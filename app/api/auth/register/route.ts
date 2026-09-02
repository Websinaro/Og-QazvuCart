import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { AuthService } from '@/src/server/modules/auth/authService';
import { registerSchema } from '@/src/server/validators/auth';
import { setAuthCookies } from '@/src/lib/sessionService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 422, parsed.error.issues);
    }

    const { user, accessToken, refreshToken } = await AuthService.register(parsed.data);
    const response = apiSuccess({ user }, 201);
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (err) {
    return apiError('REGISTER_FAILED', err instanceof Error ? err.message : 'Registration failed', 400);
  }
}
