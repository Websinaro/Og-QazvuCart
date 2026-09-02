import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { ReviewService } from '@/src/server/modules/reviews/reviewService';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const pending = await ReviewService.getPendingReviews(authUser.userId);
  return apiSuccess(pending);
}
