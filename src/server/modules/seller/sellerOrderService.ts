import { and, desc, eq, inArray, sql, SQL } from 'drizzle-orm';
import { db } from '@/src/db';
import { orders, orderItems, sellerOrders, questions, answers, products, users } from '@/src/db/schema';
import { NotFoundError, transitionSellerOrder } from '../orders/fulfilment';
import { QuestionService } from '../questions/questionService';
import { kickPendingRefunds } from '../payments/kickRefunds';
import { isDelhiveryConfigured } from '@/src/lib/delhivery';
import { DelhiveryService } from '../orders/delhiveryService';
import { OrderTrackingService } from '../orders/orderTrackingService';

/** Parcel states in which the buyer's address is needed (or still relevant). */
const ADDRESS_HIDDEN_STATUSES = ['PENDING_PAYMENT', 'PROCESSING', 'CANCELLED'];
const TRACKING_EDITABLE_STATUSES = ['CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'];

export class SellerOrderService {
  /**
   * Parcels for ONE seller (always filtered by sellerId). Only this seller's
   * line items are ever returned — never other sellers' items on the same order.
   */
  private static async fetchParcels(sellerId: number, extra: SQL[], limit: number, offset: number) {
    const where = and(eq(sellerOrders.sellerId, sellerId), ...extra);

    const rows = await db
      .select({
        id: sellerOrders.id,
        orderId: sellerOrders.orderId,
        orderNumber: orders.orderNumber,
        orderDate: orders.createdAt,
        status: sellerOrders.status,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        subtotal: sellerOrders.subtotal,
        commissionAmount: sellerOrders.commissionAmount,
        sellerEarning: sellerOrders.sellerEarning,
        carrier: sellerOrders.carrier,
        trackingNumber: sellerOrders.trackingNumber,
        settlementStatus: sellerOrders.settlementStatus,
        deliveredAt: sellerOrders.deliveredAt,
        updatedAt: sellerOrders.updatedAt,
        estimatedDeliveryDate: orders.estimatedDeliveryDate,
        shippingAddress: orders.shippingAddressSnapshot,
      })
      .from(sellerOrders)
      .innerJoin(orders, eq(sellerOrders.orderId, orders.id))
      .where(where)
      .orderBy(desc(sellerOrders.id))
      .limit(limit)
      .offset(offset);

    const ids = rows.map((r) => r.id);
    const items = ids.length
      ? await db
          .select({
            id: orderItems.id,
            sellerOrderId: orderItems.sellerOrderId,
            productId: orderItems.productId,
            productName: orderItems.productName,
            productImage: orderItems.productImage,
            variantName: orderItems.variantName,
            unitPrice: orderItems.unitPrice,
            quantity: orderItems.quantity,
            totalPrice: orderItems.totalPrice,
            commissionBps: orderItems.commissionBps,
            commissionAmount: orderItems.commissionAmount,
            sellerEarning: orderItems.sellerEarning,
          })
          .from(orderItems)
          // Belt and braces: restrict by seller_id as well as the parcel id.
          .where(and(inArray(orderItems.sellerOrderId, ids), eq(orderItems.sellerId, sellerId)))
      : [];

    return rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      orderDate: r.orderDate.toISOString(),
      status: r.status,
      paymentMethod: r.paymentMethod,
      paymentStatus: r.paymentStatus,
      subtotal: r.subtotal,
      commissionAmount: r.commissionAmount,
      sellerEarning: r.sellerEarning,
      carrier: r.carrier,
      trackingNumber: r.trackingNumber,
      settlementStatus: r.settlementStatus,
      deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
      updatedAt: r.updatedAt.toISOString(),
      estimatedDeliveryDate: r.estimatedDeliveryDate,
      // The buyer's name/phone/address is only shared once the parcel is fulfillable.
      shippingAddress: ADDRESS_HIDDEN_STATUSES.includes(r.status) ? null : r.shippingAddress,
      items: items.filter((i) => i.sellerOrderId === r.id).map(({ sellerOrderId: _s, ...i }) => i),
    }));
  }

  static async list(sellerId: number, params: { status?: string; q?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const extra: SQL[] = [];
    if (params.status && params.status !== 'ALL') extra.push(eq(sellerOrders.status, params.status.toUpperCase()));
    if (params.q && params.q.trim()) {
      extra.push(sql`${orders.orderNumber} ILIKE ${'%' + params.q.trim() + '%'}`);
    }

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sellerOrders)
      .innerJoin(orders, eq(sellerOrders.orderId, orders.id))
      .where(and(eq(sellerOrders.sellerId, sellerId), ...extra));

    const [parcels, statusCounts] = await Promise.all([
      this.fetchParcels(sellerId, extra, limit, offset),
      db
        .select({ status: sellerOrders.status, count: sql<number>`count(*)::int` })
        .from(sellerOrders)
        .where(eq(sellerOrders.sellerId, sellerId))
        .groupBy(sellerOrders.status),
    ]);

    return {
      orders: parcels,
      counts: Object.fromEntries(statusCounts.map((c) => [c.status, c.count])) as Record<string, number>,
      pagination: { total: totalRows[0]?.count ?? 0, page, limit, totalPages: Math.ceil((totalRows[0]?.count ?? 0) / limit) || 1 },
    };
  }

  static async get(sellerId: number, sellerOrderId: number) {
    const [parcel] = await this.fetchParcels(sellerId, [eq(sellerOrders.id, sellerOrderId)], 1, 0);
    if (!parcel) throw new NotFoundError('Order not found');
    return parcel;
  }

  /** Status change and/or tracking details for one of the seller's own parcels. */
  static async update(
    sellerId: number,
    sellerOrderId: number,
    input: { status?: string; carrier?: string; trackingNumber?: string }
  ) {
    // Delhivery books the shipment and supplies the waybill (outside the DB transaction).
    if (input.status === 'SHIPPED' && !input.trackingNumber && isDelhiveryConfigured()) {
      const waybill = await DelhiveryService.createShipmentForParcel(sellerId, sellerOrderId);
      input = { ...input, carrier: 'Delhivery', trackingNumber: waybill };
    }
    await db.transaction(async (tx) => {
      if (input.status) {
        if (input.status === 'SHIPPED') {
          const [cur] = await tx.select({ c: sellerOrders.carrier, t: sellerOrders.trackingNumber }).from(sellerOrders).where(and(eq(sellerOrders.id, sellerOrderId), eq(sellerOrders.sellerId, sellerId)));
          const carrier = input.carrier ?? cur?.c;
          const tracking = input.trackingNumber ?? cur?.t;
          if (!carrier?.trim() || !tracking?.trim()) throw new Error('Add the carrier and tracking number before marking this order as shipped.');
        }
        await transitionSellerOrder(
          tx,
          sellerOrderId,
          input.status,
          { type: 'SELLER', sellerId },
          { carrier: input.carrier, trackingNumber: input.trackingNumber }
        );
        return;
      }

      // Tracking-only edit.
      const [parcel] = await tx
        .select({ id: sellerOrders.id, status: sellerOrders.status })
        .from(sellerOrders)
        .where(and(eq(sellerOrders.id, sellerOrderId), eq(sellerOrders.sellerId, sellerId)))
        .for('update');
      if (!parcel) throw new NotFoundError('Order not found');
      if (!TRACKING_EDITABLE_STATUSES.includes(parcel.status)) {
        throw new Error('Tracking can only be edited while the order is being fulfilled.');
      }
      await tx
        .update(sellerOrders)
        .set({
          carrier: input.carrier !== undefined ? input.carrier || null : undefined,
          trackingNumber: input.trackingNumber !== undefined ? input.trackingNumber || null : undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(sellerOrders.id, sellerOrderId), eq(sellerOrders.sellerId, sellerId)));
    });

    // A cancellation that ended the whole order queued a refund: send it now.
    if (input.status === 'CANCELLED') kickPendingRefunds();
    if (input.status) {
      const [p] = await db.select({ orderId: sellerOrders.orderId }).from(sellerOrders).where(eq(sellerOrders.id, sellerOrderId)).limit(1);
      if (p) void OrderTrackingService.notifyProgress(p.orderId, input.status, sellerOrderId);
    }

    return this.get(sellerId, sellerOrderId);
  }
}

