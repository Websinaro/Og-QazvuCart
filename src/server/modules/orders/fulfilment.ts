/**
 * Multi-vendor fulfilment core.
 *
 * A customer order is one `orders` row, but every seller fulfils their own
 * "parcel" (`seller_orders` row). This module is the single place that:
 *   - moves a parcel through the order state machine (seller OR admin),
 *   - applies the side effects (restock on cancel, earnings void/clawback),
 *   - re-derives the customer-facing order status from its parcels.
 *
 * Everything takes a transaction handle so callers keep one atomic unit.
 * It deliberately does NOT import OrderService (OrderService imports this).
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { PgTransaction, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { db } from '@/src/db';
import * as schema from '@/src/db/schema';
import {
  orders,
  orderItems,
  orderTimeline,
  sellerOrders,
  sellerAdjustments,
  sellers,
  couponRedemptions,
  coupons,
} from '@/src/db/schema';
import { InventoryService } from './inventory';
import { assertValidTransition } from '@/src/lib/orderStateMachine';
import { aggregateOrderStatus, SELLER_ALLOWED_TARGETS } from '@/src/lib/fulfilmentStatus';
import { NotificationService } from '../notifications/notificationService';
import { enqueueRefundsForClosedOrder } from '../payments/refundLedger';

export type DbClient =
  | typeof db
  | PgTransaction<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export type FulfilmentActor =
  | { type: 'SELLER'; sellerId: number }
  | { type: 'ADMIN'; userId: number };

/** Thrown for "this id doesn't exist / isn't yours" so routes can return 404, not 400. */
export class NotFoundError extends Error {}

const STAGE_TITLES: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
};

/**
 * If this order redeemed a coupon, undoes it (removes the redemption row and
 * frees one use). Called from every path that fully cancels an order.
 */
export async function releaseCouponRedemption(tx: DbClient, orderId: number) {
  const [redemption] = await tx
    .select({ id: couponRedemptions.id, couponId: couponRedemptions.couponId })
    .from(couponRedemptions)
    .where(eq(couponRedemptions.orderId, orderId))
    .limit(1);

  if (!redemption) return;

  await tx.delete(couponRedemptions).where(eq(couponRedemptions.id, redemption.id));
  await tx
    .update(coupons)
    .set({ usedCount: sql`GREATEST(${coupons.usedCount} - 1, 0)` })
    .where(eq(coupons.id, redemption.couponId));
}

/**
 * Re-derives `orders.status` from the parcels and, if it changed, records a
 * customer-visible timeline event. Safe to call repeatedly (no-op if unchanged).
 */
export async function recomputeOrderStatus(tx: DbClient, orderId: number) {
  const parcels = await tx.select({ status: sellerOrders.status }).from(sellerOrders).where(eq(sellerOrders.orderId, orderId));
  const next = aggregateOrderStatus(parcels.map((p) => p.status));
  if (!next) return;

  const [order] = await tx
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .for('update');
  if (!order || order.status === next) return;

  const updates: Partial<typeof orders.$inferInsert> = { status: next, updatedAt: new Date() };
  if (next === 'DELIVERED') updates.paymentStatus = 'PAID';

  await tx.update(orders).set(updates).where(eq(orders.id, orderId));

  if (next === 'CANCELLED') {
    await releaseCouponRedemption(tx, orderId);
  }

  // The whole order has ended (every parcel cancelled, or returned): whatever
  // the customer paid online and has not already had back is refunded. The
  // refund row commits with this status change; the gateway call is made
  // after commit by the caller (kickPendingRefunds) or the maintenance job.
  if (next === 'CANCELLED' || next === 'RETURNED') {
    await enqueueRefundsForClosedOrder(tx, orderId, next === 'CANCELLED' ? 'cancel' : 'return');
  }

  await tx.insert(orderTimeline).values({
    orderId,
    status: next,
    title: STAGE_TITLES[next] || next,
    description: `Order status updated to ${next}.`,
    completed: true,
  });
}

export interface TransitionOptions {
  carrier?: string | null;
  trackingNumber?: string | null;
}

/**
 * Moves ONE parcel to `next`.
 *
 * Ownership: for a SELLER actor the parcel must belong to that seller — any
 * other id is reported as "not found" (never "forbidden", so ids don't leak).
 */
