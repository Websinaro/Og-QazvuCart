/**
 * Pure rules for item-level returns (no DB access, unit-tested).
 *
 * Money is whole rupees. Every amount is prorated CUMULATIVELY: the amount
 * for returning units (before, before+qty] is f(before+qty) - f(before), so
 * however a line is split across several returns, the pieces add up to
 * exactly the line's value and never drift by rounding.
 */

export interface ReturnableLine {
  orderItemId: number;
  sellerOrderId: number;
  quantity: number;
  totalPrice: number;       // line value before coupon
  commissionAmount: number; // seller commission on the whole line
  sellerEarning: number;    // seller earning on the whole line
  /** Units already in a live (REQUESTED or APPROVED) return. */
  liveReturned: number;
}

export interface ReturnPricing {
  lineAmount: number;
  refundAmount: number;
  commissionAmount: number;
  sellerEarning: number;
}

const prorate = (amount: number, qty: number, of: number) => Math.floor((amount * qty) / of);

/** What the customer actually paid for a whole line: its value less its pro-rata share of the order coupon. */
export function lineNetOfCoupon(totalPrice: number, orderDiscount: number, orderSubtotal: number): number {
  if (orderDiscount <= 0 || orderSubtotal <= 0) return totalPrice;
  return totalPrice - Math.min(totalPrice, Math.floor((orderDiscount * totalPrice) / orderSubtotal));
}

export function remainingReturnable(line: Pick<ReturnableLine, 'quantity' | 'liveReturned'>): number {
  return Math.max(0, line.quantity - line.liveReturned);
}

export function priceReturn(
  line: ReturnableLine,
  qty: number,
  order: { discount: number; subtotal: number },
): ReturnPricing {
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Return quantity must be a positive whole number.');
  if (qty > remainingReturnable(line)) throw new Error('You cannot return more units than were ordered.');
  const before = line.liveReturned;
  const after = before + qty;
  const net = lineNetOfCoupon(line.totalPrice, order.discount, order.subtotal);
  const diff = (amount: number) => prorate(amount, after, line.quantity) - prorate(amount, before, line.quantity);
  return {
    lineAmount: diff(line.totalPrice),
    refundAmount: diff(net),
    commissionAmount: diff(line.commissionAmount),
    sellerEarning: diff(line.sellerEarning),
  };
}

/** True when approved returns now cover every unit of every line in the parcel. */
export function coversWholeParcel(lines: Array<{ quantity: number; approvedReturned: number }>): boolean {
  return lines.length > 0 && lines.every((l) => l.approvedReturned >= l.quantity);
}

/** Last day a parcel delivered at `deliveredAt` may still be returned. */
export function returnDeadline(deliveredAt: Date, windowDays: number): Date {
  return new Date(deliveredAt.getTime() + windowDays * 86400000);
}
