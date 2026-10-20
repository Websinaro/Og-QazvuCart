import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { parseId, requireSeller } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { PayoutService } from '@/src/server/modules/payouts/payoutService';

/**
 * Settlement report for one of the caller's payouts (JSON, or `?format=csv`).
 * The lookup is scoped to the caller's seller id, so another seller's payout
 * id returns 404.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSeller(req, 'read');
  if (!ctx.ok) return ctx.response;
  const id = parseId((await params).id);
  if (!id) return apiError('NOT_FOUND', 'Payout not found', 404);

  try {
    const report = await PayoutService.getReport(id, { scopeSellerId: ctx.seller.id });
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
