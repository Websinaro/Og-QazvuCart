/** Single source of truth for the delivery charge, charged on the cart/order subtotal (₹). */
export const FREE_DELIVERY_THRESHOLD = 999;
export const STANDARD_DELIVERY_FEE = 49;
export const SMALL_ORDER_LIMIT = 100;
export const SMALL_ORDER_DELIVERY_FEE = 69;

export function computeDeliveryFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  if (subtotal < SMALL_ORDER_LIMIT) return SMALL_ORDER_DELIVERY_FEE;
  return STANDARD_DELIVERY_FEE;
}
