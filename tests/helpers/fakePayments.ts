/**
 * In-memory PaymentsStore + fake Razorpay gateway for tests.
 *
 * The store mimics the semantics the real (drizzle) store provides:
 *  - transaction() is serialised (a mutex stands in for row locks) and rolls
 *    back every write if the callback throws;
 *  - unique keys (refund idempotency key, (order, attempt_no), webhook
 *    event id) behave like the unique indexes in migration 0005;
 *  - refund capacity is bounded by captured_amount exactly like the CHECK.
 */
import crypto from 'node:crypto';
import {
  MAX_REFUND_ATTEMPTS, WEBHOOK_LOCK_SECONDS, planRefund, countsTowardRefunded,
} from '../../src/lib/paymentRules.ts';
import type {
  OrderPaymentView, PaymentRecord, RemotePayment, RemoteRefund,
} from '../../src/lib/paymentRules.ts';
import { RefundError } from '../../src/server/modules/payments/ports.ts';
import type {
  Locked, NewRefund, PaymentGateway, PaymentPatch, PaymentsStore, PaymentUow, ReconItemInput,
  ReconRunInput, RefundRecord, WebhookClaim,
} from '../../src/server/modules/payments/ports.ts';

export const TEST_ENV = {
  RAZORPAY_KEY_ID: 'rzp_test_key',
  RAZORPAY_KEY_SECRET: 'test_key_secret',
  RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
};
Object.assign(process.env, TEST_ENV);