export async function transitionSellerOrder(
  tx: DbClient,
  sellerOrderId: number,
  next: string,
  actor: FulfilmentActor,
  opts: TransitionOptions = {}
) {
  const [parcel] = await tx
    .select()
    .from(sellerOrders)
    .where(eq(sellerOrders.id, sellerOrderId))
    .for('update');

  if (!parcel || (actor.type === 'SELLER' && parcel.sellerId !== actor.sellerId)) {
    throw new NotFoundError('Order not found');
  }

  const [order] = await tx
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, paymentStatus: orders.paymentStatus, paymentMethod: orders.paymentMethod })
    .from(orders)
    .where(eq(orders.id, parcel.orderId))
    .limit(1);
  if (!order) throw new NotFoundError('Order not found');

  if (actor.type === 'SELLER') {
    if (!SELLER_ALLOWED_TARGETS.includes(next as (typeof SELLER_ALLOWED_TARGETS)[number])) {
      throw new Error(`Sellers cannot set an order to ${next}. Contact support for returns.`);
    }
    const paymentOk = order.paymentMethod === 'COD' || order.paymentStatus === 'PAID';
    if (parcel.status === 'PENDING_PAYMENT' || parcel.status === 'PROCESSING' || !paymentOk) {
      throw new Error('Payment for this order has not been confirmed yet, so it cannot be fulfilled.');
    }
  }

  assertValidTransition(parcel.status, next);

  const now = new Date();
  const patch: Partial<typeof sellerOrders.$inferInsert> = { status: next, updatedAt: now };
  if (opts.carrier !== undefined) patch.carrier = opts.carrier ? opts.carrier.trim() : null;
  if (opts.trackingNumber !== undefined) patch.trackingNumber = opts.trackingNumber ? opts.trackingNumber.trim() : null;

  if (next === 'DELIVERED') patch.deliveredAt = now;

  if (next === 'CANCELLED') {
    patch.cancelledAt = now;
    // Nothing is owed on a cancelled parcel (legacy rows stay legacy).
    if (parcel.settlementStatus === 'UNSETTLED') patch.settlementStatus = 'VOID';
  }

  if (next === 'RETURNED') {
    patch.returnedAt = now;
    if (parcel.settlementStatus === 'UNSETTLED') {
      patch.settlementStatus = 'VOID';
    } else if (
      (parcel.settlementStatus === 'PAID' || parcel.settlementStatus === 'IN_PAYOUT') &&
      parcel.sellerEarning > 0
    ) {
      // Money already paid (or in flight): claw it back from the next payout.
      await tx.insert(sellerAdjustments).values({
        sellerId: parcel.sellerId,
        sellerOrderId: parcel.id,
        type: 'RETURN_CLAWBACK',
        amount: -parcel.sellerEarning,
        reason: `Order ${order.orderNumber} was returned after its earnings were paid out.`,
      });
    }
  }

  await tx.update(sellerOrders).set(patch).where(eq(sellerOrders.id, parcel.id));

  if (next === 'CANCELLED') {
    await InventoryService.releaseParcel(tx, parcel.id);
  }

  await recomputeOrderStatus(tx, parcel.orderId);

  const [updated] = await tx.select().from(sellerOrders).where(eq(sellerOrders.id, parcel.id)).limit(1);
  return updated;
}

/** markOrderPaid: payment verified, so every waiting parcel becomes fulfillable. */
export async function confirmParcelsForOrder(tx: DbClient, orderId: number) {
  await tx
    .update(sellerOrders)
    .set({ status: 'CONFIRMED', updatedAt: new Date() })
    .where(and(eq(sellerOrders.orderId, orderId), inArray(sellerOrders.status, ['PENDING_PAYMENT', 'PROCESSING'])));
}

/**
 * Whole-order cancellation paths (payment failed / reservation expired /
 * customer cancel) already restock at order level, so this only flips the
 * parcels and voids their earnings — no second restock.
 */
export async function voidParcelsForOrder(tx: DbClient, orderId: number) {
  const now = new Date();
  await tx
    .update(sellerOrders)
    .set({
      status: 'CANCELLED',
      cancelledAt: now,
      updatedAt: now,
      settlementStatus: sql`CASE WHEN ${sellerOrders.settlementStatus} = 'LEGACY' THEN 'LEGACY' ELSE 'VOID' END`,
    })
    .where(
      and(
        eq(sellerOrders.orderId, orderId),
        inArray(sellerOrders.status, ['PENDING_PAYMENT', 'PROCESSING', 'CONFIRMED', 'PACKED'])
      )
    );
}

/** Tells each seller on the order that they have a new parcel to fulfil. Best-effort, post-commit. */
export async function notifySellersOfNewOrder(orderId: number) {
  try {
    const rows = await db
      .select({
        userId: sellers.userId,
        orderNumber: orders.orderNumber,
        subtotal: sellerOrders.subtotal,
        earning: sellerOrders.sellerEarning,
        itemCount: sql<number>`(SELECT COALESCE(SUM(${orderItems.quantity}), 0)::int FROM ${orderItems} WHERE ${orderItems.sellerOrderId} = ${sellerOrders.id})`,
      })
      .from(sellerOrders)
      .innerJoin(sellers, eq(sellerOrders.sellerId, sellers.id))
      .innerJoin(orders, eq(sellerOrders.orderId, orders.id))
      .where(eq(sellerOrders.orderId, orderId));

    await Promise.all(
      rows.map((r) =>
        NotificationService.notifyUser(r.userId, {
          type: 'ORDER',
          title: 'New order to fulfil',
          body: `Order ${r.orderNumber}: ${r.itemCount} item(s), ₹${r.subtotal} sales (₹${r.earning} after commission).`,
          link: '/seller-center?tab=orders',
        })
      )
    );
  } catch (err) {
    console.error('[fulfilment] notifySellersOfNewOrder failed:', err);
  }
}
