import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { AuthService } from '@/src/server/modules/auth/authService';
import { setAuthCookies } from '@/src/lib/sessionService';
import { config } from '@/src/lib/env';

// Exchanges a valid, non-revoked refresh-token cookie for a fresh
// short-lived access-token cookie, without requiring the user to log in
// again. The refresh token cookie itself is untouched (its own 30 day
// HttpOnly cookie keeps flowing on future requests until it expires).
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(config.refreshCookieName)?.value;
  if (!refreshToken) {
    return apiError('UNAUTHORIZED', 'No refresh token present', 401);
  }

  try {
    const { accessToken, user } = await AuthService.refreshAccessToken(refreshToken);
    const response = apiSuccess({ user });
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (err) {
    return apiError('REFRESH_FAILED', err instanceof Error ? err.message : 'Session expired, please log in again', 401);
  }
}
