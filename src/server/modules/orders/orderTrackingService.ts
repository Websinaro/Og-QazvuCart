import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { orders, orderTimeline, orderItems, returnRequests, returnItems, sellerOrders, sellers, users, refunds, payments, sellerAdjustments } from '@/src/db/schema';
import { NotificationService } from '../notifications/notificationService';
import { OrderService } from './orderService';
import { transitionSellerOrder, type DbClient } from './fulfilment';
import { insertRefundTx, toPaymentRecord } from '../payments/refundLedger';
import { kickPendingRefunds } from '../payments/kickRefunds';
import { planRefund, rupeesToPaise } from '@/src/lib/paymentRules';
import { coversWholeParcel, priceReturn, remainingReturnable, returnDeadline, type ReturnableLine } from '@/src/lib/returnRules';

export const RETURN_WINDOW_DAYS = 7;
export const RETURN_REASONS = ['DAMAGED', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'NO_LONGER_NEEDED', 'OTHER'] as const;

const MSG: Record<string, string> = {
  CONFIRMED: 'has been confirmed.',
  PACKED: 'has been packed by the seller.',
  SHIPPED: 'has shipped.',
  OUT_FOR_DELIVERY: 'is out for delivery today.',
  DELIVERED: `was delivered. Not happy? You can request a return within ${RETURN_WINDOW_DAYS} days.`,
  CANCELLED: 'was cancelled. Any online payment will be refunded.',
  RETURNED: 'was returned. Your refund is on its way.',
};

