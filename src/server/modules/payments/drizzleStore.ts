/**
 * Postgres (drizzle) implementation of the PaymentsStore port.
 *
 * Locking rule used everywhere: lock the ORDER row, then the PAYMENT row,
 * then any refund rows. Never the other way round, so concurrent webhook /
 * verify / cancel / refund paths cannot deadlock each other.
 */
import { and, asc, eq, gt, inArray, isNull, lt, ne, or, sql, desc } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  orders, orderTimeline, payments, paymentEvents, refunds, paymentReconciliationRuns, paymentReconciliationItems,
} from '@/src/db/schema';
import {
  MAX_REFUND_ATTEMPTS, WEBHOOK_LOCK_SECONDS,
} from '@/src/lib/paymentRules';
import type { OrderPaymentView } from '@/src/lib/paymentRules';
import { OrderService } from '../orders/orderService';
import {
  hasOtherPaid, insertRefundTx, recomputeRefunded, toPaymentRecord, toRefundRecord,
} from './refundLedger';
import type { LedgerDb } from './refundLedger';
import type {
  Locked, PaymentPatch, PaymentsStore, PaymentUow, ReconItemInput, ReconRunInput, WebhookClaim,
} from './ports';

const toOrderView = (o: typeof orders.$inferSelect): OrderPaymentView => ({
  id: o.id, userId: o.userId, orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus,
  paymentMethod: o.paymentMethod, total: o.total, paymentReservationExpiresAt: o.paymentReservationExpiresAt,
});

const FAILED_LIKE = ['FAILED', 'CANCELLED', 'MISMATCH'];

async function lockOrderThenPayment(tx: LedgerDb, paymentId: number): Promise<Locked | null> {
  const [ref] = await tx.select({ orderId: payments.orderId }).from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!ref) return null;
  const [order] = await tx.select().from(orders).where(eq(orders.id, ref.orderId)).for('update');
  const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
  if (!order || !payment) return null;
  return { payment: toPaymentRecord(payment), order: toOrderView(order) };
}

