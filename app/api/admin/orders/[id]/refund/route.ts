import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/src/lib/response';
import { getAuthUser } from '@/src/lib/auth';
import { PaymentService } from '@/src/server/modules/payments/paymentService';
import { PaymentAdminQueries } from '@/src/server/modules/payments/paymentAdminQueries';
import { paymentErrorResponse } from '@/src/lib/paymentHttp';

async function requireAdmin(req: NextRequest) {
  const u = await getAuthUser(req);
  if (!u) return { error: apiError('UNAUTHORIZED', 'Please log in to continue', 401) };
  if (u.role !== 'ADMIN') return { error: apiError('FORBIDDEN', 'Admin access required', 403) };
  return { user: u };
}

/** Payment attempts + refunds for an order (admin). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId) || orderId <= 0) return apiError('VALIDATION_ERROR', 'Invalid order id', 422);
  return apiSuccess(await PaymentAdminQueries.orderPayments(orderId));
}

/**
 * Issue a full or partial refund against the order's captured online payment.
 * Body: { amount?: number, note?: string } — amount is in whole rupees (max 2 decimals);
 * omit it to refund everything still refundable.
 * Header: Idempotency-Key (required) — re-sending the same request with the
 * same key returns the same refund and never pays out twice; the same key
 * with a different amount is rejected (409).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId) || orderId <= 0) return apiError('VALIDATION_ERROR', 'Invalid order id', 422);

  const key = req.headers.get('idempotency-key')?.trim();
  if (!key || key.length < 8 || key.length > 100) {
    return apiError('VALIDATION_ERROR', 'An Idempotency-Key header (8-100 chars) is required for refunds', 422);
  }

  try {
    const body = await req.json().catch(() => ({}));
    let amountPaise: number | null = null;
    if (body.amount !== undefined && body.amount !== null) {
      const rupees = Number(body.amount);
      if (!Number.isFinite(rupees) || rupees <= 0 || !Number.isInteger(rupees * 100)) {
        return apiError('VALIDATION_ERROR', 'amount must be a positive number of rupees (max 2 decimals)', 422);
      }
      amountPaise = Math.round(rupees * 100);
    }
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;

    const refund = await PaymentService.requestRefund({
      orderId, amountPaise, reason: 'ADMIN', idempotencyKey: `${orderId}:${key}`, note, initiatedBy: auth.user.userId,
    });
    return apiSuccess({ refund: { ...refund, amountRupees: refund.amount / 100 } }, 201);
  } catch (err) {
    return paymentErrorResponse(err, 'REFUND_FAILED', 'Refund failed');
  }
}
