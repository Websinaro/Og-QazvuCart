import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { PaymentService } from '@/src/server/modules/payments/paymentService';
import { paymentErrorResponse } from '@/src/lib/paymentHttp';

/**
 * Server-authoritative payment status for one of the caller's orders, plus
 * whether a retry is possible. The UI polls this after a payment attempt
 * instead of trusting the Checkout callback.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return apiError('UNAUTHORIZED', 'Please log in to continue', 401);

  const orderId = Number(req.nextUrl.searchParams.get('orderId'));
  if (!Number.isInteger(orderId) || orderId <= 0) return apiError('VALIDATION_ERROR', 'A valid orderId is required', 422);

  try {
    return apiSuccess(await PaymentService.getPaymentStatus(authUser.userId, orderId));
  } catch (err) {
    return paymentErrorResponse(err, 'PAYMENT_STATUS_FAILED', 'Could not load payment status');
  }
}
