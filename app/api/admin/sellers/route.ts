import { NextRequest } from 'next/server';
import { apiSuccess } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { SellerAccountService } from '@/src/server/modules/sellers/sellerAccountService';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const sp = req.nextUrl.searchParams;
  try {
    return apiSuccess(
      await SellerAccountService.listForAdmin({ status: sp.get('status') || undefined, q: sp.get('q') || undefined })
    );
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load sellers');
  }
}