export const hmac = (secret: string, body: string) => crypto.createHmac('sha256', secret).update(body).digest('hex');
export const checkoutSignature = (orderId: string, paymentId: string) => hmac(TEST_ENV.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
export const webhookSignature = (rawBody: string) => hmac(TEST_ENV.RAZORPAY_WEBHOOK_SECRET, rawBody);

export class Clock {
  constructor(public t = Date.parse('2026-10-20T10:00:00Z')) {}
  now = () => new Date(this.t);
  advance(ms: number) { this.t += ms; }
}

interface State {
  orders: Map<number, OrderPaymentView & { restocked?: boolean }>;
  payments: PaymentRecord[];
  refunds: RefundRecord[];
  events: Map<string, { status: 'PROCESSING' | 'PROCESSED' | 'FAILED'; lockedAt: number; outcome?: string; type: string }>;
  timeline: { orderId: number; title: string; description: string }[];
  runs: { id: number; items: ReconItemInput[]; summary?: unknown; error?: string | null }[];
  seq: { payment: number; refund: number; run: number };
  counters: { stockReleases: number; ordersPaid: number };
}

const clone = <T>(v: T): T => structuredClone(v);

export class FakeStore implements PaymentsStore {
  state: State = {
    orders: new Map(), payments: [], refunds: [], events: new Map(), timeline: [], runs: [],
    seq: { payment: 0, refund: 0, run: 0 }, counters: { stockReleases: 0, ordersPaid: 0 },
  };
  private lock: Promise<unknown> = Promise.resolve();
  /** Set to make claimAttempt behave as if a concurrent request took the slot. */
  raceOnClaim = false;

  constructor(public clock = new Clock()) {}

  // ---- fixtures -------------------------------------------------------
  addOrder(o: Partial<OrderPaymentView> & { id: number; total: number }): OrderPaymentView {
    const order: OrderPaymentView = {
      userId: 1, orderNumber: `ORD-${o.id}`, status: 'PENDING_PAYMENT', paymentStatus: 'CREATED', paymentMethod: 'UPI',
      paymentReservationExpiresAt: new Date(this.clock.t + 15 * 60_000), ...o,
    };
    this.state.orders.set(order.id, order);
    return order;
  }
  order(id: number) { return this.state.orders.get(id)!; }
  payment(id: number) { return this.state.payments.find((p) => p.id === id)!; }
  paymentsFor(orderId: number) { return this.state.payments.filter((p) => p.orderId === orderId); }
  refundsFor(orderId: number) { return this.state.refunds.filter((r) => r.orderId === orderId); }
  timelineFor(orderId: number) { return this.state.timeline.filter((t) => t.orderId === orderId).map((t) => t.title); }

  // ---- transaction ----------------------------------------------------
  async transaction<T>(fn: (uow: PaymentUow) => Promise<T>): Promise<T> {
    const prev = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((r) => { release = r; });
    await prev;
    const snapshot = clone({ ...this.state, orders: [...this.state.orders], events: [...this.state.events] });
    try {
      return await fn(this.uow());
    } catch (err) {
      this.state.orders = new Map(snapshot.orders);
      this.state.payments = snapshot.payments; this.state.refunds = snapshot.refunds;
      this.state.timeline = snapshot.timeline; this.state.runs = snapshot.runs;
      this.state.seq = snapshot.seq; this.state.counters = snapshot.counters;
      // webhook ledger rows are written outside transactions, keep them
      throw err;
    } finally {
      release();
    }
  }

  private recomputeReserved(paymentId: number) {
    const p = this.payment(paymentId);
    p.refundedAmount = this.state.refunds.filter((r) => r.paymentId === paymentId && countsTowardRefunded(r.status)).reduce((a, r) => a + r.amount, 0);
    if (p.refundedAmount > p.capturedAmount) throw new Error('CHECK payments_refund_bounds_check violated');
  }

  private lockPair(p?: PaymentRecord): Locked | null {
    if (!p) return null;
    return { payment: clone(p), order: clone(this.state.orders.get(p.orderId)!) };
  }

  private uow(): PaymentUow {
    const s = this.state;
    const self = this;
    return {
      async lockByProviderOrderId(id) { return self.lockPair(s.payments.find((p) => p.providerOrderId === id)); },
      async lockByPaymentId(id) { return self.lockPair(s.payments.find((p) => p.id === id)); },
      async lockByProviderPaymentId(id) { return self.lockPair(s.payments.find((p) => p.providerPaymentId === id)); },
      async updatePayment(id, patch: PaymentPatch) {
        const p = s.payments.find((x) => x.id === id)!;
        Object.assign(p, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
        if (patch.providerPaymentId) {
          const dup = s.payments.find((x) => x.id !== id && x.providerPaymentId === patch.providerPaymentId);
          if (dup) throw new Error('unique violation payments_provider_payment_id_idx');
        }
        return clone(p);
      },
      async markOrderPaid(orderId) {
        const o = s.orders.get(orderId)!;
        if (o.paymentStatus === 'PAID') return { alreadyProcessed: true };
        o.status = 'CONFIRMED'; o.paymentStatus = 'PAID'; o.paymentReservationExpiresAt = null;
        s.counters.ordersPaid++;
        s.timeline.push({ orderId, title: 'Payment Confirmed', description: '' });
        return { alreadyProcessed: false };
      },
      async recordOrderAttemptFailed(orderId, reason) {
        const o = s.orders.get(orderId)!;
        if (o.status !== 'PENDING_PAYMENT' || o.paymentStatus === 'PAID') return;
        o.paymentStatus = 'FAILED';
        s.timeline.push({ orderId, title: 'Payment Attempt Failed', description: reason });
      },
      async cancelUnpaidOrder(orderId, reason) {
        const o = s.orders.get(orderId)!;
        if (o.status === 'CANCELLED' || o.paymentStatus === 'PAID') return;
        o.status = 'CANCELLED'; o.paymentStatus = 'FAILED'; o.paymentReservationExpiresAt = null;
        s.counters.stockReleases++;
        for (const p of s.payments.filter((x) => x.orderId === orderId && ['CREATED', 'PENDING', 'AUTHORIZED'].includes(x.status))) p.status = 'CANCELLED';
        s.timeline.push({ orderId, title: 'Payment Failed', description: reason });
      },
      async setOrderPaymentStatus(orderId, status) { s.orders.get(orderId)!.paymentStatus = status; },
      async addOrderTimeline(orderId, title, description) { s.timeline.push({ orderId, title, description }); },
      async countFailedAttempts(orderId) {
        return s.payments.filter((p) => p.orderId === orderId && ['FAILED', 'CANCELLED', 'MISMATCH'].includes(p.status) && p.failureCode !== 'GATEWAY_CREATE_FAILED').length;
      },
      async hasOtherPaidPayment(orderId, except) {
        return s.payments.some((p) => p.orderId === orderId && p.id !== except && p.status === 'PAID');
      },
      async insertRefund(input: NewRefund) {
        const existing = s.refunds.find((r) => r.idempotencyKey === input.idempotencyKey);
        if (existing) {
          if (existing.paymentId !== input.paymentId || (input.amount !== null && input.amount !== existing.amount)) {
            throw new RefundError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used for a different refund');
          }
          return { refund: clone(existing), created: false };
        }
        const p = s.payments.find((x) => x.id === input.paymentId);
        if (!p) throw new RefundError('PAYMENT_NOT_FOUND', 'Payment not found');
        let amount = input.amount as number;
        if (input.source !== 'GATEWAY') {
          const plan = planRefund(p, input.amount);
          if (!plan.ok) throw new RefundError(plan.error, `Refund not allowed: ${plan.error}`, plan.refundable);
          amount = plan.amount;
        }
        const refund: RefundRecord = {
          id: ++s.seq.refund, paymentId: p.id, orderId: p.orderId, providerPaymentId: p.providerPaymentId,
          providerRefundId: input.providerRefundId ?? null, amount, currency: p.currency, status: input.status ?? 'PENDING',
          reason: input.reason, note: input.note ?? null, source: input.source, idempotencyKey: input.idempotencyKey,
          attempts: 0, lastAttemptAt: null, failureReason: null, initiatedBy: input.initiatedBy ?? null,
          createdAt: self.clock.now(), processedAt: null,
        };
        s.refunds.push(refund);
        self.recomputeReserved(p.id);
        return { refund: clone(refund), created: true };
      },
      async findRefundByGatewayRef({ providerRefundId, receiptId }) {
        const r = s.refunds.find((x) => x.providerRefundId === providerRefundId) ?? (receiptId ? s.refunds.find((x) => x.id === receiptId) : undefined);
        return r ? clone(r) : null;
      },
      async lockRefund(id) { const r = s.refunds.find((x) => x.id === id); return r ? clone(r) : null; },
      async updateRefund(id, patch) {
        const r = s.refunds.find((x) => x.id === id)!;
        Object.assign(r, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
        self.recomputeReserved(r.paymentId);
        return clone(r);
      },
      async finalizeFullRefund(paymentId) {
        const p = s.payments.find((x) => x.id === paymentId)!;
        const processed = s.refunds.filter((r) => r.paymentId === paymentId && r.status === 'PROCESSED').reduce((a, r) => a + r.amount, 0);
        if (p.capturedAmount <= 0 || processed < p.capturedAmount || !['PAID', 'MISMATCH'].includes(p.status)) return false;
        p.status = 'REFUNDED';
        if (!s.payments.some((x) => x.orderId === p.orderId && x.id !== p.id && x.status === 'PAID')) s.orders.get(p.orderId)!.paymentStatus = 'REFUNDED';
        return true;
      },
    };
  }

  // ---- webhook ledger -------------------------------------------------
  async claimWebhookEvent(e: { eventId: string; eventType: string }): Promise<WebhookClaim> {
    const cur = this.state.events.get(e.eventId);
    if (!cur) { this.state.events.set(e.eventId, { status: 'PROCESSING', lockedAt: this.clock.t, type: e.eventType }); return 'CLAIMED'; }
    if (cur.status === 'PROCESSED') return 'DUPLICATE_PROCESSED';
    const stale = this.clock.t - cur.lockedAt > WEBHOOK_LOCK_SECONDS * 1000;
    if (cur.status === 'FAILED' || stale) { cur.status = 'PROCESSING'; cur.lockedAt = this.clock.t; return 'CLAIMED'; }
    return 'DUPLICATE_IN_FLIGHT';
  }
  async finishWebhookEvent(id: string, outcome: string) { const e = this.state.events.get(id)!; e.status = 'PROCESSED'; e.outcome = outcome; }
  async failWebhookEvent(id: string) { this.state.events.get(id)!.status = 'FAILED'; }

  // ---- attempts -------------------------------------------------------
  async getOrderForUser(userId: number, orderId: number) { const o = this.state.orders.get(orderId); return o && o.userId === userId ? clone(o) : null; }
  async getOrder(orderId: number) { const o = this.state.orders.get(orderId); return o ? clone(o) : null; }
  async listAttempts(orderId: number) { return clone(this.paymentsFor(orderId)); }
  async claimAttempt(a: { orderId: number; userId: number; amount: number; attemptNo: number; idempotencyKey: string }) {
    if (this.raceOnClaim || this.state.payments.some((p) => p.orderId === a.orderId && p.attemptNo === a.attemptNo)) return null;
    const p: PaymentRecord = {
      id: ++this.state.seq.payment, orderId: a.orderId, userId: a.userId, providerOrderId: null, providerPaymentId: null,
      amount: a.amount, capturedAmount: 0, refundedAmount: 0, currency: 'INR', status: 'CREATED', method: null,
      failureCode: null, failureReason: null, attemptNo: a.attemptNo, idempotencyKey: a.idempotencyKey, createdAt: this.clock.now(),
    };
    this.state.payments.push(p);
    return clone(p);
  }
  async attachProviderOrder(id: number, providerOrderId: string) { const p = this.payment(id); p.providerOrderId = providerOrderId; return clone(p); }
  async failAttempt(id: number, code: string, reason: string) { Object.assign(this.payment(id), { status: 'FAILED', failureCode: code, failureReason: reason }); }
  async cancelAttempt(id: number, reason: string) { Object.assign(this.payment(id), { status: 'CANCELLED', failureReason: reason }); }
  async setOrderPaymentStatusIfPayable(orderId: number, status: string) {
    const o = this.state.orders.get(orderId)!;
    if (o.status === 'PENDING_PAYMENT' && o.paymentStatus !== 'PAID') o.paymentStatus = status;
  }

  // ---- refunds --------------------------------------------------------
  async getRefund(id: number) { const r = this.state.refunds.find((x) => x.id === id); return r ? clone(r) : null; }
  async findRefundByGatewayRef({ providerRefundId, receiptId }: { providerRefundId: string; receiptId: number | null }) {
    const r = this.state.refunds.find((x) => x.providerRefundId === providerRefundId) ?? (receiptId ? this.state.refunds.find((x) => x.id === receiptId) : undefined);
    return r ? clone(r) : null;
  }
  async listRefundsForOrder(orderId: number) { return clone(this.refundsFor(orderId)); }
  async leaseRefund(id: number, leaseSeconds: number, maxAttempts: number) {
    const r = this.state.refunds.find((x) => x.id === id);
    if (!r || r.status !== 'PENDING' || r.attempts >= maxAttempts) return null;
    if (r.lastAttemptAt && this.clock.t - r.lastAttemptAt.getTime() < leaseSeconds * 1000) return null;
    r.attempts++; r.lastAttemptAt = this.clock.now();
    return clone(r);
  }
  async listDueRefundIds(limit: number, leaseSeconds: number) {
    return this.state.refunds
      .filter((r) => r.status === 'PENDING' && r.attempts < MAX_REFUND_ATTEMPTS && (!r.lastAttemptAt || this.clock.t - r.lastAttemptAt.getTime() >= leaseSeconds * 1000))
      .slice(0, limit).map((r) => r.id);
  }
  async sumProcessedRefunds(paymentId: number) {
    return this.state.refunds.filter((r) => r.paymentId === paymentId && r.status === 'PROCESSED').reduce((a, r) => a + r.amount, 0);
  }

  // ---- reconciliation -------------------------------------------------
  async findPaymentByProviderOrderId(id: string) { const p = this.state.payments.find((x) => x.providerOrderId === id); return p ? clone(p) : null; }
  async listPaymentsInWindow(from: Date, to: Date) {
    return clone(this.state.payments.filter((p) => p.createdAt >= from && p.createdAt <= to));
  }
  async listStaleOpenAttemptOrderIds() { return []; }
  async listExpiredPendingOrderIds() {
    return [...this.state.orders.values()].filter((o) => o.status === 'PENDING_PAYMENT' && o.paymentReservationExpiresAt && o.paymentReservationExpiresAt.getTime() < this.clock.t).map((o) => o.id);
  }
  async listProviderOrderIdsForOrder(orderId: number) { return this.paymentsFor(orderId).map((p) => p.providerOrderId).filter((x): x is string => !!x); }
  async createReconRun(_r: ReconRunInput) { const id = ++this.state.seq.run; this.state.runs.push({ id, items: [] }); return id; }
  async addReconItem(runId: number, item: ReconItemInput) { this.state.runs.find((r) => r.id === runId)!.items.push(item); }
  async finishReconRun(runId: number, s: object & { error?: string | null }) { const r = this.state.runs.find((x) => x.id === runId)!; r.summary = s; r.error = s.error ?? null; }
}

// ===========================================================================
// Fake Razorpay
// ===========================================================================

export class GatewayError extends Error {
  constructor(message: string, public status: number | null, public code?: string) { super(message); }
}

export class FakeGateway implements PaymentGateway {
  orders = new Map<string, { id: string; amount: number; currency: string; status: string; receipt: string | null }>();
  payments = new Map<string, RemotePayment & { created_at: number }>();
  refunds = new Map<string, RemoteRefund & { created_at: number; idemKey?: string }>();
  calls: string[] = [];
  private n = 0;
  failNext: { op: string; status: number | null; times: number } | null = null;

  constructor(private clock: Clock) {}

  private maybeFail(op: string) {
    this.calls.push(op);
    if (this.failNext && this.failNext.op === op && this.failNext.times > 0) {
      this.failNext.times--;
      throw new GatewayError(`injected ${op} failure`, this.failNext.status, 'BAD_REQUEST_ERROR');
    }
  }

  async createOrder(p: { amountInPaise: number; currency?: string; receipt: string }) {
    this.maybeFail('createOrder');
    const o = { id: `order_${++this.n}`, amount: p.amountInPaise, currency: p.currency ?? 'INR', status: 'created', receipt: p.receipt };
    this.orders.set(o.id, o);
    return o;
  }
  async fetchPayment(id: string) {
    this.maybeFail('fetchPayment');
    const p = this.payments.get(id);
    if (!p) throw new GatewayError('not found', 404);
    return { ...p };
  }
  async capturePayment(id: string, amount: number, currency: string) {
    this.maybeFail('capturePayment');
    const p = this.payments.get(id);
    if (!p) throw new GatewayError('not found', 404);
    if (p.status === 'captured') throw new GatewayError('already captured', 400, 'BAD_REQUEST_ERROR');
    if (p.amount !== amount || p.currency !== currency) throw new GatewayError('capture amount mismatch', 400, 'BAD_REQUEST_ERROR');
    p.status = 'captured';
    return { ...p };
  }
  async createRefund(paymentId: string, a: { amount: number; receipt: string; idempotencyKey: string }) {
    this.maybeFail('createRefund');
    const prior = [...this.refunds.values()].find((r) => r.idemKey === a.idempotencyKey);
    if (prior) return { ...prior };
    const p = this.payments.get(paymentId);
    if (!p || p.status === 'failed') throw new GatewayError('payment not captured', 400, 'BAD_REQUEST_ERROR');
    const already = [...this.refunds.values()].filter((r) => r.payment_id === paymentId && r.status !== 'failed').reduce((s, r) => s + r.amount, 0);
    if (a.amount + already > p.amount) throw new GatewayError('refund amount exceeds the captured amount', 400, 'BAD_REQUEST_ERROR');
    const r = { id: `rfnd_${++this.n}`, payment_id: paymentId, amount: a.amount, currency: p.currency, status: 'processed', receipt: a.receipt, created_at: Math.floor(this.clock.t / 1000), idemKey: a.idempotencyKey };
    this.refunds.set(r.id, r);
    p.amount_refunded = already + a.amount;
    if (p.amount_refunded === p.amount) p.status = 'refunded';
    return { ...r };
  }
  async fetchRefund(id: string) { this.maybeFail('fetchRefund'); const r = this.refunds.get(id); if (!r) throw new GatewayError('not found', 404); return { ...r }; }
  async listPayments(a: { from: number; to: number; count: number; skip: number }) {
    const items = [...this.payments.values()].filter((p) => p.created_at >= a.from && p.created_at <= a.to).slice(a.skip, a.skip + a.count);
    return { items: items.map((p) => ({ ...p })), count: items.length };
  }
  async listRefunds(a: { from: number; to: number; count: number; skip: number }) {
    const items = [...this.refunds.values()].filter((r) => r.created_at >= a.from && r.created_at <= a.to).slice(a.skip, a.skip + a.count);
    return { items: items.map((r) => ({ ...r })), count: items.length };
  }
  async listOrderPayments(orderId: string) {
    const items = [...this.payments.values()].filter((p) => p.order_id === orderId);
    return { items: items.map((p) => ({ ...p })), count: items.length };
  }

  // ---- test controls --------------------------------------------------
  /** The customer pays (or fails to pay) against a Razorpay order. */
  pay(orderId: string, opts: { status?: string; amount?: number; currency?: string; error?: string } = {}): RemotePayment {
    const order = this.orders.get(orderId)!;
    const p = {
      id: `pay_${++this.n}`, order_id: orderId, amount: opts.amount ?? order.amount, currency: opts.currency ?? order.currency,
      status: opts.status ?? 'captured', method: 'upi', amount_refunded: 0, created_at: Math.floor(this.clock.t / 1000),
      ...(opts.status === 'failed' ? { error_code: 'BAD_REQUEST_ERROR', error_description: opts.error ?? 'Payment failed' } : {}),
    };
    this.payments.set(p.id, p);
    if (p.status === 'captured') order.status = 'paid';
    return { ...p };
  }
}

/** A signed webhook exactly as Razorpay would deliver it. */
export function signedWebhook(event: string, entity: object, kind: 'payment' | 'refund' = 'payment', eventId = `evt_${crypto.randomUUID()}`) {
  const rawBody = JSON.stringify({ entity: 'event', event, payload: { [kind]: { entity } } });
  return { rawBody, signature: webhookSignature(rawBody), eventId };
}
