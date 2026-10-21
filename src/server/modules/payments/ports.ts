/**
 * Ports (interfaces) the payment engine depends on. Keeping the engine free
 * of drizzle/fetch means every money rule can be exercised in tests with an
 * in-memory store and a fake gateway (see tests/helpers/fakePayments.ts),
 * while production wires in drizzleStore.ts and the real Razorpay client.
 */
import type {
  OrderPaymentView, PaymentRecord, PaymentStatus, RefundReason, RefundStatus,
  RemotePayment, RemoteRefund,
} from '@/src/lib/paymentRules';

export interface PaymentGateway {
  createOrder(p: { amountInPaise: number; currency?: string; receipt: string; notes?: Record<string, string> }):
    Promise<{ id: string; amount: number; currency: string; status: string; receipt: string | null }>;
  fetchPayment(paymentId: string): Promise<RemotePayment>;
  capturePayment(paymentId: string, amount: number, currency: string): Promise<RemotePayment>;
  createRefund(paymentId: string, args: { amount: number; receipt: string; idempotencyKey: string; notes?: Record<string, string> }): Promise<RemoteRefund>;
  fetchRefund(refundId: string): Promise<RemoteRefund>;
  listPayments(args: { from: number; to: number; count: number; skip: number }): Promise<{ items: RemotePayment[]; count: number }>;
  listRefunds(args: { from: number; to: number; count: number; skip: number }): Promise<{ items: RemoteRefund[]; count: number }>;
  listOrderPayments(orderId: string): Promise<{ items: RemotePayment[]; count: number }>;
}

export interface RefundRecord {
  id: number;
  paymentId: number;
  orderId: number;
  providerPaymentId: string | null;
  providerRefundId: string | null;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason: RefundReason;
  note: string | null;
  source: 'SYSTEM' | 'ADMIN' | 'GATEWAY';
  idempotencyKey: string;
  attempts: number;
  lastAttemptAt: Date | null;
  failureReason: string | null;
  initiatedBy: number | null;
  createdAt: Date;
  processedAt: Date | null;
}

export interface NewRefund {
  paymentId: number;
  /** paise; null = everything still refundable */
  amount: number | null;
  reason: RefundReason;
  source: 'SYSTEM' | 'ADMIN' | 'GATEWAY';
  idempotencyKey: string;
  note?: string | null;
  initiatedBy?: number | null;
  /** Gateway-originated refunds already exist at Razorpay. */
  providerRefundId?: string | null;
  status?: RefundStatus;
}

export type RefundErrorCode =
  | 'NOT_REFUNDABLE' | 'NOTHING_TO_REFUND' | 'INVALID_AMOUNT' | 'EXCEEDS_REFUNDABLE'
  | 'IDEMPOTENCY_KEY_REUSED' | 'PAYMENT_NOT_FOUND';

export class RefundError extends Error {
  constructor(public readonly code: RefundErrorCode, message: string, public readonly refundable = 0) {
    super(message);
    this.name = 'RefundError';
  }
}

export interface PaymentPatch {
  status?: PaymentStatus;
  providerPaymentId?: string | null;
  providerSignature?: string | null;
  method?: string | null;
  capturedAmount?: number;
  capturedAt?: Date | null;
  failureCode?: string | null;
  failureReason?: string | null;
}

export interface Locked { payment: PaymentRecord; order: OrderPaymentView }

/**
 * One database transaction. Implementations MUST lock the ORDER row before
 * the PAYMENT row (every code path uses this order, so no deadlocks) and
 * must make all writes atomic with the surrounding `transaction()`.
 */
export interface PaymentUow {
  lockByProviderOrderId(providerOrderId: string): Promise<Locked | null>;
  lockByPaymentId(paymentId: number): Promise<Locked | null>;
  lockByProviderPaymentId(providerPaymentId: string): Promise<Locked | null>;
  updatePayment(paymentId: number, patch: PaymentPatch): Promise<PaymentRecord>;

  /** Order-side effects of money arriving / failing (confirm parcels, stock release, timeline). */
  markOrderPaid(orderId: number): Promise<{ alreadyProcessed: boolean }>;
  recordOrderAttemptFailed(orderId: number, reason: string): Promise<void>;
  cancelUnpaidOrder(orderId: number, reason: string): Promise<void>;
  setOrderPaymentStatus(orderId: number, status: string): Promise<void>;
  addOrderTimeline(orderId: number, title: string, description: string): Promise<void>;

  countFailedAttempts(orderId: number): Promise<number>;
  hasOtherPaidPayment(orderId: number, exceptPaymentId: number): Promise<boolean>;

