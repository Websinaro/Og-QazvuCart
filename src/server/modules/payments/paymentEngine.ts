/**
 * Payment engine: the only place that turns "something happened at
 * Razorpay" into changes to our records.
 *
 * Invariants
 *  - The server decides. Order totals come from `orders.total`; the amount
 *    asked of Razorpay comes from that row; nothing money-related is read
 *    from the browser. Browser-supplied ids are only ever used to LOOK UP
 *    what Razorpay itself reports.
 *  - Every state change goes through applyRemotePayment / applyRemoteRefund,
 *    inside one DB transaction holding the order+payment row locks, and is
 *    guarded by the pure rules in paymentRules.ts. So webhooks, the browser
 *    verify call and the reconciler can arrive in any order, any number of
 *    times, concurrently, and converge on the same result.
 */
import crypto from 'node:crypto';
import { verifyCheckoutSignature, verifyWebhookSignature } from '@/src/lib/razorpay';
import {
  MAX_PAYMENT_ATTEMPTS, MAX_REFUND_ATTEMPTS, OPEN_PAYMENT_STATUSES, REFUND_LEASE_SECONDS,
  decideAuthorized, decideCapture, decideFailure, isRetryableGatewayStatus, mapRefundStatus,
  nextRefundStatus, refundReceipt, refundableAmount, rupeesToPaise, systemRefundKey,
} from '@/src/lib/paymentRules';
import type { RemotePayment, RemoteRefund, RefundReason } from '@/src/lib/paymentRules';
import { RefundError } from './ports';
import type { PaymentGateway, PaymentHooks, PaymentsStore, RefundRecord } from './ports';

export class PaymentError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus = 400) {
    super(message);
    this.name = 'PaymentError';
  }
}

export type PaymentOutcome =
  | 'PAID' | 'ALREADY_PROCESSED' | 'AUTHORIZED_PENDING_CAPTURE' | 'ATTEMPT_FAILED' | 'ORDER_CANCELLED_TOO_MANY_FAILURES'
  | 'AMOUNT_MISMATCH_REFUND_QUEUED' | 'LATE_PAYMENT_REFUND_QUEUED' | 'DUPLICATE_PAYMENT_REFUND_QUEUED'
  | 'AUTHORIZED_REJECTED' | 'CONFLICTING_PAYMENT_ID' | 'UNKNOWN_ORDER' | 'IGNORED';

export interface ApplyPaymentResult { outcome: PaymentOutcome; orderId?: number; paymentId?: number; newlyPaid: boolean }
export interface ApplyRefundResult { outcome: 'IMPORTED' | 'UPDATED' | 'UNCHANGED' | 'UNKNOWN_PAYMENT'; refundId?: number; settled: boolean }

export interface WebhookResult { eventType: string; duplicate: boolean; outcome: string }

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const rupees = (paise: number) => (paise / 100).toFixed(2);

export class PaymentEngine {
  constructor(
    private readonly store: PaymentsStore,
    private readonly gateway: PaymentGateway,
    private readonly hooks: PaymentHooks = {},
    private readonly now: () => Date = () => new Date(),
  ) {}

  private log(level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) {
    this.hooks.log?.(level, msg, meta);
  }

  // =====================================================================
  // 1. Start / retry a payment
  // =====================================================================

