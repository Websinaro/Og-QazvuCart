import { NextRequest, NextResponse } from 'next/server';
import { PaymentService, PaymentError } from '@/src/server/modules/payments/paymentService';

/**
 * Razorpay server-to-server webhook. Configure in the Razorpay Dashboard:
 *   Settings -> Webhooks -> Add New Webhook
 *   URL: https://YOUR_DOMAIN/api/payments/razorpay/webhook
 *   Secret: must match RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.authorized, payment.captured, payment.failed, order.paid,
 *           refund.created, refund.processed, refund.failed
 *
 * The raw request body (not the parsed JSON) is what Razorpay signs, so we
 * read it as text before doing anything else.
 *
 * Idempotency: `X-Razorpay-Event-Id` is recorded in a ledger, so a redelivery
 * of the same event is acknowledged (200) without being re-applied; every
 * state change underneath is also guarded, so even two different events
 * describing the same payment converge. Status codes matter to Razorpay's
 * retry logic: 2xx = done, 4xx/5xx = retry. We return 401/400 for forged or
 * malformed requests (retrying cannot help, and nothing is recorded), and
 * 500 only for genuine processing failures that a retry may fix.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-razorpay-signature');
  if (!signature) {
    return NextResponse.json({ success: false, error: { code: 'MISSING_SIGNATURE', message: 'Missing signature' } }, { status: 400 });
  }

  const rawBody = await req.text();
  const eventId = req.headers.get('x-razorpay-event-id');

  try {
    const result = await PaymentService.handleWebhook(rawBody, signature, eventId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof PaymentError) {
      if (err.httpStatus === 401) console.warn('[payments] webhook with invalid signature rejected');
      return NextResponse.json({ success: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    // Never log the webhook secret or the full payload.
    console.error('Razorpay webhook error:', message);
    return NextResponse.json({ success: false, error: { code: 'WEBHOOK_ERROR', message: 'Webhook processing failed' } }, { status: 500 });
  }
}
