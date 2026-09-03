import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/src/server/modules/payments/paymentService';

/**
 * Razorpay server-to-server webhook. Configure in the Razorpay Dashboard:
 *   Settings -> Webhooks -> Add New Webhook
 *   URL: https://YOUR_DOMAIN/api/payments/razorpay/webhook
 *   Secret: must match RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, payment.authorized, payment.failed
 *
 * The raw request body (not the parsed JSON) is what Razorpay signs, so
 * we read it as text before doing anything else — re-serializing a parsed
 * object can produce different bytes and would break signature
 * verification.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-razorpay-signature');
  if (!signature) {
    return NextResponse.json({ success: false, error: { code: 'MISSING_SIGNATURE', message: 'Missing signature' } }, { status: 400 });
  }

  const rawBody = await req.text();

  try {
    const result = await PaymentService.handleWebhook(rawBody, signature);
    // Always 200 once signature-verified and processed (or safely
    // no-op'd) — Razorpay retries on non-2xx, and since our handling is
    // idempotent, a 200 is correct even when we intentionally did nothing
    // (e.g. an event type we don't act on).
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    const status = message.includes('Invalid webhook signature') ? 401 : 500;
    // Never log the webhook secret or full payment payload here.
    console.error('Razorpay webhook error:', message);
    return NextResponse.json({ success: false, error: { code: 'WEBHOOK_ERROR', message } }, { status });
  }
}
