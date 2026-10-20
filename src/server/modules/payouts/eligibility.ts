import { sql } from 'drizzle-orm';
import { orders, sellerOrders } from '@/src/db/schema';

/**
 * The single definition of "this parcel's earnings can be paid out now".
 * Used by the earnings dashboards AND by payout creation, so what a seller
 * sees as "available" is exactly what an admin can settle.
 *
 * A parcel is payable when it is:
 *   - DELIVERED, and still unsettled,
 *   - past the return-window hold (platform setting `payout_hold_days`),
 *   - paid for: online payment captured, or Cash on Delivery (collected at the door).
 *
 * Requires `orders` to be joined to `seller_orders`.
 */
export function payableCondition(holdDays: number) {
  return sql`(
    ${sellerOrders.status} = 'DELIVERED'
    AND ${sellerOrders.settlementStatus} = 'UNSETTLED'
    AND ${sellerOrders.deliveredAt} IS NOT NULL
    AND ${sellerOrders.deliveredAt} <= NOW() - (${holdDays}::int * INTERVAL '1 day')
    AND (${orders.paymentStatus} = 'PAID' OR ${orders.paymentMethod} = 'COD')
  )`;
}

/** Earned and still in progress: not delivered yet, not cancelled/returned. */
export function inFulfilmentCondition() {
  return sql`(
    ${sellerOrders.settlementStatus} = 'UNSETTLED'
    AND ${sellerOrders.status} NOT IN ('DELIVERED', 'CANCELLED', 'RETURNED')
  )`;
}
