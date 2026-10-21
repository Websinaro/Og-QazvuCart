/**
 * Drizzle helpers that write refund rows. They take a transaction handle so
 * the refund INTENT is committed atomically with whatever caused it (an order
 * cancellation, a captured-but-unwanted payment). The gateway call itself
 * happens afterwards, outside the transaction (see PaymentEngine.processRefund),
 * and is retried by the maintenance job — the transactional-outbox pattern.
 *
 * Does NOT import OrderService/fulfilment, so both can import this module.
 */
import { and, eq, ne, sql } from 'drizzle-orm';
import type { PgTransaction, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { db } from '@/src/db';
import * as schema from '@/src/db/schema';
import { payments, refunds } from '@/src/db/schema';
import { planRefund, systemRefundKey } from '@/src/lib/paymentRules';
import type { PaymentRecord, PaymentStatus, RefundReason, RefundStatus } from '@/src/lib/paymentRules';
import { RefundError } from './ports';
import type { NewRefund, RefundRecord } from './ports';

export type LedgerDb =
  | typeof db
  | PgTransaction<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export function toPaymentRecord(r: typeof payments.$inferSelect): PaymentRecord {
  return { ...r, status: r.status as PaymentStatus };
}

export function toRefundRecord(r: typeof refunds.$inferSelect): RefundRecord {
  return { ...r, status: r.status as RefundStatus, reason: r.reason as RefundReason, source: r.source as RefundRecord['source'] };
}

/** payments.refunded_amount := sum of PENDING + PROCESSED refunds. Always recomputed, never incremented, so it cannot drift. */
export async function recomputeRefunded(tx: LedgerDb, paymentId: number) {
  await tx
    .update(payments)
    .set({
      refundedAmount: sql`(SELECT COALESCE(SUM(${refunds.amount}), 0)::int FROM ${refunds} WHERE ${refunds.paymentId} = ${paymentId} AND ${refunds.status} IN ('PENDING', 'PROCESSED'))`,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentId));
}

/**
 * Idempotent on `idempotencyKey`; reserves capacity under a row lock on the
 * payment so concurrent refunds can never exceed what was captured (the
 * payments_refund_bounds_check CHECK constraint is the backstop).
 */
export async function insertRefundTx(tx: LedgerDb, input: NewRefund): Promise<{ refund: RefundRecord; created: boolean }> {
  const [payment] = await tx.select().from(payments).where(eq(payments.id, input.paymentId)).for('update');
  if (!payment) throw new RefundError('PAYMENT_NOT_FOUND', 'Payment not found');

  const [existing] = await tx.select().from(refunds).where(eq(refunds.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing) {
    if (existing.paymentId !== input.paymentId || (input.amount !== null && input.amount !== existing.amount)) {
      throw new RefundError('IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different refund');
    }
    return { refund: toRefundRecord(existing), created: false };
  }

  let amount = input.amount as number;
  if (input.source !== 'GATEWAY') {
    const plan = planRefund(toPaymentRecord(payment), input.amount);
    if (!plan.ok) throw new RefundError(plan.error, `Refund not allowed (${plan.error}); refundable ₹${(plan.refundable / 100).toFixed(2)}`, plan.refundable);
    amount = plan.amount;
  }

  const [row] = await tx
    .insert(refunds)
    .values({
      paymentId: payment.id,
      orderId: payment.orderId,
      providerPaymentId: payment.providerPaymentId,
      providerRefundId: input.providerRefundId ?? null,
      amount,
      currency: payment.currency,
      status: input.status ?? 'PENDING',
      reason: input.reason,
      note: input.note ?? null,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      initiatedBy: input.initiatedBy ?? null,
    })
    .returning();
  await recomputeRefunded(tx, payment.id);
  return { refund: toRefundRecord(row), created: true };
}

/**
 * Called from every path that ends an order (customer cancel, admin/seller
 * cancelling the last live parcel, return): queue a refund for whatever is
 * still refundable on the order's PAID online payment. Deterministic key =>
 * calling it twice (or from two paths) can never create two refunds.
 * Returns the refunds created (empty for COD / unpaid orders).
 */
export async function enqueueRefundsForClosedOrder(tx: LedgerDb, orderId: number, kind: 'cancel' | 'return'): Promise<RefundRecord[]> {
  const paid = await tx
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, 'PAID')))
    .for('update');

  const created: RefundRecord[] = [];
  for (const p of paid) {
    const plan = planRefund(toPaymentRecord(p), null);
    if (!plan.ok) continue; // already fully refunded / reserved
    const { refund, created: isNew } = await insertRefundTx(tx, {
      paymentId: p.id,
      amount: null,
      reason: kind === 'cancel' ? 'ORDER_CANCELLED' : 'ORDER_RETURNED',
      source: 'SYSTEM',
      idempotencyKey: systemRefundKey(kind, orderId, p.id),
      note: kind === 'cancel' ? 'Order cancelled after payment' : 'Order returned',
    });
    if (isNew) created.push(refund);
  }
  return created;
}

/** Is there still a captured payment on this order that no other attempt explains? (used when a refund completes) */
export async function hasOtherPaid(tx: LedgerDb, orderId: number, exceptPaymentId: number) {
  const [row] = await tx
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.orderId, orderId), ne(payments.id, exceptPaymentId), eq(payments.status, 'PAID')))
    .limit(1);
  return !!row;
}

