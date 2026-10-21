import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { orders, orderTimeline, orderItems, returnRequests, sellerOrders, sellers, users, refunds } from '@/src/db/schema';
import { NotificationService } from '../notifications/notificationService';
import { OrderService } from './orderService';

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

  /** Refund progress + return request + eligibility, shown in the customer's tracking panel. */
  static async getExtras(orderId: number, orderStatus: string) {
    const [returnRequest] = await db.select().from(returnRequests).where(eq(returnRequests.orderId, orderId)).orderBy(desc(returnRequests.id)).limit(1);
    const refundRows = await db
      .select({ amount: refunds.amount, status: refunds.status, createdAt: refunds.createdAt, processedAt: refunds.processedAt })
      .from(refunds).where(eq(refunds.orderId, orderId)).orderBy(desc(refunds.id));
    const [d] = await db
      .select({ at: sellerOrders.deliveredAt }).from(sellerOrders)
      .where(and(eq(sellerOrders.orderId, orderId), eq(sellerOrders.status, 'DELIVERED'))).orderBy(desc(sellerOrders.deliveredAt)).limit(1);
    const deadline = d?.at ? new Date(d.at.getTime() + RETURN_WINDOW_DAYS * 86400000) : null;
    const live = returnRequest && returnRequest.status !== 'REJECTED';
    return {
      returnRequest: returnRequest
        ? { id: returnRequest.id, status: returnRequest.status, reason: returnRequest.reason, adminNote: returnRequest.adminNote, createdAt: returnRequest.createdAt.toISOString() }
        : null,
      refunds: refundRows.map((r) => ({ amount: r.amount, status: r.status, createdAt: r.createdAt.toISOString(), processedAt: r.processedAt?.toISOString() ?? null })),
      returnEligibleUntil: orderStatus === 'DELIVERED' && deadline && !live && deadline > new Date() ? deadline.toISOString() : null,
    };
  }

  static async requestReturn(userId: number, orderId: number, reason: string, details?: string) {
    if (!(RETURN_REASONS as readonly string[]).includes(reason)) throw new Error('Please choose a valid return reason.');
    const [o] = await db.select({ id: orders.id, status: orders.status, orderNumber: orders.orderNumber }).from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
    if (!o) throw new Error('Order not found');
    if (o.status !== 'DELIVERED') throw new Error('Only delivered orders can be returned.');
    const extras = await this.getExtras(orderId, o.status);
    if (!extras.returnEligibleUntil) throw new Error(extras.returnRequest && extras.returnRequest.status !== 'REJECTED' ? 'A return was already requested for this order.' : `The ${RETURN_WINDOW_DAYS}-day return window has closed.`);
    try {
      await db.insert(returnRequests).values({ orderId, userId, reason, details: details?.slice(0, 1000) || null });
    } catch {
      throw new Error('A return was already requested for this order.');
    }
    await db.insert(orderTimeline).values({ orderId, status: 'RETURN_REQUESTED', title: 'Return Requested', description: 'We are reviewing your return request.', completed: true });
    await NotificationService.notifyUser(userId, { type: 'ORDER', title: `Return requested`, body: `We received your return request for order ${o.orderNumber} and will review it shortly.`, link: '/account' });
    return this.getExtras(orderId, o.status);
  }

  static async listReturns(status?: string) {
    const rows = await db
      .select({
        id: returnRequests.id, orderId: returnRequests.orderId, orderNumber: orders.orderNumber, total: orders.total,
        customer: users.email, reason: returnRequests.reason, details: returnRequests.details,
        status: returnRequests.status, adminNote: returnRequests.adminNote, createdAt: returnRequests.createdAt,
      })
      .from(returnRequests).innerJoin(orders, eq(returnRequests.orderId, orders.id)).innerJoin(users, eq(returnRequests.userId, users.id))
      .where(status ? eq(returnRequests.status, status) : undefined)
      .orderBy(desc(returnRequests.id)).limit(100);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  /** Approve = order goes DELIVERED -> RETURNED through the state machine, which also queues the refund. */
  static async resolveReturn(adminUserId: number, id: number, decision: 'APPROVE' | 'REJECT', note?: string) {
    const [r] = await db.select().from(returnRequests).where(eq(returnRequests.id, id)).limit(1);
    if (!r) throw new Error('Return request not found');
    if (r.status !== 'REQUESTED') throw new Error('This request has already been resolved.');
    if (decision === 'APPROVE') await OrderService.adminUpdateStatus(r.orderId, 'RETURNED', adminUserId);
    await db.update(returnRequests).set({
      status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', adminNote: note?.slice(0, 500) || null, resolvedBy: adminUserId, resolvedAt: new Date(),
    }).where(eq(returnRequests.id, id));
    const [o] = await db.select({ n: orders.orderNumber }).from(orders).where(eq(orders.id, r.orderId)).limit(1);
    await NotificationService.notifyUser(r.userId, {
      type: 'ORDER', title: `Return ${decision === 'APPROVE' ? 'approved' : 'declined'}`,
      body: decision === 'APPROVE' ? `Your return for order ${o?.n} was approved. Your refund is being processed.` : `Your return for order ${o?.n} was declined.${note ? ' ' + note : ''}`,
      link: '/account',
    });
  }
}
void orderItems; void sellers;