export class SellerQuestionService {
  /** Customer questions on THIS seller's products only. */
  static async list(sellerId: number, params: { unansweredOnly?: boolean } = {}) {
    const rows = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        createdAt: questions.createdAt,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        askedBy: users.username,
        answerText: sql<string | null>`(SELECT ${answers.answerText} FROM ${answers} WHERE ${answers.questionId} = ${questions.id} AND ${answers.isSellerAnswer} = true ORDER BY ${answers.id} DESC LIMIT 1)`,
      })
      .from(questions)
      .innerJoin(products, eq(questions.productId, products.id))
      .innerJoin(users, eq(questions.userId, users.id))
      .where(
        and(
          eq(products.sellerId, sellerId),
          eq(questions.status, 'APPROVED'),
          params.unansweredOnly
            ? sql`NOT EXISTS (SELECT 1 FROM ${answers} WHERE ${answers.questionId} = ${questions.id} AND ${answers.isSellerAnswer} = true)`
            : undefined
        )
      )
      .orderBy(desc(questions.createdAt))
      .limit(200);

    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  static async answer(sellerId: number, sellerUserId: number, questionId: number, answerText: string) {
    // The question must be on one of this seller's products.
    const [q] = await db
      .select({ id: questions.id })
      .from(questions)
      .innerJoin(products, eq(questions.productId, products.id))
      .where(and(eq(questions.id, questionId), eq(products.sellerId, sellerId)))
      .limit(1);
    if (!q) throw new NotFoundError('Question not found');

    const [existing] = await db
      .select({ id: answers.id })
      .from(answers)
      .where(and(eq(answers.questionId, questionId), eq(answers.isSellerAnswer, true)))
      .limit(1);
    if (existing) throw new Error('You have already answered this question.');

    return QuestionService.answerQuestion(sellerUserId, questionId, answerText, true);
  }
}
