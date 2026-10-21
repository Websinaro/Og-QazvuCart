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

/** Thrown for any non-2xx / network failure talking to Razorpay. `status` is null for network errors. */
export class RazorpayApiError extends Error {
  constructor(message: string, public readonly status: number | null, public readonly code?: string) {
    super(message);
    this.name = 'RazorpayApiError';
  }
}

async function rzpRequest<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
      method: init.method || 'GET',
      headers: {
        Authorization: basicAuthHeader(),
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new RazorpayApiError(`Razorpay request failed: ${err instanceof Error ? err.message : 'network error'}`, null);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let code: string | undefined;
    let description = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      code = j?.error?.code;
      description = j?.error?.description || description;
    } catch { /* not JSON */ }
    throw new RazorpayApiError(`Razorpay ${init.method || 'GET'} ${path} failed (${res.status}): ${description}`, res.status, code);
  }
  return res.json() as Promise<T>;
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
  return rzpRequest<RazorpayOrder>('/orders', {
    method: 'POST',
    body: {
      amount: params.amountInPaise,
      currency: params.currency || 'INR',
      receipt: params.receipt,
      notes: params.notes,
    },
  });
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
  if (typeof b !== 'string' || !/^[0-9a-fA-F]+$/.test(b) || b.length !== a.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Fetches a payment's details from Razorpay — used to double-check the
 * amount/currency/status server-side rather than trusting the client. */
export function fetchRazorpayPayment(paymentId: string) {
  return rzpRequest<RemotePayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

// ---------------------------------------------------------------------------
// Gateway surface used by the payment services (see payments/ports.ts).
// ---------------------------------------------------------------------------

import type { RemotePayment, RemoteRefund } from './paymentRules';

interface ListResponse<T> { items: T[]; count: number }

export const razorpayGateway = {
  createOrder: createRazorpayOrder,

  fetchPayment: (paymentId: string) => rzpRequest<RemotePayment>(`/payments/${encodeURIComponent(paymentId)}`),

  /** Capture an authorized payment. Amount is OUR server-side amount. */
  capturePayment: (paymentId: string, amount: number, currency: string) =>
    rzpRequest<RemotePayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, { method: 'POST', body: { amount, currency } }),

  /** `idempotencyKey` is sent as X-Refund-Idempotency so a retried call returns the same refund. */
  createRefund: (paymentId: string, args: { amount: number; receipt: string; idempotencyKey: string; notes?: Record<string, string> }) =>
    rzpRequest<RemoteRefund>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      body: { amount: args.amount, receipt: args.receipt, speed: 'normal', notes: args.notes },
      headers: { 'X-Refund-Idempotency': args.idempotencyKey },
    }),

  fetchRefund: (refundId: string) => rzpRequest<RemoteRefund>(`/refunds/${encodeURIComponent(refundId)}`),

  /** Payments created in [from, to] (unix seconds). Paged by the caller via skip. */
  listPayments: (args: { from: number; to: number; count: number; skip: number }) =>
    rzpRequest<ListResponse<RemotePayment>>(`/payments?from=${args.from}&to=${args.to}&count=${args.count}&skip=${args.skip}`),

  listRefunds: (args: { from: number; to: number; count: number; skip: number }) =>
    rzpRequest<ListResponse<RemoteRefund>>(`/refunds?from=${args.from}&to=${args.to}&count=${args.count}&skip=${args.skip}`),

  /** All payment attempts Razorpay holds against one Razorpay order. */
  listOrderPayments: (orderId: string) => rzpRequest<ListResponse<RemotePayment>>(`/orders/${encodeURIComponent(orderId)}/payments`),
};
