import { apiError } from './response';
import { PaymentError, RefundError } from '@/src/server/modules/payments/paymentService';

const REFUND_STATUS: Record<string, number> = {
  PAYMENT_NOT_FOUND: 404, NOT_REFUNDABLE: 409, NOTHING_TO_REFUND: 409, EXCEEDS_REFUNDABLE: 409,
  IDEMPOTENCY_KEY_REUSED: 409, INVALID_AMOUNT: 422,
};

/** Maps payment-domain errors onto HTTP; anything unexpected becomes `fallbackCode` / 400 (or 503 when Razorpay isn't configured). */
export function paymentErrorResponse(err: unknown, fallbackCode: string, fallbackMessage: string) {
  if (err instanceof PaymentError) return apiError(err.code, err.message, err.httpStatus);
  if (err instanceof RefundError) return apiError(err.code, err.message, REFUND_STATUS[err.code] ?? 400, { refundableAmount: err.refundable / 100 });
  const message = err instanceof Error ? err.message : fallbackMessage;
  // Razorpay/env misconfiguration (fail-fast getters) is a service outage, not a client error.
  if (message.includes('is required. Set it in your environment')) return apiError('PAYMENT_SERVICE_UNAVAILABLE', 'Payment service unavailable', 503);
  if (/^Razorpay /.test(message)) { console.error('[payments]', message); return apiError('PAYMENT_GATEWAY_ERROR', 'The payment gateway is temporarily unavailable. Please try again.', 502); }
  return apiError(fallbackCode, message, 400);
}
