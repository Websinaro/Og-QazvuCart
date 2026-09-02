import { OrderStatus } from '@/src/db/schema';

/**
 * Explicit allow-list of transitions. Any pair not listed here is rejected,
 * so e.g. DELIVERED -> PROCESSING is always invalid regardless of caller.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PROCESSING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export function isValidOrderStatus(value: string): value is OrderStatus {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TRANSITIONS, value);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: string, to: string): asserts to is OrderStatus {
  if (!isValidOrderStatus(to)) {
    throw new Error(`"${to}" is not a valid order status.`);
  }
  if (!isValidOrderStatus(from)) {
    throw new Error(`"${from}" is not a valid order status.`);
  }
  if (!canTransition(from, to)) {
    throw new Error(`Cannot move an order from ${from} to ${to}.`);
  }
}
