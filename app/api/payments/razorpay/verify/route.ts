import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { PaymentService } from '@/src/server/modules/payments/paymentService';

/**
 * Called by the browser after Razorpay Checkout's `handler` callback
 * fires with a payment response. This is a convenience/fast-path for the
 * UI — the webhook (see ../webhook/route.ts) is the authoritative source
 * of truth and will independently confirm the same payment even if this
 * call never happens (e.g. the tab closed right after paying).
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  try {
    const body = await req.json();
    const orderId = Number(body.orderId);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!Number.isInteger(orderId) || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
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
    const message = err instanceof Error ? err.message : 'Payment verification failed';
    return apiError('PAYMENT_VERIFY_FAILED', message, 400);
  }
}
