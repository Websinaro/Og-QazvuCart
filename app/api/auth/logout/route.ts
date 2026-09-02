import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { AuthService } from '@/src/server/modules/auth/authService';
import { clearAuthCookies } from '@/src/lib/sessionService';
import { config } from '@/src/lib/env';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(config.refreshCookieName)?.value;
  await AuthService.logout(refreshToken);
  const response = apiSuccess({ success: true });
  clearAuthCookies(response);
  return response;
}
