import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { PlatformSettingsService } from '@/src/server/modules/settings/platformSettingsService';
import { commissionSettingsSchema } from '@/src/server/validators/seller';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const [settings, categories] = await Promise.all([
      PlatformSettingsService.getForAdmin(),
      PlatformSettingsService.listCategoryRates(),
    ]);
    return apiSuccess({ settings, categories });
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load commission settings');
  }
}

/** Platform default commission, payout hold days, minimum payout. Affects NEW orders only. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const body = await parseBody(req, commissionSettingsSchema);
  if (!body.ok) return body.response;
  try {
    return apiSuccess({ settings: await PlatformSettingsService.update(auth.user.userId, body.data) });
  } catch (err) {
    return handleError(err, 'UPDATE_FAILED', 'Failed to update settings');
  }
}
