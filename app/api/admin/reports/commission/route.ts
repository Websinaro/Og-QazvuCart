import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { PayoutService } from '@/src/server/modules/payouts/payoutService';

function parseDate(raw: string | null): Date | undefined | 'invalid' {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 'invalid' : d;
}

/** Commission earned by the platform per seller. `?from=YYYY-MM-DD&to=YYYY-MM-DD` (to is exclusive), `&format=csv`. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const sp = req.nextUrl.searchParams;
  const from = parseDate(sp.get('from'));
  const to = parseDate(sp.get('to'));
  if (from === 'invalid' || to === 'invalid') return apiError('VALIDATION_ERROR', 'Dates must look like 2026-10-01', 422);

  try {
    const report = await PayoutService.commissionReport({ from, to });
    if (sp.get('format') === 'csv') {
      return new NextResponse(PayoutService.commissionReportToCsv(report), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="commission-report.csv"',
        },
      });
    }
    return apiSuccess(report);
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Failed to build commission report');
  }
}
