import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/src/lib/response';
import { requireAdmin } from '@/src/lib/sellerAuth';
import { handleError } from '@/src/lib/routeHelpers';
import { AdminInsightsService } from '@/src/server/modules/admin/adminInsightsService';

export async function GET(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { type } = await ctx.params;
  try {
    const csv = await AdminInsightsService.exportCsv(type);
    if (csv === null) return apiError('NOT_FOUND', 'Export type must be orders, products or sales', 404);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    return handleError(err, 'FETCH_FAILED', 'Export failed');
  }
}
