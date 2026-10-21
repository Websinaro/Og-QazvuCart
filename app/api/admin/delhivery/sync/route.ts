import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { DelhiveryService } from '@/src/server/modules/orders/delhiveryService';

/** Admin click, or a scheduler calling with `Authorization: Bearer $CRON_SECRET`. */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const cronOk = Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
  if (!cronOk) {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;
  }
  try {
    return apiSuccess(await DelhiveryService.syncTracking());
  } catch (err) {
    return handleError(err, 'SYNC_FAILED', 'Delhivery sync failed');
  }
}
export const GET = run;
export const POST = run;