function makeUow(tx: LedgerDb): PaymentUow {
  return {
    async lockByProviderOrderId(providerOrderId) {
      const [p] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.providerOrderId, providerOrderId)).limit(1);
      return p ? lockOrderThenPayment(tx, p.id) : null;
    },
    lockByPaymentId: (id) => lockOrderThenPayment(tx, id),
    async lockByProviderPaymentId(providerPaymentId) {
      const [p] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.providerPaymentId, providerPaymentId)).limit(1);
      return p ? lockOrderThenPayment(tx, p.id) : null;
    },

    async updatePayment(paymentId, patch: PaymentPatch) {
      const set: Partial<typeof payments.$inferInsert> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) (set as Record<string, unknown>)[k] = v;
      const [row] = await tx.update(payments).set(set).where(eq(payments.id, paymentId)).returning();
      return toPaymentRecord(row);
    },

    markOrderPaid: (orderId) => OrderService.markOrderPaidInTx(tx, orderId),
    recordOrderAttemptFailed: (orderId, reason) => OrderService.recordPaymentAttemptFailedInTx(tx, orderId, reason),
    async cancelUnpaidOrder(orderId, reason) { await OrderService.cancelUnpaidOrderInTx(tx, orderId, reason); },
    async setOrderPaymentStatus(orderId, status) {
      await tx.update(orders).set({ paymentStatus: status, updatedAt: new Date() }).where(eq(orders.id, orderId));
    },
    async addOrderTimeline(orderId, title, description) {
      const [o] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId)).limit(1);
      await tx.insert(orderTimeline).values({ orderId, status: o?.status ?? 'CONFIRMED', title, description, completed: true });
    },

    async countFailedAttempts(orderId) {
      const [r] = await tx
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(payments)
        .where(and(
          eq(payments.orderId, orderId),
          inArray(payments.status, FAILED_LIKE),
          or(isNull(payments.failureCode), ne(payments.failureCode, 'GATEWAY_CREATE_FAILED')),
        ));
      return r?.n ?? 0;
    },
    hasOtherPaidPayment: (orderId, except) => hasOtherPaid(tx, orderId, except),

    insertRefund: (input) => insertRefundTx(tx, input),
    async findRefundByGatewayRef({ providerRefundId, receiptId }) {
      const [byProvider] = await tx.select().from(refunds).where(eq(refunds.providerRefundId, providerRefundId)).limit(1);
      if (byProvider) return toRefundRecord(byProvider);
      if (!receiptId) return null;
      const [byReceipt] = await tx.select().from(refunds).where(eq(refunds.id, receiptId)).limit(1);
      return byReceipt ? toRefundRecord(byReceipt) : null;
    },
    async lockRefund(refundId) {
      const [r] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for('update');
      return r ? toRefundRecord(r) : null;
    },
    async updateRefund(refundId, patch) {
      const set: Partial<typeof refunds.$inferInsert> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) (set as Record<string, unknown>)[k] = v;
      const [row] = await tx.update(refunds).set(set).where(eq(refunds.id, refundId)).returning();
      await recomputeRefunded(tx, row.paymentId);
      return toRefundRecord(row);
    },
    async finalizeFullRefund(paymentId) {
      const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
      if (!p || p.capturedAmount <= 0 || !['PAID', 'MISMATCH'].includes(p.status)) return false;
      const [sum] = await tx
        .select({ n: sql<number>`COALESCE(SUM(${refunds.amount}), 0)::int` })
        .from(refunds)
        .where(and(eq(refunds.paymentId, paymentId), eq(refunds.status, 'PROCESSED')));
      if ((sum?.n ?? 0) < p.capturedAmount) return false;
      await tx.update(payments).set({ status: 'REFUNDED', updatedAt: new Date() }).where(eq(payments.id, paymentId));
      if (!(await hasOtherPaid(tx, p.orderId, p.id))) {
        await tx.update(orders).set({ paymentStatus: 'REFUNDED', updatedAt: new Date() }).where(eq(orders.id, p.orderId));
      }
      return true;
    },
  };
}

