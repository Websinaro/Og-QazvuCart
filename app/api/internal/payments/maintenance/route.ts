import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { maintenanceEnv } from '@/src/lib/env';
import { PaymentService } from '@/src/server/modules/payments/paymentService';

function authorised(req: NextRequest): boolean {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = crypto.createHash('sha256').update(token).digest();
  const b = crypto.createHash('sha256').update(maintenanceEnv.cronSecret).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled payment housekeeping — call every 5-15 minutes (e.g. a Render
 * Cron Job) with `Authorization: Bearer $CRON_SECRET`:
 * recovers payments whose webhook was lost, expires unpaid orders, retries
 * pending refunds, reconciles the last 48h against Razorpay. Safe to run
 * concurrently or repeatedly.
 */
export async function POST(req: NextRequest) {
  try {
    if (!authorised(req)) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, error: { code: 'MAINTENANCE_UNAVAILABLE', message: 'Not configured' } }, { status: 503 });
  }
  const report = await PaymentService.runMaintenance();
  return NextResponse.json({ success: true, data: report });
}
