import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { AdminInsightsService, type Granularity } from '@/src/server/modules/admin/adminInsightsService';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const g = req.nextUrl.searchParams.get('granularity');
  const gran: Granularity = g === 'week' || g === 'month' ? g : 'day';
  try {
    return apiSuccess(await AdminInsightsService.getInsights(gran));
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load insights');
  }
}