export const drizzleStore: PaymentsStore = {
  transaction: (fn) => db.transaction((tx) => fn(makeUow(tx))),

  // ---- webhook ledger --------------------------------------------------
  async claimWebhookEvent({ eventId, eventType, payloadSha256 }): Promise<WebhookClaim> {
    const inserted = await db
      .insert(paymentEvents)
      .values({ eventId, eventType, payloadSha256 })
      .onConflictDoNothing({ target: paymentEvents.eventId })
      .returning({ id: paymentEvents.id });
    if (inserted.length) return 'CLAIMED';

    // Seen before: only re-run if the earlier run FAILED or its worker died mid-way.
    const staleBefore = new Date(Date.now() - WEBHOOK_LOCK_SECONDS * 1000);
    const reclaimed = await db
      .update(paymentEvents)
      .set({ status: 'PROCESSING', lockedAt: new Date(), attempts: sql`${paymentEvents.attempts} + 1`, error: null })
      .where(and(
        eq(paymentEvents.eventId, eventId),
        or(eq(paymentEvents.status, 'FAILED'), and(eq(paymentEvents.status, 'PROCESSING'), lt(paymentEvents.lockedAt, staleBefore))),
      ))
      .returning({ id: paymentEvents.id });
    if (reclaimed.length) return 'CLAIMED';

    const [row] = await db.select({ status: paymentEvents.status }).from(paymentEvents).where(eq(paymentEvents.eventId, eventId)).limit(1);
    return row?.status === 'PROCESSED' ? 'DUPLICATE_PROCESSED' : 'DUPLICATE_IN_FLIGHT';
  },
  async finishWebhookEvent(eventId, outcome) {
    await db.update(paymentEvents).set({ status: 'PROCESSED', outcome: outcome.slice(0, 60), processedAt: new Date(), error: null }).where(eq(paymentEvents.eventId, eventId));
  },
  async failWebhookEvent(eventId, error) {
    await db.update(paymentEvents).set({ status: 'FAILED', error: error.slice(0, 1000) }).where(eq(paymentEvents.eventId, eventId));
  },

  // ---- attempts --------------------------------------------------------
  async getOrderForUser(userId, orderId) {
    const [o] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
    return o ? toOrderView(o) : null;
  },
  async getOrder(orderId) {
    const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    return o ? toOrderView(o) : null;
  },
  async listAttempts(orderId) {
    return (await db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(asc(payments.attemptNo))).map(toPaymentRecord);
  },
  async claimAttempt(a) {
    const rows = await db
      .insert(payments)
      .values({
        orderId: a.orderId, userId: a.userId, provider: 'RAZORPAY', amount: a.amount, currency: 'INR',
        status: 'CREATED', attemptNo: a.attemptNo, idempotencyKey: a.idempotencyKey,
      })
      .onConflictDoNothing() // (order_id, attempt_no) or idempotency_key already taken by a concurrent request
      .returning();
    return rows[0] ? toPaymentRecord(rows[0]) : null;
  },
  async attachProviderOrder(paymentId, providerOrderId) {
    const [row] = await db.update(payments).set({ providerOrderId, updatedAt: new Date() }).where(eq(payments.id, paymentId)).returning();
    return toPaymentRecord(row);
  },
  async failAttempt(paymentId, code, reason) {
    await db.update(payments).set({ status: 'FAILED', failureCode: code, failureReason: reason, updatedAt: new Date() })
      .where(and(eq(payments.id, paymentId), inArray(payments.status, ['CREATED', 'PENDING'])));
  },
  async cancelAttempt(paymentId, reason) {
    await db.update(payments).set({ status: 'CANCELLED', failureReason: reason, updatedAt: new Date() })
      .where(and(eq(payments.id, paymentId), inArray(payments.status, ['CREATED', 'PENDING', 'AUTHORIZED'])));
  },
  async setOrderPaymentStatusIfPayable(orderId, status) {
    await db.update(orders).set({ paymentStatus: status, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'PENDING_PAYMENT'), ne(orders.paymentStatus, 'PAID')));
  },

  // ---- refunds ---------------------------------------------------------
  async getRefund(id) {
    const [r] = await db.select().from(refunds).where(eq(refunds.id, id)).limit(1);
    return r ? toRefundRecord(r) : null;
  },
  async findRefundByGatewayRef({ providerRefundId, receiptId }) {
    const [byProvider] = await db.select().from(refunds).where(eq(refunds.providerRefundId, providerRefundId)).limit(1);
    if (byProvider) return toRefundRecord(byProvider);
    if (!receiptId) return null;
    const [byReceipt] = await db.select().from(refunds).where(eq(refunds.id, receiptId)).limit(1);
    return byReceipt ? toRefundRecord(byReceipt) : null;
  },
  async listRefundsForOrder(orderId) {
    return (await db.select().from(refunds).where(eq(refunds.orderId, orderId)).orderBy(desc(refunds.id))).map(toRefundRecord);
  },
  async leaseRefund(refundId, leaseSeconds, maxAttempts) {
    const dueBefore = new Date(Date.now() - leaseSeconds * 1000);
    const [row] = await db
      .update(refunds)
      .set({ attempts: sql`${refunds.attempts} + 1`, lastAttemptAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(refunds.id, refundId), eq(refunds.status, 'PENDING'), lt(refunds.attempts, maxAttempts),
        or(isNull(refunds.lastAttemptAt), lt(refunds.lastAttemptAt, dueBefore)),
      ))
      .returning();
    return row ? toRefundRecord(row) : null;
  },
  async listDueRefundIds(limit, leaseSeconds) {
    const dueBefore = new Date(Date.now() - leaseSeconds * 1000);
    const rows = await db
      .select({ id: refunds.id })
      .from(refunds)
      .where(and(
        eq(refunds.status, 'PENDING'), lt(refunds.attempts, MAX_REFUND_ATTEMPTS),
        or(isNull(refunds.lastAttemptAt), lt(refunds.lastAttemptAt, dueBefore)),
      ))
      .orderBy(asc(refunds.id))
      .limit(limit);
    return rows.map((r) => r.id);
  },
  async sumProcessedRefunds(paymentId) {
    const [r] = await db
      .select({ n: sql<number>`COALESCE(SUM(${refunds.amount}), 0)::int` })
      .from(refunds)
      .where(and(eq(refunds.paymentId, paymentId), eq(refunds.status, 'PROCESSED')));
    return r?.n ?? 0;
  },

  // ---- reconciliation / recovery --------------------------------------
  async findPaymentByProviderOrderId(providerOrderId) {
    const [p] = await db.select().from(payments).where(eq(payments.providerOrderId, providerOrderId)).limit(1);
    return p ? toPaymentRecord(p) : null;
  },
  async listPaymentsInWindow(from, to) {
    return (await db.select().from(payments).where(and(gt(payments.createdAt, from), lt(payments.createdAt, to)))).map(toPaymentRecord);
  },
  async listStaleOpenAttemptOrderIds(olderThanSeconds) {
    const before = new Date(Date.now() - olderThanSeconds * 1000);
    const rows = await db
      .select({ id: payments.providerOrderId })
      .from(payments)
      .where(and(inArray(payments.status, ['CREATED', 'PENDING', 'AUTHORIZED']), lt(payments.createdAt, before)));
    return rows.map((r) => r.id).filter((x): x is string => !!x);
  },
  async listExpiredPendingOrderIds() {
    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.status, 'PENDING_PAYMENT'), sql`${orders.paymentReservationExpiresAt} < NOW()`));
    return rows.map((r) => r.id);
  },
  async listProviderOrderIdsForOrder(orderId) {
    const rows = await db.select({ id: payments.providerOrderId }).from(payments).where(eq(payments.orderId, orderId));
    return rows.map((r) => r.id).filter((x): x is string => !!x);
  },
  async createReconRun(r: ReconRunInput) {
    const [row] = await db
      .insert(paymentReconciliationRuns)
      .values({ trigger: r.trigger, heal: r.heal, windowFrom: r.from, windowTo: r.to, triggeredBy: r.triggeredBy ?? null })
      .returning({ id: paymentReconciliationRuns.id });
    return row.id;
  },
  async addReconItem(runId, item: ReconItemInput) {
    await db.insert(paymentReconciliationItems).values({
      runId, kind: item.kind, resolution: item.resolution, paymentId: item.paymentId ?? null, orderId: item.orderId ?? null,
      providerOrderId: item.providerOrderId ?? null, providerPaymentId: item.providerPaymentId ?? null,
      providerRefundId: item.providerRefundId ?? null, localStatus: item.localStatus ?? null, remoteStatus: item.remoteStatus ?? null,
      localAmount: item.localAmount ?? null, remoteAmount: item.remoteAmount ?? null, details: item.details ?? null,
    });
  },
  async finishReconRun(runId, s) {
    await db.update(paymentReconciliationRuns).set({
      status: s.error ? 'FAILED' : 'COMPLETED', error: s.error ?? null, finishedAt: new Date(),
      gatewayPaymentsChecked: s.gatewayPaymentsChecked, gatewayRefundsChecked: s.gatewayRefundsChecked,
      localPaymentsChecked: s.localPaymentsChecked, matched: s.matched, autoHealed: s.autoHealed, needsReview: s.needsReview,
    }).where(eq(paymentReconciliationRuns.id, runId));
  },
};
