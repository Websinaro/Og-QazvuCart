import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { PaymentService } from '@/src/server/modules/payments/paymentService';
import { razorpayEnv } from '@/src/lib/env';

/**
 * Creates (or reuses) a Razorpay order for an existing internal order that
 * this user owns. Returns only what the browser's Razorpay Checkout
 * widget needs: the Razorpay order id, amount, currency, and the PUBLIC
 * key id. The key SECRET never leaves the server.
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const orderId = Number(body.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return apiError('VALIDATION_ERROR', 'A valid orderId is required', 422);
    }

    const result = await PaymentService.createPaymentForOrder(authUser.userId, orderId);

    return apiSuccess({
      razorpayOrderId: result.razorpayOrderId,
      amount: result.amount,
      currency: result.currency,
      orderNumber: result.orderNumber,
      razorpayKeyId: razorpayEnv.keyId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create payment';
    // Razorpay/env misconfiguration surfaces here as a thrown error from
    // razorpayEnv's fail-fast getters — report it as a service outage
    // rather than a generic 400, and never fake a successful order.
    if (message.includes('is required. Set it in your environment')) {
      return apiError('PAYMENT_SERVICE_UNAVAILABLE', 'Payment service unavailable', 503);
    }
    return apiError('PAYMENT_CREATE_FAILED', message, 400);
  }
}