export class OrderTrackingService {
  /** Call AFTER the status change has committed. Never throws. */
  static async notifyProgress(orderId: number, status: string, sellerOrderId?: number) {
    try {
      const text = MSG[status];
      if (!text) return;
      const [o] = await db.select({ userId: orders.userId, orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!o) return;
      let extra = '';
      if (sellerOrderId && status === 'SHIPPED') {
        const [p] = await db.select({ c: sellerOrders.carrier, t: sellerOrders.trackingNumber }).from(sellerOrders).where(eq(sellerOrders.id, sellerOrderId)).limit(1);
        if (p?.t) extra = ` Track it${p.c ? ` with ${p.c}` : ''}: ${p.t}.`;
      }
      await NotificationService.notifyUser(o.userId, {
        type: 'ORDER',
        title: `Order ${o.orderNumber}`,
        body: `Your order ${o.orderNumber} ${text}${extra}`,
        link: '/account',
      });
    } catch (err) {
      console.error('[OrderTracking] notify failed:', err);
    }
  }

  /**
   * Every order line with its parcel's state and how many units are already
   * in a live (requested/approved) return. `lock` takes row locks on the
   * order lines so concurrent requests cannot return the same units twice.
   */
  private static async loadLines(tx: DbClient, orderId: number, lock = false): Promise<ParcelLine[]> {
    const base = tx
      .select({
        orderItemId: orderItems.id, sellerOrderId: orderItems.sellerOrderId, quantity: orderItems.quantity,
        totalPrice: orderItems.totalPrice, commissionAmount: orderItems.commissionAmount, sellerEarning: orderItems.sellerEarning,
        productName: orderItems.productName, variantName: orderItems.variantName,
        parcelStatus: sellerOrders.status, deliveredAt: sellerOrders.deliveredAt,
      })
      .from(orderItems)
      .innerJoin(sellerOrders, eq(orderItems.sellerOrderId, sellerOrders.id))
      .where(eq(orderItems.orderId, orderId))
      .orderBy(orderItems.id);
    const rows = lock ? await base.for('update', { of: orderItems }) : await base;

    const live = await tx
      .select({ orderItemId: returnItems.orderItemId, qty: sql<number>`COALESCE(SUM(${returnItems.quantity}), 0)::int` })
      .from(returnItems)
      .innerJoin(returnRequests, eq(returnItems.returnRequestId, returnRequests.id))
      .where(and(eq(returnRequests.orderId, orderId), inArray(returnRequests.status, [...LIVE_RETURN_STATUSES])))
      .groupBy(returnItems.orderItemId);
    const liveByItem = new Map(live.map((r) => [r.orderItemId, r.qty]));
    return rows.map((r) => ({ ...r, liveReturned: liveByItem.get(r.orderItemId) ?? 0 }));
  }

  /** Refund progress + return requests (with their items) + eligibility, shown in the customer's tracking panel. */
  static async getExtras(orderId: number, orderStatus?: string) {
    void orderStatus; // kept for callers; eligibility is now decided per parcel
    const reqs = await db.select().from(returnRequests).where(eq(returnRequests.orderId, orderId)).orderBy(desc(returnRequests.id));
    const reqItems = reqs.length
      ? await db
          .select({
            returnRequestId: returnItems.returnRequestId, orderItemId: returnItems.orderItemId, quantity: returnItems.quantity,
            refundAmount: returnItems.refundAmount, productName: orderItems.productName, variantName: orderItems.variantName,
          })
          .from(returnItems).innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
          .where(inArray(returnItems.returnRequestId, reqs.map((r) => r.id)))
      : [];
    const refundRows = await db
      .select({ amount: refunds.amount, status: refunds.status, createdAt: refunds.createdAt, processedAt: refunds.processedAt })
      .from(refunds).where(eq(refunds.orderId, orderId)).orderBy(desc(refunds.id));

    // Eligible while some DELIVERED parcel still has units that are not in a live return and is inside its window.
    const legacyLive = reqs.some((r) => r.sellerOrderId === null && r.status !== 'REJECTED');
    let eligibleUntil: Date | null = null;
    if (!legacyLive) {
      const now = new Date();
      for (const l of await this.loadLines(db, orderId)) {
        if (l.parcelStatus !== 'DELIVERED' || !l.deliveredAt || remainingReturnable(l) <= 0) continue;
        const d = returnDeadline(l.deliveredAt, RETURN_WINDOW_DAYS);
        if (d > now && (!eligibleUntil || d > eligibleUntil)) eligibleUntil = d;
      }
    }

    const latest = reqs[0];
    return {
      returnRequest: latest
        ? { id: latest.id, status: latest.status, reason: latest.reason, adminNote: latest.adminNote, createdAt: latest.createdAt.toISOString() }
        : null,
      returnRequests: reqs.map((r) => {
        const items = reqItems.filter((i) => i.returnRequestId === r.id);
        return {
          id: r.id, status: r.status, reason: r.reason, adminNote: r.adminNote, sellerOrderId: r.sellerOrderId,
          createdAt: r.createdAt.toISOString(),
          refundAmount: items.reduce((a, i) => a + i.refundAmount, 0),
          items: items.map((i) => ({ orderItemId: i.orderItemId, productName: i.productName, variantName: i.variantName, quantity: i.quantity, refundAmount: i.refundAmount })),
        };
      }),
      refunds: refundRows.map((r) => ({ amount: r.amount, status: r.status, createdAt: r.createdAt.toISOString(), processedAt: r.processedAt?.toISOString() ?? null })),
      returnEligibleUntil: eligibleUntil ? eligibleUntil.toISOString() : null,
    };
  }

  /**
   * Customer return request for specific order lines. `items` omitted/empty
   * means "everything still returnable". The request is split into one
   * return request per seller parcel, so each seller's goods are decided
   * (and refunded) independently.
   */
  static async requestReturn(userId: number, orderId: number, reason: string, details?: string, items?: Array<{ orderItemId: number; quantity: number }>) {
    if (!(RETURN_REASONS as readonly string[]).includes(reason)) throw new Error('Please choose a valid return reason.');
    if (items !== undefined) {
      const seen = new Set<number>();
      for (const i of items) {
        if (!Number.isInteger(i?.orderItemId) || !Number.isInteger(i?.quantity) || i.quantity <= 0) throw new Error('Each returned item needs a valid item id and a positive whole quantity.');
        if (seen.has(i.orderItemId)) throw new Error('Each item can only be listed once per return request.');
        seen.add(i.orderItemId);
      }
    }

    const { orderNumber, refundTotal } = await db.transaction(async (tx) => {
      const [o] = await tx
        .select({ id: orders.id, orderNumber: orders.orderNumber, discount: orders.discount, subtotal: orders.subtotal })
        .from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
      if (!o) throw new Error('Order not found');

      const [legacy] = await tx
        .select({ id: returnRequests.id }).from(returnRequests)
        .where(and(eq(returnRequests.orderId, orderId), sql`${returnRequests.sellerOrderId} IS NULL`, inArray(returnRequests.status, [...LIVE_RETURN_STATUSES])))
        .limit(1);
      if (legacy) throw new Error('A return was already requested for this order.');

      const lines = await this.loadLines(tx, orderId, true);
      const byId = new Map(lines.map((l) => [l.orderItemId, l]));
      const now = new Date();

      const wanted: Array<{ line: ParcelLine; qty: number }> = [];
      if (items && items.length > 0) {
        for (const i of items) {
          const line = byId.get(i.orderItemId);
          if (!line) throw new Error('One of the selected items is not part of this order.');
          if (i.quantity > remainingReturnable(line)) throw new Error(`You can return at most ${remainingReturnable(line)} of "${line.productName}".`);
          wanted.push({ line, qty: i.quantity });
        }
      } else {
        for (const line of lines) {
          if (line.parcelStatus === 'DELIVERED' && remainingReturnable(line) > 0) wanted.push({ line, qty: remainingReturnable(line) });
        }
      }
      if (wanted.length === 0) throw new Error('There is nothing left on this order that can be returned.');

      for (const { line } of wanted) {
        if (line.parcelStatus !== 'DELIVERED' || !line.deliveredAt) throw new Error(`"${line.productName}" has not been delivered yet, so it cannot be returned.`);
        if (returnDeadline(line.deliveredAt, RETURN_WINDOW_DAYS) <= now) throw new Error(`The ${RETURN_WINDOW_DAYS}-day return window for "${line.productName}" has closed.`);
      }

      const byParcel = new Map<number, Array<{ line: ParcelLine; qty: number }>>();
      for (const w of wanted) byParcel.set(w.line.sellerOrderId, [...(byParcel.get(w.line.sellerOrderId) ?? []), w]);

      let total = 0;
      for (const [sellerOrderId, group] of byParcel) {
        const [req] = await tx.insert(returnRequests).values({
          orderId, sellerOrderId, userId, reason, details: details?.slice(0, 1000) || null,
        }).returning({ id: returnRequests.id });
        const rows = group.map(({ line, qty }) => {
          const price = priceReturn(line, qty, o);
          total += price.refundAmount;
          return { returnRequestId: req.id, orderItemId: line.orderItemId, quantity: qty, ...price };
        });
        await tx.insert(returnItems).values(rows);
      }

      await tx.insert(orderTimeline).values({
        orderId, status: 'RETURN_REQUESTED', title: 'Return Requested',
        description: `Return requested for ${wanted.reduce((a, w) => a + w.qty, 0)} item(s). We are reviewing it.`, completed: true,
      });
      return { orderNumber: o.orderNumber, refundTotal: total };
    });

    await NotificationService.notifyUser(userId, { type: 'ORDER', title: `Return requested`, body: `We received your return request for order ${orderNumber} (refund up to ₹${refundTotal}) and will review it shortly.`, link: '/account' });
    return this.getExtras(orderId);
  }

  static async listReturns(status?: string) {
    const rows = await db
      .select({
        id: returnRequests.id, orderId: returnRequests.orderId, sellerOrderId: returnRequests.sellerOrderId,
        orderNumber: orders.orderNumber, total: orders.total, sellerName: sellers.storeName,
        customer: users.email, reason: returnRequests.reason, details: returnRequests.details,
        status: returnRequests.status, adminNote: returnRequests.adminNote, createdAt: returnRequests.createdAt,
      })
      .from(returnRequests).innerJoin(orders, eq(returnRequests.orderId, orders.id)).innerJoin(users, eq(returnRequests.userId, users.id))
      .leftJoin(sellerOrders, eq(returnRequests.sellerOrderId, sellerOrders.id))
      .leftJoin(sellers, eq(sellerOrders.sellerId, sellers.id))
      .where(status ? eq(returnRequests.status, status) : undefined)
      .orderBy(desc(returnRequests.id)).limit(100);
    const items = rows.length
      ? await db
          .select({
            returnRequestId: returnItems.returnRequestId, orderItemId: returnItems.orderItemId, quantity: returnItems.quantity,
            refundAmount: returnItems.refundAmount, productName: orderItems.productName, variantName: orderItems.variantName,
          })
          .from(returnItems).innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
          .where(inArray(returnItems.returnRequestId, rows.map((r) => r.id)))
      : [];
    return rows.map((r) => {
      const mine = items.filter((i) => i.returnRequestId === r.id);
      return { ...r, createdAt: r.createdAt.toISOString(), items: mine, refundAmount: mine.reduce((a, i) => a + i.refundAmount, 0) };
    });
  }

  /**
   * Decide a return request.
   *
   * Item-level requests act on their own seller parcel only: APPROVE queues a
   * refund for exactly the returned items and adjusts that seller's earnings;
   * the parcel moves to RETURNED only if approved returns now cover all of
   * it. Other sellers' parcels on the order are never touched. Legacy
   * whole-order requests (no seller_order_id) keep the old behaviour.
   */
  static async resolveReturn(adminUserId: number, id: number, decision: 'APPROVE' | 'REJECT', note?: string) {
    const [first] = await db.select().from(returnRequests).where(eq(returnRequests.id, id)).limit(1);
    if (!first) throw new Error('Return request not found');

    if (first.sellerOrderId === null) {
      if (first.status !== 'REQUESTED') throw new Error('This request has already been resolved.');
      if (decision === 'APPROVE') await OrderService.adminUpdateStatus(first.orderId, 'RETURNED', adminUserId);
      await db.update(returnRequests).set({
        status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', adminNote: note?.slice(0, 500) || null, resolvedBy: adminUserId, resolvedAt: new Date(),
      }).where(eq(returnRequests.id, id));
    } else {
      await db.transaction(async (tx) => {
        const [r] = await tx.select().from(returnRequests).where(eq(returnRequests.id, id)).for('update');
        if (!r || r.sellerOrderId === null) throw new Error('Return request not found');
        if (r.status !== 'REQUESTED') throw new Error('This request has already been resolved.');

        if (decision === 'APPROVE') await this.approveItemReturn(tx, r.id, r.orderId, r.sellerOrderId, adminUserId);

        await tx.update(returnRequests).set({
          status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', adminNote: note?.slice(0, 500) || null, resolvedBy: adminUserId, resolvedAt: new Date(),
        }).where(eq(returnRequests.id, id));
        await tx.insert(orderTimeline).values({
          orderId: r.orderId,
          status: decision === 'APPROVE' ? 'RETURN_APPROVED' : 'RETURN_DECLINED',
          title: decision === 'APPROVE' ? 'Return Approved' : 'Return Declined',
          description: decision === 'APPROVE' ? 'A return for part of this order was approved.' : 'A return request for part of this order was declined.',
          completed: true,
        });
      });
      if (decision === 'APPROVE') kickPendingRefunds();
    }

    const [o] = await db.select({ n: orders.orderNumber }).from(orders).where(eq(orders.id, first.orderId)).limit(1);
    await NotificationService.notifyUser(first.userId, {
      type: 'ORDER', title: `Return ${decision === 'APPROVE' ? 'approved' : 'declined'}`,
      body: decision === 'APPROVE' ? `Your return for order ${o?.n} was approved. Your refund is being processed.` : `Your return for order ${o?.n} was declined.${note ? ' ' + note : ''}`,
      link: '/account',
    });
  }

  /** Runs inside resolveReturn's transaction. Refund first, then the parcel, so the refund can't be pre-empted by the order-closing refund. */
  private static async approveItemReturn(tx: DbClient, returnId: number, orderId: number, sellerOrderId: number, adminUserId: number) {
    const [parcel] = await tx.select().from(sellerOrders).where(eq(sellerOrders.id, sellerOrderId)).for('update');
    if (!parcel) throw new Error('The seller parcel for this return no longer exists.');
    if (parcel.status !== 'DELIVERED') throw new Error('This parcel is no longer in a delivered state, so the return cannot be approved. Decline it instead.');

    const mine = await tx.select().from(returnItems).where(eq(returnItems.returnRequestId, returnId));
    const sum = (k: 'refundAmount' | 'commissionAmount' | 'sellerEarning' | 'lineAmount') => mine.reduce((a, i) => a + i[k], 0);
    const refundRupees = sum('refundAmount');

    // 1. Refund exactly the returned items against the paid online payment(s). COD has none.
    let remaining = rupeesToPaise(refundRupees);
    if (remaining > 0) {
      const paid = await tx.select().from(payments).where(and(eq(payments.orderId, orderId), eq(payments.status, 'PAID'))).for('update');
      for (const p of paid) {
        if (remaining <= 0) break;
        const plan = planRefund(toPaymentRecord(p), null);
        if (!plan.ok) continue;
        const amount = Math.min(remaining, plan.amount);
        await insertRefundTx(tx, {
          paymentId: p.id, amount, reason: 'ORDER_RETURNED', source: 'SYSTEM',
          idempotencyKey: `sys:return:r${returnId}:p${p.id}`, note: `Return request #${returnId}`, initiatedBy: adminUserId,
        });
        remaining -= amount;
      }
      if (paid.length > 0 && remaining > 0) throw new Error('The refund for this return exceeds what is still refundable on the payment.');
    }

    // 2. Is the whole parcel now returned? (approved returns on this parcel + this one)
    const lines = await tx.select({ id: orderItems.id, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.sellerOrderId, sellerOrderId));
    const approved = await tx
      .select({ orderItemId: returnItems.orderItemId, qty: sql<number>`COALESCE(SUM(${returnItems.quantity}), 0)::int` })
      .from(returnItems).innerJoin(returnRequests, eq(returnItems.returnRequestId, returnRequests.id))
      .where(and(eq(returnRequests.sellerOrderId, sellerOrderId), eq(returnRequests.status, 'APPROVED')))
      .groupBy(returnItems.orderItemId);
    const approvedBy = new Map(approved.map((a) => [a.orderItemId, a.qty]));
    for (const m of mine) approvedBy.set(m.orderItemId, (approvedBy.get(m.orderItemId) ?? 0) + m.quantity);
    const whole = coversWholeParcel(lines.map((l) => ({ quantity: l.quantity, approvedReturned: approvedBy.get(l.id) ?? 0 })));

    if (whole) {
      // Parcel -> RETURNED voids/claws back its earnings and, if every parcel
      // has now ended, queues the refund of whatever is left (e.g. delivery fee).
      await transitionSellerOrder(tx, sellerOrderId, 'RETURNED', { type: 'ADMIN', userId: adminUserId });
    } else if (parcel.settlementStatus === 'UNSETTLED') {
      // Not paid out yet: just shrink what the seller will earn on this parcel.
      await tx.update(sellerOrders).set({
        subtotal: sql`GREATEST(${sellerOrders.subtotal} - ${sum('lineAmount')}, 0)`,
        commissionAmount: sql`GREATEST(${sellerOrders.commissionAmount} - ${sum('commissionAmount')}, 0)`,
        sellerEarning: sql`GREATEST(${sellerOrders.sellerEarning} - ${sum('sellerEarning')}, 0)`,
        updatedAt: new Date(),
      }).where(eq(sellerOrders.id, sellerOrderId));
    } else if ((parcel.settlementStatus === 'PAID' || parcel.settlementStatus === 'IN_PAYOUT') && sum('sellerEarning') > 0) {
      // Already paid (or in flight): claw back this slice from the next payout.
      await tx.insert(sellerAdjustments).values({
        sellerId: parcel.sellerId, sellerOrderId, type: 'RETURN_CLAWBACK', amount: -sum('sellerEarning'),
        reason: `Partial return #${returnId} on a parcel whose earnings were already paid out.`,
      });
    }
  }
}

const LIVE_RETURN_STATUSES = ['REQUESTED', 'APPROVED'] as const;

interface ParcelLine extends ReturnableLine {
  productName: string;
  variantName: string | null;
  parcelStatus: string;
  deliveredAt: Date | null;
}
