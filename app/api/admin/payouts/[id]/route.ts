import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { parseId, requireAdmin } from '@/src/lib/sellerAuth';
import { handleError, parseBody } from '@/src/lib/routeHelpers';
import { PayoutService } from '@/src/server/modules/payouts/payoutService';
import { payoutActionSchema } from '@/src/server/validators/seller';

type Ctx = { params: Promise<{ id: string }> };

/** Settlement report incl. the full (decrypted) payout destination — admin only. `?format=csv` downloads it. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Payout not found', 404);
  try {
    const report = await PayoutService.getReport(id, { revealDestination: true });
    if (req.nextUrl.searchParams.get('format') === 'csv') {
      return new NextResponse(PayoutService.reportToCsv(report), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="settlement-${report.payout.payoutNumber}.csv"`,
        },
      });
    }
    return apiSuccess(report);
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to load settlement report');
  }
}

/** MARK_PAID (after the bank transfer) or MARK_FAILED (releases the earnings back). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Payout not found', 404);
  const body = await parseBody(req, payoutActionSchema);
  if (!body.ok) return body.response;
  try {
    const a = body.data;
    const payout =
      a.action === 'MARK_PAID'
        ? await PayoutService.markPaid(auth.user.userId, id, { method: a.method, reference: a.reference, notes: a.notes })
        : await PayoutService.markFailed(auth.user.userId, id, a.reason);
    return apiSuccess({ payout });
  } catch (err) {
    return handleError(err, 'UPDATE_FAILED', 'Failed to update payout');
  }
}
