import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { PaymentService } from '@/src/server/modules/payments/paymentService';
import { razorpayEnv } from '@/src/lib/env';
import { paymentErrorResponse } from '@/src/lib/paymentHttp';

/**
 * Creates (or reuses / retries) a Razorpay order for an existing internal
 * order that this user owns. This is also the "retry payment" endpoint: after
 * a failed attempt, calling it again opens a fresh attempt (up to a limit,
 * within the payment window). The amount is ALWAYS the server-side order
 * total — nothing in the request body can change it. Returns only what the
 * browser's Razorpay Checkout needs; the key SECRET never leaves the server.
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json().catch(() => ({}));
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
      attemptNo: result.attemptNo,
      razorpayKeyId: razorpayEnv.keyId,
    });
  } catch (err) {
    return paymentErrorResponse(err, 'PAYMENT_CREATE_FAILED', 'Failed to create payment');
  }
}
