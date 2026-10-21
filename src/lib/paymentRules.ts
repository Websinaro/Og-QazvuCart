/**
 * Pure payment / refund rules. No I/O, no imports — every money decision the
 * server makes is expressed here as a function of (our records, the
 * gateway's report) so it can be tested exhaustively and reused by the
 * webhook, the browser-verify path and the reconciler alike.
 *
 * Units: `payments.amount`, `capturedAmount`, `refundedAmount` and refunds
 * are PAISE. `orders.total` is whole RUPEES. The server's order total is the
 * only source of truth for what a payment must be worth.
 */

export type PaymentStatus =
  | 'CREATED' | 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'MISMATCH' | 'REFUNDED';

export type RefundStatus = 'PENDING' | 'PROCESSED' | 'FAILED';
export type RefundReason =
  | 'ORDER_CANCELLED' | 'ORDER_RETURNED' | 'LATE_PAYMENT' | 'DUPLICATE_PAYMENT'
  | 'AMOUNT_MISMATCH' | 'ADMIN' | 'GATEWAY';

export const MAX_PAYMENT_ATTEMPTS = 5;
export const MAX_REFUND_ATTEMPTS = 8;
/** A refund row is only re-sent to the gateway this long after its last attempt. */
export const REFUND_LEASE_SECONDS = 30;
/** A webhook stuck in PROCESSING longer than this is assumed crashed and may be re-run. */
export const WEBHOOK_LOCK_SECONDS = 120;

export interface PaymentRecord {
  id: number;
  orderId: number;
  userId: number;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amount: number;
  capturedAmount: number;
  refundedAmount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  failureCode: string | null;
  failureReason: string | null;
  attemptNo: number;
  idempotencyKey: string | null;
  createdAt: Date;
}

export interface OrderPaymentView {
  id: number;
  userId: number;
  orderNumber: string;
  /** Fulfilment status (PENDING_PAYMENT, CONFIRMED, CANCELLED, ...). */
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  /** Whole rupees. */
  total: number;
  paymentReservationExpiresAt: Date | null;
}

export interface RemotePayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string; // created | authorized | captured | refunded | failed
  method?: string | null;
  amount_refunded?: number;
  error_code?: string | null;
  error_description?: string | null;
  created_at?: number;
}

export interface RemoteRefund {
  id: string;
  payment_id: string;
  amount: number;
  currency?: string;
  status: string; // pending | processed | failed
  receipt?: string | null;
  created_at?: number;
}

// ---------------------------------------------------------------------------
// Payment state machine
// ---------------------------------------------------------------------------

/**
 * Money received always wins over an earlier "failed"/"cancelled" verdict
 * (the customer may retry inside the same Razorpay checkout), but PAID can
 * never regress to FAILED because a stale webhook arrived late.
 */
