import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { orders, payments, refunds, paymentReconciliationItems, paymentReconciliationRuns } from '@/src/db/schema';

/** Read-only queries behind the admin refund / reconciliation endpoints. */
export class PaymentAdminQueries {
  static async listRefunds(opts: { status?: string; orderId?: number; limit?: number } = {}) {
    const where = [
      opts.status ? eq(refunds.status, opts.status) : undefined,
      opts.orderId ? eq(refunds.orderId, opts.orderId) : undefined,
    ].filter((x): x is NonNullable<typeof x> => !!x);
    const rows = await db
      .select({
        id: refunds.id, orderId: refunds.orderId, orderNumber: orders.orderNumber, paymentId: refunds.paymentId,
        amount: refunds.amount, status: refunds.status, reason: refunds.reason, source: refunds.source, note: refunds.note,
        providerRefundId: refunds.providerRefundId, attempts: refunds.attempts, failureReason: refunds.failureReason,
        createdAt: refunds.createdAt, processedAt: refunds.processedAt,
      })
      .from(refunds)
      .innerJoin(orders, eq(refunds.orderId, orders.id))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(refunds.id))
      .limit(Math.min(opts.limit ?? 50, 200));
    return rows.map((r) => ({ ...r, amountRupees: r.amount / 100 }));
  }

  static async orderPayments(orderId: number) {
    const rows = await db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(payments.attemptNo);
    const refundRows = await this.listRefunds({ orderId });
    return {
      payments: rows.map((p) => ({
        id: p.id, attemptNo: p.attemptNo, status: p.status, amount: p.amount, capturedAmount: p.capturedAmount,
        refundedAmount: p.refundedAmount, method: p.method, failureCode: p.failureCode, failureReason: p.failureReason,
        providerOrderId: p.providerOrderId, providerPaymentId: p.providerPaymentId, createdAt: p.createdAt,
      })),
      refunds: refundRows,
    };
  }

  static async listReconciliationRuns(limit = 20) {
    return db.select().from(paymentReconciliationRuns).orderBy(desc(paymentReconciliationRuns.id)).limit(Math.min(limit, 100));
  }

  static async getReconciliationRun(id: number) {
    const [run] = await db.select().from(paymentReconciliationRuns).where(eq(paymentReconciliationRuns.id, id)).limit(1);
    if (!run) return null;
    const items = await db.select().from(paymentReconciliationItems).where(eq(paymentReconciliationItems.runId, id)).orderBy(paymentReconciliationItems.id);
    return { run, items };
  }
}
