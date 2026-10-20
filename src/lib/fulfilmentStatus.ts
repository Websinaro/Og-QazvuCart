/**
 * Pure helpers for multi-seller fulfilment status. A customer order is one
 * row, but each seller ships their own parcel, so the customer-facing order
 * status is *derived* from the parcels' statuses.
 */
import type { OrderStatus } from '@/src/db/schema';

const PROGRESS: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PROCESSING',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

const rank = (s: string) => PROGRESS.indexOf(s as OrderStatus);

/** Statuses a seller may move their own parcel into. RETURNED is admin-only. */
export const SELLER_ALLOWED_TARGETS: OrderStatus[] = ['PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

/** Parcel states from which a customer may still cancel (nothing has left the warehouse). */
export const CUSTOMER_CANCELLABLE: string[] = ['PENDING_PAYMENT', 'PROCESSING', 'CONFIRMED', 'PACKED'];

/**
 * Derives the customer-facing order status from its parcels:
 *  - ignore cancelled/returned parcels while any parcel is still live
 *  - the order is only as far along as its *least* advanced live parcel
 *  - nothing live: CANCELLED if all cancelled, otherwise RETURNED
 * Returns null when there are no parcels.
 */
export function aggregateOrderStatus(parcelStatuses: string[]): OrderStatus | null {
  if (parcelStatuses.length === 0) return null;
  const live = parcelStatuses.filter((s) => s !== 'CANCELLED' && s !== 'RETURNED');
  if (live.length === 0) {
    return parcelStatuses.some((s) => s === 'RETURNED') ? 'RETURNED' : 'CANCELLED';
  }
  let min = live[0];
  for (const s of live) {
    if (rank(s) < rank(min)) min = s;
  }
  return min as OrderStatus;
}

/** Customer cancellation is only allowed while every live parcel is pre-dispatch. */
export function canCustomerCancel(parcelStatuses: string[]): boolean {
  const live = parcelStatuses.filter((s) => s !== 'CANCELLED' && s !== 'RETURNED');
  return live.length > 0 && live.every((s) => CUSTOMER_CANCELLABLE.includes(s));
}