const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  CREATED: ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'MISMATCH'],
  PENDING: ['AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'MISMATCH'],
  AUTHORIZED: ['PAID', 'FAILED', 'CANCELLED', 'MISMATCH'],
  FAILED: ['AUTHORIZED', 'PAID', 'MISMATCH'],
  CANCELLED: ['AUTHORIZED', 'PAID', 'MISMATCH'],
  PAID: ['REFUNDED'],
  MISMATCH: ['REFUNDED'],
  REFUNDED: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses of an attempt that can still become a successful payment. */
export const OPEN_PAYMENT_STATUSES: PaymentStatus[] = ['CREATED', 'PENDING', 'AUTHORIZED'];

// ---------------------------------------------------------------------------
// Amount checks
// ---------------------------------------------------------------------------

export function rupeesToPaise(rupees: number): number {
  if (!Number.isInteger(rupees) || rupees < 0) throw new Error('Order total must be a non-negative whole number of rupees');
  return rupees * 100;
}

export type AmountProblem = 'AMOUNT_MISMATCH' | 'CURRENCY_MISMATCH' | 'ORDER_TOTAL_MISMATCH';

/**
 * Is the money the gateway reports consistent with BOTH the amount we asked
 * for on this attempt AND the order's server-side total? Neither value ever
 * comes from the client.
 */
export function checkPaymentAmount(args: {
  paymentAmount: number;
  paymentCurrency: string;
  orderTotalRupees: number;
  remoteAmount: number;
  remoteCurrency: string;
}): AmountProblem | null {
  if (args.remoteCurrency !== args.paymentCurrency) return 'CURRENCY_MISMATCH';
  if (args.paymentAmount !== rupeesToPaise(args.orderTotalRupees)) return 'ORDER_TOTAL_MISMATCH';
  if (args.remoteAmount !== args.paymentAmount) return 'AMOUNT_MISMATCH';
  return null;
}

// ---------------------------------------------------------------------------
// Decisions for gateway events
// ---------------------------------------------------------------------------

export type CaptureDecision =
  | { kind: 'ALREADY_PROCESSED' }
  | { kind: 'MARK_PAID' }
  /** Money received for a payable order but another attempt already paid it. */
  | { kind: 'PAID_THEN_REFUND'; refundReason: 'DUPLICATE_PAYMENT' | 'LATE_PAYMENT' }
  /** Captured amount is wrong: never fulfil, give the money back. */
  | { kind: 'MISMATCH_REFUND'; problem: AmountProblem }
  /** Row already holds a different gateway payment id: needs a human. */
  | { kind: 'CONFLICTING_PAYMENT_ID' };

export function decideCapture(args: {
  payment: PaymentRecord;
  order: OrderPaymentView;
  remote: Pick<RemotePayment, 'id' | 'amount' | 'currency'>;
  otherPaidPaymentExists: boolean;
}): CaptureDecision {
  const { payment, order, remote } = args;

  const sameId = payment.providerPaymentId === remote.id;
  if (['PAID', 'REFUNDED', 'MISMATCH'].includes(payment.status)) {
    return sameId ? { kind: 'ALREADY_PROCESSED' } : { kind: 'CONFLICTING_PAYMENT_ID' };
  }
  if (payment.providerPaymentId && !sameId && payment.status !== 'FAILED' && payment.status !== 'CANCELLED') {
    return { kind: 'CONFLICTING_PAYMENT_ID' };
  }

  const problem = checkPaymentAmount({
    paymentAmount: payment.amount,
    paymentCurrency: payment.currency,
    orderTotalRupees: order.total,
    remoteAmount: remote.amount,
    remoteCurrency: remote.currency,
  });
  if (problem) return { kind: 'MISMATCH_REFUND', problem };

  if (args.otherPaidPaymentExists) return { kind: 'PAID_THEN_REFUND', refundReason: 'DUPLICATE_PAYMENT' };
  if (order.status !== 'PENDING_PAYMENT' && order.status !== 'PROCESSING') {
    // CANCELLED (expired reservation / customer cancel) or already moving
    // through fulfilment on some other basis: don't resurrect, refund.
    if (order.paymentStatus === 'PAID') return { kind: 'MARK_PAID' }; // heals a half-applied older write
    return { kind: 'PAID_THEN_REFUND', refundReason: 'LATE_PAYMENT' };
  }
  return { kind: 'MARK_PAID' };
}

export type AuthorizedDecision =
  | { kind: 'IGNORE'; why: 'ALREADY_PAID' | 'ORDER_NOT_PAYABLE' | 'ALREADY_AUTHORIZED' }
  | { kind: 'REJECT'; problem: AmountProblem }
  | { kind: 'CAPTURE' };

/**
 * An authorized-but-uncaptured payment is NOT money received. We only ask
 * the gateway to capture it when amount and order are right; otherwise it is
 * left alone and Razorpay releases the hold automatically.
 */
export function decideAuthorized(args: {
  payment: PaymentRecord;
  order: OrderPaymentView;
  remote: Pick<RemotePayment, 'id' | 'amount' | 'currency'>;
}): AuthorizedDecision {
  const { payment, order, remote } = args;
  if (['PAID', 'REFUNDED', 'MISMATCH'].includes(payment.status)) return { kind: 'IGNORE', why: 'ALREADY_PAID' };
  const problem = checkPaymentAmount({
    paymentAmount: payment.amount,
    paymentCurrency: payment.currency,
    orderTotalRupees: order.total,
    remoteAmount: remote.amount,
    remoteCurrency: remote.currency,
  });
  if (problem) return { kind: 'REJECT', problem };
  if (order.status !== 'PENDING_PAYMENT' && order.status !== 'PROCESSING') return { kind: 'IGNORE', why: 'ORDER_NOT_PAYABLE' };
  return { kind: 'CAPTURE' };
}

export type FailureDecision =
  | { kind: 'IGNORE'; why: 'ALREADY_SUCCEEDED' | 'ALREADY_FAILED' }
  | { kind: 'MARK_FAILED'; cancelOrder: boolean; recordOnOrder: boolean };

export function decideFailure(args: {
  payment: PaymentRecord;
  order: OrderPaymentView;
  /** failed attempts for this order, INCLUDING this one once recorded */
  failedAttemptsAfter: number;
}): FailureDecision {
  const { payment, order } = args;
  if (['PAID', 'REFUNDED', 'MISMATCH'].includes(payment.status)) return { kind: 'IGNORE', why: 'ALREADY_SUCCEEDED' };
  if (payment.status === 'FAILED') return { kind: 'IGNORE', why: 'ALREADY_FAILED' };
  const payable = order.status === 'PENDING_PAYMENT';
  return {
    kind: 'MARK_FAILED',
    recordOnOrder: payable,
    cancelOrder: payable && args.failedAttemptsAfter >= MAX_PAYMENT_ATTEMPTS,
  };
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export type RefundPlanError =
  | 'NOT_REFUNDABLE' | 'NOTHING_TO_REFUND' | 'INVALID_AMOUNT' | 'EXCEEDS_REFUNDABLE';

export type RefundPlan = { ok: true; amount: number } | { ok: false; error: RefundPlanError; refundable: number };

export function refundableAmount(p: Pick<PaymentRecord, 'status' | 'capturedAmount' | 'refundedAmount'>): number {
  if (p.status !== 'PAID' && p.status !== 'MISMATCH') return 0;
  return Math.max(0, p.capturedAmount - p.refundedAmount);
}

/** `requested` in paise; null/undefined means "everything still refundable". */
export function planRefund(
  payment: Pick<PaymentRecord, 'status' | 'capturedAmount' | 'refundedAmount'>,
  requested?: number | null,
): RefundPlan {
  const refundable = refundableAmount(payment);
  if (payment.status !== 'PAID' && payment.status !== 'MISMATCH') return { ok: false, error: 'NOT_REFUNDABLE', refundable: 0 };
  if (refundable <= 0) return { ok: false, error: 'NOTHING_TO_REFUND', refundable };
  if (requested === null || requested === undefined) return { ok: true, amount: refundable };
  if (!Number.isInteger(requested) || requested <= 0) return { ok: false, error: 'INVALID_AMOUNT', refundable };
  if (requested > refundable) return { ok: false, error: 'EXCEEDS_REFUNDABLE', refundable };
  return { ok: true, amount: requested };
}

export function mapRefundStatus(gatewayStatus: string): RefundStatus {
  const s = gatewayStatus.toLowerCase();
  if (s === 'processed') return 'PROCESSED';
  if (s === 'failed') return 'FAILED';
  return 'PENDING';
}

/** Refund rows never leave PROCESSED; FAILED may be superseded by a late PROCESSED. */
export function nextRefundStatus(current: RefundStatus, reported: RefundStatus): RefundStatus {
  if (current === 'PROCESSED') return 'PROCESSED';
  return reported;
}

/** Statuses that reserve refund capacity on the payment. */
export function countsTowardRefunded(status: RefundStatus): boolean {
  return status === 'PENDING' || status === 'PROCESSED';
}

export function refundReceipt(refundId: number): string {
  return `rf_${refundId}`;
}

/** Deterministic key so "cancel order N" can never create two refunds. */
export function systemRefundKey(kind: string, orderId: number, paymentId: number): string {
  return `sys:${kind}:o${orderId}:p${paymentId}`;
}

export function isRetryableGatewayStatus(httpStatus: number | null): boolean {
  if (httpStatus === null) return true; // network failure / timeout
  return httpStatus === 408 || httpStatus === 409 || httpStatus === 425 || httpStatus === 429 || httpStatus >= 500;
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export type ReconKind =
  | 'MATCHED'
  | 'GATEWAY_CAPTURED_LOCAL_NOT_PAID'
  | 'GATEWAY_FAILED_LOCAL_OPEN'
  | 'GATEWAY_AUTHORIZED_LOCAL_OPEN'
  | 'LOCAL_PAID_GATEWAY_NOT_CAPTURED'
  | 'PAID_AMOUNT_DIFFERS'
  | 'REFUNDED_AMOUNT_DIFFERS'
  | 'UNKNOWN_TO_LOCAL'
  | 'LOCAL_PAID_MISSING_AT_GATEWAY';

export type ReconAction = 'NONE' | 'HEAL' | 'REVIEW' | 'INFO';

export interface ReconVerdict { kind: ReconKind; action: ReconAction }

/**
 * Compare one gateway payment with our row for the same Razorpay order.
 * HEAL verdicts are safe to apply automatically through the normal event
 * path (which itself re-checks amounts); REVIEW verdicts are reported only.
 * `localProcessedRefunds` = sum of our PROCESSED refunds for this payment.
 */
export function classifyPayment(
  local: PaymentRecord | null,
  remote: RemotePayment,
  localProcessedRefunds = 0,
): ReconVerdict {
  if (!local) return { kind: 'UNKNOWN_TO_LOCAL', action: 'INFO' };
  const rs = remote.status;

  if (rs === 'refunded' && !['PAID', 'REFUNDED', 'MISMATCH'].includes(local.status)) {
    // Refunded outside our flow before we ever recorded the capture: never fulfil automatically.
    return { kind: 'GATEWAY_CAPTURED_LOCAL_NOT_PAID', action: 'REVIEW' };
  }
  if (rs === 'captured' || rs === 'refunded') {
    if (local.status === 'PAID' || local.status === 'REFUNDED' || local.status === 'MISMATCH') {
      if (local.status === 'PAID' && remote.amount !== local.capturedAmount) return { kind: 'PAID_AMOUNT_DIFFERS', action: 'REVIEW' };
      if ((remote.amount_refunded ?? 0) !== localProcessedRefunds) return { kind: 'REFUNDED_AMOUNT_DIFFERS', action: 'REVIEW' };
      return { kind: 'MATCHED', action: 'NONE' };
    }
    return { kind: 'GATEWAY_CAPTURED_LOCAL_NOT_PAID', action: 'HEAL' };
  }
  if (rs === 'authorized') {
    if (local.status === 'PAID') return { kind: 'LOCAL_PAID_GATEWAY_NOT_CAPTURED', action: 'REVIEW' };
    if (local.status === 'AUTHORIZED') return { kind: 'MATCHED', action: 'NONE' };
    return { kind: 'GATEWAY_AUTHORIZED_LOCAL_OPEN', action: 'HEAL' };
  }
  if (rs === 'failed') {
    if (local.status === 'PAID') return { kind: 'LOCAL_PAID_GATEWAY_NOT_CAPTURED', action: 'REVIEW' };
    if (OPEN_PAYMENT_STATUSES.includes(local.status)) return { kind: 'GATEWAY_FAILED_LOCAL_OPEN', action: 'HEAL' };
    return { kind: 'MATCHED', action: 'NONE' };
  }
  // 'created' and anything unknown
  if (local.status === 'PAID') return { kind: 'LOCAL_PAID_GATEWAY_NOT_CAPTURED', action: 'REVIEW' };
  return { kind: 'MATCHED', action: 'NONE' };
}
