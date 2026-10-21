import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { PaymentService } from '@/src/server/modules/payments/paymentService';
import { PaymentAdminQueries } from '@/src/server/modules/payments/paymentAdminQueries';
import { paymentErrorResponse } from '@/src/lib/paymentHttp';

async function admin(req: NextRequest) {
  const u = await getAuthUser(req);
  if (!u) return { error: apiError('UNAUTHORIZED', 'Please log in to continue', 401) };
  if (u.role !== 'ADMIN') return { error: apiError('FORBIDDEN', 'Admin access required', 403) };
  return { user: u };
}

/** Past runs, or one run with its findings (?run=ID). */
export async function GET(req: NextRequest) {
  const a = await admin(req);
  if (a.error) return a.error;
  const runId = Number(req.nextUrl.searchParams.get('run'));
  if (runId) {
    const detail = await PaymentAdminQueries.getReconciliationRun(runId);
    return detail ? apiSuccess(detail) : apiError('NOT_FOUND', 'Run not found', 404);
  }
  return apiSuccess(await PaymentAdminQueries.listReconciliationRuns());
}

/**
 * Compare Razorpay's payments/refunds with ours for a window.
 * Body: { hours?: number (default 48, max 720), heal?: boolean (default true; false = report only) }
 */
export async function POST(req: NextRequest) {
  const a = await admin(req);
  if (a.error) return a.error;
  try {
    const body = await req.json().catch(() => ({}));
    const hours = Math.min(Math.max(Number(body.hours) || 48, 1), 720);
    const to = new Date();
    const summary = await PaymentService.reconcile({
      from: new Date(to.getTime() - hours * 3600_000), to, heal: body.heal !== false, trigger: 'MANUAL', triggeredBy: a.user.userId,
    });
    return apiSuccess(summary);
  } catch (err) {
    return paymentErrorResponse(err, 'RECONCILE_FAILED', 'Reconciliation failed');
  }
}
