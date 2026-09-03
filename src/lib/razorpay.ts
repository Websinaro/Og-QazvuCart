import crypto from 'node:crypto';
import { razorpayEnv } from './env';

/**
 * Minimal server-side Razorpay client using `fetch` + `crypto` directly
 * against Razorpay's REST API, rather than pulling in the `razorpay` npm
 * package. This avoids adding an unpinned dependency we can't verify
 * installs cleanly in this environment, and Razorpay's REST API is small
 * enough that wrapping it directly is both simpler and easier to audit.
 *
 * TEST MODE: whether this hits Razorpay's test or live environment is
 * determined entirely by which key (rzp_test_... vs rzp_live_...) is
 * configured in RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET — there is no
 * separate "test mode" flag to set here. Use your Razorpay **test** API
 * keys for this deployment phase.
 */

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

function basicAuthHeader(): string {
  const token = Buffer.from(`${razorpayEnv.keyId}:${razorpayEnv.keySecret}`).toString('base64');
  return `Basic ${token}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string | null;
}

/**
 * Creates a Razorpay order for the given amount (in the smallest currency
 * unit — paise for INR). The `receipt` should be our own internal order
 * number so it's traceable in the Razorpay dashboard.
 */
export async function createRazorpayOrder(params: {
  amountInPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amountInPaise,
      currency: params.currency || 'INR',
      receipt: params.receipt,
      notes: params.notes,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Razorpay order creation failed (${res.status}): ${body.slice(0, 300)}`);
  }

  return res.json();
}

/**
 * Verifies the signature Razorpay Checkout returns to the browser after a
 * successful payment: HMAC-SHA256 of `${razorpay_order_id}|${razorpay_payment_id}`
 * keyed with the account's key secret. This MUST be checked server-side —
 * the browser callback firing is not itself proof of payment.
 */
export function verifyCheckoutSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const expected = crypto
    .createHmac('sha256', razorpayEnv.keySecret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest('hex');

  return timingSafeEqualHex(expected, params.razorpaySignature);
}

/**
 * Verifies an incoming webhook's `X-Razorpay-Signature` header: HMAC-SHA256
 * of the *raw* request body, keyed with the separate webhook secret (never
 * the API key secret). The caller must pass the raw, unparsed body string —
 * signing a re-serialized JSON object can produce a different byte
 * sequence than what Razorpay signed and would falsely reject/accept.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  const expected = crypto.createHmac('sha256', razorpayEnv.webhookSecret).update(rawBody).digest('hex');
  return timingSafeEqualHex(expected, signatureHeader);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Fetches a payment's details from Razorpay — used to double-check the
 * amount/currency/status server-side rather than trusting the client. */
export async function fetchRazorpayPayment(paymentId: string): Promise<{
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
}> {
  const res = await fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}`, {
    headers: { Authorization: basicAuthHeader() },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to fetch Razorpay payment (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}