  /** Idempotent on `idempotencyKey`. Reserves capacity on the payment. Throws RefundError. */
  insertRefund(input: NewRefund): Promise<{ refund: RefundRecord; created: boolean }>;
  findRefundByGatewayRef(args: { providerRefundId: string; receiptId: number | null }): Promise<RefundRecord | null>;
  lockRefund(refundId: number): Promise<RefundRecord | null>;
  updateRefund(refundId: number, patch: {
    providerRefundId?: string | null;
    status?: RefundStatus;
    failureReason?: string | null;
    processedAt?: Date | null;
  }): Promise<RefundRecord>;
  /** If PROCESSED refunds now cover the whole captured amount: payment -> REFUNDED, order -> REFUNDED. */
  finalizeFullRefund(paymentId: number): Promise<boolean>;
}

export type WebhookClaim = 'CLAIMED' | 'DUPLICATE_PROCESSED' | 'DUPLICATE_IN_FLIGHT';

export interface ReconRunInput { trigger: 'MANUAL' | 'SCHEDULED'; heal: boolean; from: Date; to: Date; triggeredBy?: number | null }
export interface ReconItemInput {
  kind: string;
  resolution: 'AUTO_HEALED' | 'NEEDS_REVIEW' | 'INFO';
  paymentId?: number | null;
  orderId?: number | null;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  providerRefundId?: string | null;
  localStatus?: string | null;
  remoteStatus?: string | null;
  localAmount?: number | null;
  remoteAmount?: number | null;
  details?: Record<string, unknown>;
}
export interface ReconRunSummary {
  id: number;
  gatewayPaymentsChecked: number;
  gatewayRefundsChecked: number;
  localPaymentsChecked: number;
  matched: number;
  autoHealed: number;
  needsReview: number;
}

export interface PaymentsStore {
  transaction<T>(fn: (uow: PaymentUow) => Promise<T>): Promise<T>;

  // --- webhook ledger -------------------------------------------------
  claimWebhookEvent(e: { eventId: string; eventType: string; payloadSha256: string }): Promise<WebhookClaim>;
  finishWebhookEvent(eventId: string, outcome: string): Promise<void>;
  failWebhookEvent(eventId: string, error: string): Promise<void>;

  // --- starting / retrying a payment ---------------------------------
  getOrderForUser(userId: number, orderId: number): Promise<OrderPaymentView | null>;
  getOrder(orderId: number): Promise<OrderPaymentView | null>;
  listAttempts(orderId: number): Promise<PaymentRecord[]>;
  /** Returns null when (order, attemptNo) is already taken by a concurrent request. */
  claimAttempt(a: { orderId: number; userId: number; amount: number; attemptNo: number; idempotencyKey: string }): Promise<PaymentRecord | null>;
  attachProviderOrder(paymentId: number, providerOrderId: string): Promise<PaymentRecord>;
  failAttempt(paymentId: number, code: string, reason: string): Promise<void>;
  cancelAttempt(paymentId: number, reason: string): Promise<void>;
  setOrderPaymentStatusIfPayable(orderId: number, status: string): Promise<void>;

  // --- refunds (outside a payment transaction) -----------------------
  getRefund(refundId: number): Promise<RefundRecord | null>;
  findRefundByGatewayRef(args: { providerRefundId: string; receiptId: number | null }): Promise<RefundRecord | null>;
  listRefundsForOrder(orderId: number): Promise<RefundRecord[]>;
  /** Marks a refund as being worked on now (attempts+1). Null if terminal, busy or exhausted. */
  leaseRefund(refundId: number, leaseSeconds: number, maxAttempts: number): Promise<RefundRecord | null>;
  listDueRefundIds(limit: number, leaseSeconds: number): Promise<number[]>;
  sumProcessedRefunds(paymentId: number): Promise<number>;

  // --- reconciliation / recovery -------------------------------------
  findPaymentByProviderOrderId(providerOrderId: string): Promise<PaymentRecord | null>;
  listPaymentsInWindow(from: Date, to: Date): Promise<PaymentRecord[]>;
  listStaleOpenAttemptOrderIds(olderThanSeconds: number): Promise<string[]>; // provider order ids
  listExpiredPendingOrderIds(): Promise<number[]>;
  listProviderOrderIdsForOrder(orderId: number): Promise<string[]>;
  createReconRun(r: ReconRunInput): Promise<number>;
  addReconItem(runId: number, item: ReconItemInput): Promise<void>;
  finishReconRun(runId: number, s: Omit<ReconRunSummary, 'id'> & { error?: string | null }): Promise<void>;
}

export interface PaymentHooks {
  /** Fired AFTER commit when an order was newly confirmed as paid. */
  onOrderPaid?(orderId: number): void | Promise<void>;
  /** Fired AFTER commit when a refund reaches a terminal state. */
  onRefundSettled?(refund: RefundRecord): void | Promise<void>;
  log?(level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>): void;
}
