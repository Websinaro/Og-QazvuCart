import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { PaymentAdminQueries } from '@/src/server/modules/payments/paymentAdminQueries';
import { PaymentService } from '@/src/server/modules/payments/paymentService';

export async function GET(req: NextRequest) {
  const u = await getAuthUser(req);
  if (!u) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (u.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status')?.toUpperCase();
  if (status && !['PENDING', 'PROCESSED', 'FAILED'].includes(status)) return apiError('VALIDATION_ERROR', 'Invalid status', 422);
  return apiSuccess(await PaymentAdminQueries.listRefunds({ status: status || undefined, limit: Number(sp.get('limit')) || 50 }));
}

/** Retry-now for every refund that is due (PENDING and not currently being worked on). */
export async function POST(req: NextRequest) {
  const u = await getAuthUser(req);
  if (!u) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);
  if (u.role !== 'ADMIN') return apiError('FORBIDDEN', 'Admin access required', 403);
  return apiSuccess(await PaymentService.processDueRefunds(50));
}