  /**
   * Returns the Razorpay order to open in Checkout for an order the user
   * owns. Safe to call repeatedly: an open attempt is reused, a failed one
   * is replaced by a fresh attempt (up to MAX_PAYMENT_ATTEMPTS failures),
   * and concurrent calls can never create two Razorpay orders for the same
   * attempt number.
   */
  async createPayment(userId: number, orderId: number) {
    const order = await this.store.getOrderForUser(userId, orderId);
    if (!order) throw new PaymentError('NOT_FOUND', 'Order not found', 404);
    if (order.paymentMethod === 'COD') throw new PaymentError('NOT_ONLINE', 'This order is Cash on Delivery and does not require online payment');
    if (order.paymentStatus === 'PAID') throw new PaymentError('ALREADY_PAID', 'This order has already been paid', 409);
    if (order.status === 'CANCELLED') throw new PaymentError('ORDER_CANCELLED', 'This order was cancelled and can no longer be paid for', 409);
    if (order.status !== 'PENDING_PAYMENT') throw new PaymentError('NOT_AWAITING_PAYMENT', 'This order is not awaiting payment', 409);
    if (order.paymentReservationExpiresAt && order.paymentReservationExpiresAt.getTime() <= this.now().getTime()) {
      throw new PaymentError('PAYMENT_WINDOW_EXPIRED', 'The payment window for this order has expired. Please place the order again.', 409);
    }

    const expected = rupeesToPaise(order.total); // server-side total, never client input
    if (expected < 100) throw new PaymentError('INVALID_AMOUNT', 'This order total cannot be paid online');

    const attempts = await this.store.listAttempts(orderId);
    const open = [...attempts].filter((a) => OPEN_PAYMENT_STATUSES.includes(a.status)).sort((a, b) => b.attemptNo - a.attemptNo)[0];
    if (open) {
      if (open.providerOrderId && open.amount === expected && open.currency === 'INR') {
        return { razorpayOrderId: open.providerOrderId, amount: open.amount, currency: open.currency, orderNumber: order.orderNumber, attemptNo: open.attemptNo, reused: true };
      }
      if (!open.providerOrderId) {
        if (this.now().getTime() - open.createdAt.getTime() < 60_000) {
          throw new PaymentError('PAYMENT_IN_PROGRESS', 'A payment is already being prepared for this order. Please try again in a moment.', 409);
        }
        await this.store.failAttempt(open.id, 'GATEWAY_CREATE_FAILED', 'Gateway order was never created');
      } else {
        await this.store.cancelAttempt(open.id, 'Order total changed since this attempt was created');
      }
    }

    const failedCount = attempts.filter((a) => ['FAILED', 'CANCELLED', 'MISMATCH'].includes(a.status) && a.failureCode !== 'GATEWAY_CREATE_FAILED').length;
    if (failedCount >= MAX_PAYMENT_ATTEMPTS) {
      throw new PaymentError('TOO_MANY_ATTEMPTS', 'Too many failed payment attempts for this order.', 409);
    }

    const attemptNo = attempts.reduce((m, a) => Math.max(m, a.attemptNo), 0) + 1;
    const row = await this.store.claimAttempt({
      orderId, userId, amount: expected, attemptNo, idempotencyKey: `order_${orderId}_attempt_${attemptNo}`,
    });
    if (!row) throw new PaymentError('PAYMENT_IN_PROGRESS', 'A payment is already being prepared for this order. Please try again in a moment.', 409);

    let rzp;
    try {
      rzp = await this.gateway.createOrder({
        amountInPaise: expected, currency: 'INR', receipt: order.orderNumber,
        notes: { internalOrderId: String(order.id), userId: String(userId), attempt: String(attemptNo) },
      });
      if (rzp.amount !== expected || rzp.currency !== 'INR') throw new Error('Gateway order amount does not match the requested amount');
    } catch (err) {
      await this.store.failAttempt(row.id, 'GATEWAY_CREATE_FAILED', err instanceof Error ? err.message.slice(0, 300) : 'gateway error');
      throw err;
    }
    await this.store.attachProviderOrder(row.id, rzp.id);
    await this.store.setOrderPaymentStatusIfPayable(orderId, 'PENDING');

    return { razorpayOrderId: rzp.id, amount: expected, currency: 'INR', orderNumber: order.orderNumber, attemptNo, reused: false };
  }

