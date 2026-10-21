'use client';
/**
 * Browser-side helper to (re)open Razorpay Checkout for an order that is
 * awaiting payment. The server picks the amount (the order total) and the
 * Razorpay order; this only opens the widget and reports what happened.
 * "Success" here is NOT trusted by itself: after the widget returns we ask
 * the server to verify, and the final word is the server's order status.
 */
import { authFetch } from './api';

type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void; on?: (ev: string, cb: (r: unknown) => void) => void };

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export type PayResult = { ok: true } | { ok: false; message: string; cancelled?: boolean };

export async function payForOrder(orderId: number, opts: { description?: string; prefill?: { name?: string; contact?: string } } = {}): Promise<PayResult> {
  if (!(await loadScript())) return { ok: false, message: 'Could not load the payment gateway. Please check your connection and try again.' };

  const createRes = await authFetch('/api/payments/razorpay/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  const created = await createRes.json();
  if (!created.success) return { ok: false, message: created.error?.message || 'Payment service unavailable' };
  const { razorpayOrderId, amount, currency, razorpayKeyId } = created.data;

  return new Promise<PayResult>((resolve) => {
    const Ctor = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
    const rzp = new Ctor({
      key: razorpayKeyId, amount, currency, name: 'QazvuCart', description: opts.description, order_id: razorpayOrderId,
      prefill: opts.prefill, theme: { color: '#5a42f5' },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          const verifyRes = await authFetch('/api/payments/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, ...response }),
          });
          const v = await verifyRes.json();
          resolve(v.success ? { ok: true } : { ok: false, message: v.error?.message || 'Payment verification failed' });
        } catch {
          resolve({ ok: false, message: 'We could not confirm your payment yet. If money was deducted it will be reconciled automatically — check your Orders page shortly.' });
        }
      },
      modal: { ondismiss: () => resolve({ ok: false, cancelled: true, message: 'Payment cancelled' }) },
    });
    rzp.on?.('payment.failed', () => { /* the modal stays open so the customer can retry inside it; the server learns via webhook */ });
    rzp.open();
  });
}
