import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { parseId, requireAdmin } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { PlatformSettingsService } from '@/src/server/modules/settings/platformSettingsService';
import { categoryCommissionSchema } from '@/src/server/validators/seller';

/** Set (or clear with null) a category's commission override. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Category not found', 404);
  const body = await parseBody(req, categoryCommissionSchema);
  if (!body.ok) return body.response;
  try {
    return apiSuccess(await PlatformSettingsService.setCategoryRate(id, body.data.commissionPercent));
  } catch (err) {
    return handleError(err, 'UPDATE_FAILED', 'Failed to update category commission');
  }
}