  /** What the browser may learn: server-authoritative status plus whether a retry is possible. */
  async getPaymentStatus(userId: number, orderId: number) {
    const order = await this.store.getOrderForUser(userId, orderId);
    if (!order) throw new PaymentError('NOT_FOUND', 'Order not found', 404);
    const attempts = await this.store.listAttempts(orderId);
    const failed = attempts.filter((a) => ['FAILED', 'CANCELLED', 'MISMATCH'].includes(a.status) && a.failureCode !== 'GATEWAY_CREATE_FAILED').length;
    const expired = !!order.paymentReservationExpiresAt && order.paymentReservationExpiresAt.getTime() <= this.now().getTime();
    const canRetry = order.paymentMethod !== 'COD' && order.status === 'PENDING_PAYMENT' && order.paymentStatus !== 'PAID' && !expired && failed < MAX_PAYMENT_ATTEMPTS;
    const latest = [...attempts].sort((a, b) => b.attemptNo - a.attemptNo)[0];
    const refunds = await this.store.listRefundsForOrder(orderId);
    return {
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      latestAttemptStatus: latest?.status ?? null,
      lastFailureReason: latest?.failureReason ?? null,
      canRetry,
      attemptsRemaining: Math.max(0, MAX_PAYMENT_ATTEMPTS - failed),
      paymentWindowEndsAt: order.paymentReservationExpiresAt,
      refunds: refunds.map((r) => ({ id: r.id, amount: r.amount / 100, status: r.status, reason: r.reason, createdAt: r.createdAt, processedAt: r.processedAt })),
    };
  }

  // =====================================================================
  // 2. Browser return path
  // =====================================================================

