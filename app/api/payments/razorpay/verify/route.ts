import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { PaymentService } from '@/src/server/modules/payments/paymentService';
import { paymentErrorResponse } from '@/src/lib/paymentHttp';

/**
 * Called by the browser after Razorpay Checkout's `handler` callback fires.
 * A convenience/fast path only: the signature is checked first, Razorpay is
 * asked what really happened, and the same idempotent engine the webhook
 * uses applies it. The webhook confirms the payment independently even if
 * this call never happens (tab closed right after paying).
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const orderId = Number(body.orderId);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (
      !Number.isInteger(orderId) ||
      typeof razorpay_order_id !== 'string' || typeof razorpay_payment_id !== 'string' || typeof razorpay_signature !== 'string' ||
      !razorpay_order_id || !razorpay_payment_id || !razorpay_signature
    ) {
      return apiError('VALIDATION_ERROR', 'Missing payment verification fields', 422);
    }

    const result = await PaymentService.verifyPayment(authUser.userId, {
      orderId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    return apiSuccess(result);
  } catch (err) {
    return paymentErrorResponse(err, 'PAYMENT_VERIFY_FAILED', 'Payment verification failed');
  }
}