  /**
   * Called after Checkout's success callback. The signature is verified
   * FIRST and unconditionally (a forged signature must never get an
   * "already paid" answer, and never changes any state); then Razorpay is
   * asked what really happened and only that report is acted upon.
   */
  async verifyCheckout(userId: number, p: { orderId: number; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
    const order = await this.store.getOrderForUser(userId, p.orderId);
    if (!order) throw new PaymentError('NOT_FOUND', 'Order not found', 404);

    if (!verifyCheckoutSignature({ razorpayOrderId: p.razorpayOrderId, razorpayPaymentId: p.razorpayPaymentId, razorpaySignature: p.razorpaySignature })) {
      this.log('warn', 'checkout signature rejected', { orderId: order.id, userId });
      throw new PaymentError('INVALID_SIGNATURE', 'Payment signature verification failed');
    }

    const row = await this.store.findPaymentByProviderOrderId(p.razorpayOrderId);
    if (!row || row.orderId !== order.id) throw new PaymentError('PAYMENT_ORDER_MISMATCH', 'Payment record does not match this order');

    const remote = await this.gateway.fetchPayment(p.razorpayPaymentId);
    if (remote.order_id !== p.razorpayOrderId) throw new PaymentError('PAYMENT_ORDER_MISMATCH', 'Payment/order mismatch reported by Razorpay');

    const r = await this.applyRemotePayment(remote, 'verify');
    switch (r.outcome) {
      case 'PAID':
      case 'ALREADY_PROCESSED':
        return { alreadyProcessed: r.outcome === 'ALREADY_PROCESSED', status: 'PAID' as const };
      case 'AUTHORIZED_PENDING_CAPTURE':
        throw new PaymentError('PAYMENT_PENDING', 'Your payment is authorized and awaiting confirmation. Check your Orders page shortly.', 202);
      case 'AMOUNT_MISMATCH_REFUND_QUEUED':
        throw new PaymentError('AMOUNT_MISMATCH', 'The amount charged did not match the order total. The charge will be refunded automatically.', 409);
      case 'LATE_PAYMENT_REFUND_QUEUED':
        throw new PaymentError('ORDER_NOT_PAYABLE', 'This order is no longer awaiting payment. The charge will be refunded automatically.', 409);
      case 'DUPLICATE_PAYMENT_REFUND_QUEUED':
        throw new PaymentError('DUPLICATE_PAYMENT', 'This order was already paid. The duplicate charge will be refunded automatically.', 409);
      default:
        throw new PaymentError('PAYMENT_NOT_SUCCESSFUL', `Payment is not in a successful state (${remote.status})`);
    }
  }

  // =====================================================================
  // 3. Webhooks
  // =====================================================================

  async handleWebhook(rawBody: string, signatureHeader: string, eventIdHeader?: string | null): Promise<WebhookResult> {
    if (!signatureHeader || !verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new PaymentError('INVALID_SIGNATURE', 'Invalid webhook signature', 401);
    }
    let event: any;
    try { event = JSON.parse(rawBody); } catch { throw new PaymentError('BAD_PAYLOAD', 'Webhook body is not valid JSON', 400); }
    const eventType = String(event?.event ?? '');
    if (!eventType) throw new PaymentError('BAD_PAYLOAD', 'Webhook has no event type', 400);

    const payloadSha256 = sha256(rawBody);
    const eventId = (eventIdHeader && eventIdHeader.trim()) || `sha:${payloadSha256}`;

    const claim = await this.store.claimWebhookEvent({ eventId, eventType, payloadSha256 });
    if (claim !== 'CLAIMED') {
      this.log('info', 'duplicate webhook ignored', { eventId, eventType, claim });
      return { eventType, duplicate: true, outcome: claim };
    }

    try {
      const outcome = await this.dispatch(eventType, event);
      await this.store.finishWebhookEvent(eventId, outcome);
      return { eventType, duplicate: false, outcome };
    } catch (err) {
      // Leave the ledger row FAILED so Razorpay's retry of the same event is re-processed.
      await this.store.failWebhookEvent(eventId, err instanceof Error ? err.message.slice(0, 500) : 'error').catch(() => undefined);
      throw err;
    }
  }

  private async dispatch(eventType: string, event: any): Promise<string> {
    if (['payment.captured', 'payment.authorized', 'payment.failed', 'order.paid'].includes(eventType)) {
      const e = event?.payload?.payment?.entity;
      if (!e || typeof e.id !== 'string' || typeof e.amount !== 'number' || typeof e.currency !== 'string') {
        throw new PaymentError('BAD_PAYLOAD', 'Webhook payment entity is malformed', 400);
      }
      // Event type and entity status must agree, otherwise trust neither blindly.
      const expectedStatus: Record<string, string> = { 'payment.captured': 'captured', 'payment.authorized': 'authorized', 'payment.failed': 'failed', 'order.paid': 'captured' };
      const status = e.status === expectedStatus[eventType] ? e.status
        // A stale event may carry a newer entity snapshot (e.g. "authorized" event, entity already captured): honour the entity.
        : ['captured', 'authorized', 'failed'].includes(e.status) ? e.status : expectedStatus[eventType];
      const r = await this.applyRemotePayment({ ...e, status } as RemotePayment, 'webhook');
      return r.outcome;
    }
    if (['refund.created', 'refund.processed', 'refund.failed'].includes(eventType)) {
      const e = event?.payload?.refund?.entity;
      if (!e || typeof e.id !== 'string' || typeof e.payment_id !== 'string' || typeof e.amount !== 'number') {
        throw new PaymentError('BAD_PAYLOAD', 'Webhook refund entity is malformed', 400);
      }
      const status = eventType === 'refund.failed' ? 'failed' : eventType === 'refund.processed' ? 'processed' : (e.status || 'pending');
      const r = await this.applyRemoteRefund({ ...e, status } as RemoteRefund);
      return `REFUND_${r.outcome}`;
    }
    return 'UNHANDLED';
  }

  // =====================================================================
  // 4. The single write path for payments
  // =====================================================================

  async applyRemotePayment(remote: RemotePayment, source: 'verify' | 'webhook' | 'reconcile' | 'sync'): Promise<ApplyPaymentResult> {
    if (!remote.order_id) return { outcome: 'IGNORED', newlyPaid: false };
    const providerOrderId = remote.order_id;
    const now = this.now();
    let result: ApplyPaymentResult = { outcome: 'IGNORED', newlyPaid: false };
    let captureAfter = false as boolean;

    await this.store.transaction(async (uow) => {
      const locked = await uow.lockByProviderOrderId(providerOrderId);
      if (!locked) { result = { outcome: 'UNKNOWN_ORDER', newlyPaid: false }; return; }
      const { payment, order } = locked;
      result = { outcome: 'IGNORED', orderId: order.id, paymentId: payment.id, newlyPaid: false };

      if (remote.status === 'captured') {
        const d = decideCapture({
          payment, order, remote,
          otherPaidPaymentExists: await uow.hasOtherPaidPayment(order.id, payment.id),
        });
        const paidPatch = {
          providerPaymentId: remote.id, method: remote.method ?? null,
          capturedAmount: remote.amount, capturedAt: now,
        };
        switch (d.kind) {
          case 'ALREADY_PROCESSED':
            result.outcome = 'ALREADY_PROCESSED';
            break;
          case 'CONFLICTING_PAYMENT_ID':
            this.log('error', 'gateway reports a different captured payment id for an already-settled attempt', { paymentId: payment.id, remoteId: remote.id, source });
            result.outcome = 'CONFLICTING_PAYMENT_ID';
            break;
          case 'MARK_PAID': {
            await uow.updatePayment(payment.id, { status: 'PAID', ...paidPatch, failureCode: null, failureReason: null });
            const r = await uow.markOrderPaid(order.id);
            result.outcome = r.alreadyProcessed && payment.status === 'PAID' ? 'ALREADY_PROCESSED' : 'PAID';
            result.newlyPaid = !r.alreadyProcessed;
            break;
          }
          case 'PAID_THEN_REFUND': {
            await uow.updatePayment(payment.id, { status: 'PAID', ...paidPatch });
            await uow.insertRefund({
              paymentId: payment.id, amount: null, reason: d.refundReason, source: 'SYSTEM',
              idempotencyKey: systemRefundKey(d.refundReason.toLowerCase(), order.id, payment.id),
              note: d.refundReason === 'DUPLICATE_PAYMENT' ? 'Order was already paid by another attempt' : 'Payment received after the order stopped awaiting payment',
            });
            await uow.addOrderTimeline(order.id, 'Refund Initiated', d.refundReason === 'DUPLICATE_PAYMENT'
              ? 'A duplicate payment was received and is being refunded.'
              : 'A payment arrived after this order was cancelled and is being refunded.');
            result.outcome = d.refundReason === 'DUPLICATE_PAYMENT' ? 'DUPLICATE_PAYMENT_REFUND_QUEUED' : 'LATE_PAYMENT_REFUND_QUEUED';
            break;
          }
          case 'MISMATCH_REFUND': {
            await uow.updatePayment(payment.id, {
              status: 'MISMATCH', ...paidPatch, failureCode: d.problem,
              failureReason: `Gateway captured ${rupees(remote.amount)} ${remote.currency}; order expects ${rupees(rupeesToPaise(order.total))} INR`,
            });
            await uow.insertRefund({
              paymentId: payment.id, amount: null, reason: 'AMOUNT_MISMATCH', source: 'SYSTEM',
              idempotencyKey: systemRefundKey('mismatch', order.id, payment.id),
              note: `Captured amount did not match order total (${d.problem})`,
            });
            await uow.recordOrderAttemptFailed(order.id, 'The amount charged did not match the order total; it is being refunded.');
            this.log('error', 'captured amount mismatch', { paymentId: payment.id, problem: d.problem, remoteAmount: remote.amount, source });
            result.outcome = 'AMOUNT_MISMATCH_REFUND_QUEUED';
            break;
          }
        }
        return;
      }

      if (remote.status === 'authorized') {
        const d = decideAuthorized({ payment, order, remote });
        if (d.kind === 'IGNORE') { result.outcome = d.why === 'ALREADY_PAID' ? 'ALREADY_PROCESSED' : 'IGNORED'; return; }
        if (d.kind === 'REJECT') {
          // Nothing was captured, so nothing to refund: just never capture it.
          await uow.updatePayment(payment.id, {
            status: 'FAILED', failureCode: d.problem,
            failureReason: `Authorized ${rupees(remote.amount)} ${remote.currency} does not match the order; not captured`,
          });
          await uow.recordOrderAttemptFailed(order.id, 'The authorized amount did not match the order total, so it was not captured.');
          result.outcome = 'AUTHORIZED_REJECTED';
          return;
        }
        if (payment.status !== 'AUTHORIZED') {
          await uow.updatePayment(payment.id, { status: 'AUTHORIZED', providerPaymentId: remote.id, method: remote.method ?? null });
        }
        captureAfter = true;
        result.outcome = 'AUTHORIZED_PENDING_CAPTURE';
        return;
      }

      if (remote.status === 'failed') {
        const already = ['FAILED', 'CANCELLED', 'MISMATCH'].includes(payment.status);
        const failedAfter = (await uow.countFailedAttempts(order.id)) + (already ? 0 : 1);
        const d = decideFailure({ payment, order, failedAttemptsAfter: failedAfter });
        if (d.kind === 'IGNORE') { result.outcome = d.why === 'ALREADY_SUCCEEDED' ? 'ALREADY_PROCESSED' : 'IGNORED'; return; }
        const reason = remote.error_description || 'Payment failed';
        await uow.updatePayment(payment.id, { status: 'FAILED', method: remote.method ?? null, failureCode: remote.error_code ?? null, failureReason: reason });
        if (d.recordOnOrder) await uow.recordOrderAttemptFailed(order.id, reason);
        if (d.cancelOrder) {
          await uow.cancelUnpaidOrder(order.id, 'Too many failed payment attempts');
          result.outcome = 'ORDER_CANCELLED_TOO_MANY_FAILURES';
        } else {
          result.outcome = 'ATTEMPT_FAILED';
        }
        return;
      }
      // 'created', 'refunded', anything else: no payment-state change.
    });

    if (captureAfter) {
      const captured = await this.captureAuthorized(remote.id, providerOrderId);
      if (captured) result = captured;
    }
    if (result.newlyPaid && result.orderId) {
      try { await this.hooks.onOrderPaid?.(result.orderId); } catch (e) { this.log('error', 'onOrderPaid hook failed', { err: String(e) }); }
    }
    return result;
  }

  /**
   * An authorized payment holds the customer's money but has not been taken.
   * Capture it for OUR server-side amount; with auto-capture accounts the
   * gateway has usually already captured it, which we detect by re-reading.
   */
  private async captureAuthorized(remotePaymentId: string, providerOrderId: string): Promise<ApplyPaymentResult | null> {
    try {
      let current = await this.gateway.fetchPayment(remotePaymentId);
      if (current.status === 'authorized') {
        const row = await this.store.findPaymentByProviderOrderId(providerOrderId);
        if (!row) return null;
        try {
          current = await this.gateway.capturePayment(remotePaymentId, row.amount, row.currency);
        } catch (err) {
          current = await this.gateway.fetchPayment(remotePaymentId); // maybe captured concurrently
          if (current.status !== 'captured') throw err;
        }
      }
      if (current.status === 'captured') return await this.applyRemotePayment(current, 'sync');
      return null;
    } catch (err) {
      // Stays AUTHORIZED; the reconciler / maintenance job retries, and Razorpay auto-releases uncaptured holds.
      this.log('warn', 'capture of authorized payment deferred', { remotePaymentId, err: String(err) });
      return null;
    }
  }

  /**
   * Failed-payment recovery: ask Razorpay what it holds for each of the
   * order's gateway orders and apply any captured/authorized payment we
   * missed (webhook lost, browser closed after paying, ...).
   */
  async syncOrderWithGateway(orderId: number): Promise<ApplyPaymentResult[]> {
    const out: ApplyPaymentResult[] = [];
    for (const providerOrderId of await this.store.listProviderOrderIdsForOrder(orderId)) {
      const { items } = await this.gateway.listOrderPayments(providerOrderId);
      const relevant = items.filter((p) => p.status === 'captured' || p.status === 'authorized')
        .sort((a, b) => (a.status === 'captured' ? -1 : 1) - (b.status === 'captured' ? -1 : 1));
      for (const p of relevant) out.push(await this.applyRemotePayment({ ...p, order_id: p.order_id ?? providerOrderId }, 'sync'));
    }
    return out;
  }

  // =====================================================================
  // 5. Refunds
  // =====================================================================

  /**
   * Admin / API entry point. `idempotencyKey` makes a retried request safe:
   * the same key returns the same refund, a different amount under the same
   * key is rejected. Amount is paise; omit for "everything still refundable".
   */
  async requestRefund(a: {
    orderId: number; amountPaise?: number | null; reason: RefundReason; idempotencyKey: string;
    note?: string | null; initiatedBy?: number | null; source?: 'SYSTEM' | 'ADMIN';
  }): Promise<RefundRecord> {
    const attempts = await this.store.listAttempts(a.orderId);
    const payment = attempts.find((p) => refundableAmount(p) > 0)
      ?? attempts.find((p) => p.status === 'PAID' || p.status === 'MISMATCH');
    if (!payment) throw new RefundError('NOT_REFUNDABLE', 'This order has no captured online payment to refund');

    const { refund } = await this.store.transaction(async (uow) => {
      const locked = await uow.lockByPaymentId(payment.id);
      if (!locked) throw new RefundError('PAYMENT_NOT_FOUND', 'Payment not found');
      return uow.insertRefund({
        paymentId: payment.id, amount: a.amountPaise ?? null, reason: a.reason, source: a.source ?? 'ADMIN',
        idempotencyKey: `${a.source === 'SYSTEM' ? 'sys' : 'adm'}:${a.idempotencyKey}`.slice(0, 120),
        note: a.note ?? null, initiatedBy: a.initiatedBy ?? null,
      });
    });
    await this.processRefund(refund.id).catch((e) => this.log('warn', 'refund will be retried', { refundId: refund.id, err: String(e) }));
    return (await this.store.getRefund(refund.id)) ?? refund;
  }

  /** Send one PENDING refund to Razorpay (or re-read it if already sent). Safe to call any time, concurrently. */
  async processRefund(refundId: number): Promise<RefundRecord | null> {
    const r = await this.store.leaseRefund(refundId, REFUND_LEASE_SECONDS, MAX_REFUND_ATTEMPTS);
    if (!r) return null;

    try {
      const entity = r.providerRefundId
        ? await this.gateway.fetchRefund(r.providerRefundId)
        : await this.gateway.createRefund(this.requireProviderPaymentId(r), {
          amount: r.amount, receipt: refundReceipt(r.id), idempotencyKey: refundReceipt(r.id),
          notes: { refundId: String(r.id), orderId: String(r.orderId), reason: r.reason },
        });
      await this.applyRemoteRefund(entity, r.id);
    } catch (err) {
      const status = (err as { status?: number | null }).status ?? null;
      const permanent = !isRetryableGatewayStatus(status) || r.attempts >= MAX_REFUND_ATTEMPTS;
      if (permanent) {
        await this.failRefund(r.id, err instanceof Error ? err.message.slice(0, 400) : 'refund failed');
      } else {
        this.log('warn', 'refund attempt failed, will retry', { refundId: r.id, attempts: r.attempts, err: String(err) });
      }
    }
    return this.store.getRefund(r.id);
  }

  private requireProviderPaymentId(r: RefundRecord): string {
    if (!r.providerPaymentId) throw Object.assign(new Error('Refund has no gateway payment id'), { status: 400 });
    return r.providerPaymentId;
  }

  private async failRefund(refundId: number, reason: string) {
    let failed = null as RefundRecord | null;
    await this.store.transaction(async (uow) => {
      const cur = await uow.lockRefund(refundId);
      if (!cur) return;
      await uow.lockByPaymentId(cur.paymentId);
      if (cur.status !== 'PENDING') return;
      failed = await uow.updateRefund(refundId, { status: 'FAILED', failureReason: reason });
      await uow.addOrderTimeline(cur.orderId, 'Refund Failed', 'A refund could not be completed automatically and needs attention.');
    });
    if (failed) await this.settled(failed);
  }

  async processDueRefunds(limit = 20): Promise<{ attempted: number }> {
    const ids = await this.store.listDueRefundIds(limit, REFUND_LEASE_SECONDS);
    for (const id of ids) await this.processRefund(id).catch((e) => this.log('warn', 'refund processing error', { id, err: String(e) }));
    return { attempted: ids.length };
  }

  /** Single write path for refunds, used by our own calls, refund.* webhooks and reconciliation. */
  async applyRemoteRefund(entity: RemoteRefund, knownRefundId?: number): Promise<ApplyRefundResult> {
    const receipt = /^rf_(\d+)$/.exec(entity.receipt ?? '');
    const receiptId = receipt ? Number(receipt[1]) : (knownRefundId ?? null);
    const now = this.now();
    let result: ApplyRefundResult = { outcome: 'UNCHANGED', settled: false };
    let settledRefund = null as RefundRecord | null;

    await this.store.transaction(async (uow) => {
      let existing = await uow.findRefundByGatewayRef({ providerRefundId: entity.id, receiptId });
      const reported = mapRefundStatus(entity.status);

      if (!existing) {
        // Refund created outside this app (dashboard / API): import it so our books match.
        const locked = await uow.lockByProviderPaymentId(entity.payment_id);
        if (!locked) { result = { outcome: 'UNKNOWN_PAYMENT', settled: false }; return; }
        const ins = await uow.insertRefund({
          paymentId: locked.payment.id, amount: entity.amount, reason: 'GATEWAY', source: 'GATEWAY',
          idempotencyKey: `gw:${entity.id}`, providerRefundId: entity.id, status: reported,
          note: 'Refund created directly at the gateway',
        });
        existing = ins.refund;
        result = { outcome: 'IMPORTED', refundId: existing.id, settled: false };
        if (reported === 'PROCESSED') {
          await uow.updateRefund(existing.id, { processedAt: now });
          await uow.finalizeFullRefund(existing.paymentId);
          await uow.addOrderTimeline(existing.orderId, 'Refund Processed', `₹${rupees(existing.amount)} was refunded to the original payment method.`);
          settledRefund = existing;
          result.settled = true;
        }
        return;
      }

      await uow.lockByPaymentId(existing.paymentId);
      const cur = await uow.lockRefund(existing.id);
      if (!cur) return;
      const next = nextRefundStatus(cur.status, reported);
      result = { outcome: 'UNCHANGED', refundId: cur.id, settled: false };
      if (next === cur.status && cur.providerRefundId) return;

      const updated = await uow.updateRefund(cur.id, {
        providerRefundId: entity.id,
        status: next,
        failureReason: next === 'FAILED' ? 'Gateway reported the refund as failed' : null,
        processedAt: next === 'PROCESSED' ? (cur.processedAt ?? now) : null,
      });
      result = { outcome: next === cur.status ? 'UNCHANGED' : 'UPDATED', refundId: cur.id, settled: false };
      if (next === 'PROCESSED' && cur.status !== 'PROCESSED') {
        await uow.finalizeFullRefund(cur.paymentId);
        await uow.addOrderTimeline(cur.orderId, 'Refund Processed', `₹${rupees(cur.amount)} was refunded to the original payment method.`);
        settledRefund = updated; result.settled = true;
      } else if (next === 'FAILED' && cur.status !== 'FAILED') {
        await uow.addOrderTimeline(cur.orderId, 'Refund Failed', 'A refund could not be completed and needs attention.');
        settledRefund = updated; result.settled = true;
      }
    });

    if (settledRefund) await this.settled(settledRefund);
    return result;
  }

  private async settled(refund: RefundRecord) {
    try { await this.hooks.onRefundSettled?.(refund); } catch (e) { this.log('error', 'onRefundSettled hook failed', { err: String(e) }); }
  }
}
