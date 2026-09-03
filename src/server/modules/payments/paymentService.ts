import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { payments } from '@/src/db/schema';
import { OrderService } from '../orders/orderService';
import { createRazorpayOrder, verifyCheckoutSignature, verifyWebhookSignature, fetchRazorpayPayment } from '@/src/lib/razorpay';

export class PaymentService {
  /**
   * Step 1 of the flow: given an existing PENDING_PAYMENT order the user
   * owns, create (or reuse) a Razorpay order for its exact server-computed
   * total. The amount NEVER comes from the client — it's read from the
   * order row that OrderService.createOrder already priced and persisted.
   */
  static async createPaymentForOrder(userId: number, orderId: number) {
    const order = await OrderService.getOrderForPayment(userId, orderId);
    if (!order) throw new Error('Order not found');
    if (order.paymentMethod === 'COD') throw new Error('This order is Cash on Delivery and does not require online payment');
    if (order.paymentStatus === 'PAID') throw new Error('This order has already been paid');
    if (order.status === 'CANCELLED') throw new Error('This order was cancelled and can no longer be paid for');

    // Reuse an existing non-terminal payment attempt for this order rather
    // than spawning a new Razorpay order every time the checkout page is
    // reloaded/retried.
    const [existing] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(payments.id)
      .limit(1);

    if (existing && ['CREATED', 'PENDING', 'AUTHORIZED'].includes(existing.status) && existing.providerOrderId) {
      return {
        razorpayOrderId: existing.providerOrderId,
        amount: existing.amount,
        currency: existing.currency,
        orderNumber: order.orderNumber,
      };
    }

    const amountInPaise = order.total * 100;
    const rzpOrder = await createRazorpayOrder({
      amountInPaise,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { internalOrderId: String(order.id), userId: String(userId) },
    });

    await db.insert(payments).values({
      orderId: order.id,
      userId,
      provider: 'RAZORPAY',
      providerOrderId: rzpOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      status: 'CREATED',
      idempotencyKey: `order_${order.id}_attempt_${Date.now()}`,
    });

    return {
      razorpayOrderId: rzpOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      orderNumber: order.orderNumber,
    };
  }

  /**
   * Step 2: the browser calls this after Razorpay Checkout's success
   * callback fires. We do NOT trust that callback by itself — we
   * recompute the HMAC signature server-side, and additionally re-fetch
   * the payment from Razorpay's API to confirm the amount/currency match
   * what we created the order for, before ever marking anything PAID.
   */
  static async verifyPayment(userId: number, params: {
    orderId: number;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const order = await OrderService.getOrderForPayment(userId, params.orderId);
    if (!order) throw new Error('Order not found');

    const [paymentRow] = await db
      .select()
      .from(payments)
      .where(eq(payments.providerOrderId, params.razorpayOrderId))
      .limit(1);
    if (!paymentRow || paymentRow.orderId !== order.id) {
      throw new Error('Payment record does not match this order');
    }

    if (paymentRow.status === 'PAID') {
      // Already verified (e.g. by the webhook arriving first). Idempotent.
      return { alreadyProcessed: true };
    }

    const signatureValid = verifyCheckoutSignature({
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      razorpaySignature: params.razorpaySignature,
    });

    if (!signatureValid) {
      await db
        .update(payments)
        .set({ status: 'FAILED', failureReason: 'Signature verification failed', updatedAt: new Date() })
        .where(eq(payments.id, paymentRow.id));
      throw new Error('Payment signature verification failed');
    }

    // Cross-check with Razorpay's own record of the payment rather than
    // trusting the browser-supplied IDs alone.
    const remotePayment = await fetchRazorpayPayment(params.razorpayPaymentId);
    if (remotePayment.order_id !== params.razorpayOrderId) {
      throw new Error('Payment/order mismatch reported by Razorpay');
    }
    if (remotePayment.amount !== paymentRow.amount || remotePayment.currency !== paymentRow.currency) {
      throw new Error('Payment amount/currency does not match the order');
    }
    if (remotePayment.status !== 'captured' && remotePayment.status !== 'authorized') {
      await db
        .update(payments)
        .set({ status: 'FAILED', failureReason: `Unexpected status: ${remotePayment.status}`, updatedAt: new Date() })
        .where(eq(payments.id, paymentRow.id));
      throw new Error(`Payment is not in a successful state (${remotePayment.status})`);
    }

    await db
      .update(payments)
      .set({
        status: 'PAID',
        providerPaymentId: params.razorpayPaymentId,
        providerSignature: params.razorpaySignature,
        method: remotePayment.method,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentRow.id));

    await OrderService.markOrderPaid(order.id);

    return { alreadyProcessed: false };
  }

  /**
   * Step 3 (authoritative path): Razorpay's server-to-server webhook.
   * Safe to receive the same event multiple times — every write here is
   * guarded by checking current status first, and the unique index on
   * `providerPaymentId` means a duplicate INSERT would fail loudly rather
   * than silently duplicating a payment record.
   *
   * `rawBody` must be the exact, unparsed request body text — signature
   * verification requires the exact bytes Razorpay signed.
   */
  static async handleWebhook(rawBody: string, signatureHeader: string) {
    if (!verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new Error('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event as string;
    const paymentEntity = event.payload?.payment?.entity;
    if (!paymentEntity) {
      // Not a payment event we care about (e.g. refund/dispute events) —
      // acknowledge it without doing anything.
      return { handled: false, eventType };
    }

    const razorpayOrderId: string = paymentEntity.order_id;
    const razorpayPaymentId: string = paymentEntity.id;

    const [paymentRow] = await db.select().from(payments).where(eq(payments.providerOrderId, razorpayOrderId)).limit(1);
    if (!paymentRow) {
      // Order created outside this app's flow, or the DB row hasn't
      // committed yet in a race with the verify endpoint. Nothing to do.
      return { handled: false, eventType };
    }

    if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
      if (paymentRow.status === 'PAID') return { handled: true, eventType, alreadyProcessed: true };

      if (paymentEntity.amount !== paymentRow.amount || paymentEntity.currency !== paymentRow.currency) {
        await db
          .update(payments)
          .set({ status: 'FAILED', failureReason: 'Webhook amount/currency mismatch', updatedAt: new Date() })
          .where(eq(payments.id, paymentRow.id));
        return { handled: true, eventType, error: 'amount_mismatch' };
      }

      await db
        .update(payments)
        .set({
          status: 'PAID',
          providerPaymentId: razorpayPaymentId,
          method: paymentEntity.method,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentRow.id));

      await OrderService.markOrderPaid(paymentRow.orderId);
      return { handled: true, eventType, alreadyProcessed: false };
    }

    if (eventType === 'payment.failed') {
      if (paymentRow.status === 'PAID') return { handled: true, eventType, alreadyProcessed: true };

      await db
        .update(payments)
        .set({
          status: 'FAILED',
          failureCode: paymentEntity.error_code || null,
          failureReason: paymentEntity.error_description || 'Payment failed',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentRow.id));

      await OrderService.markOrderPaymentFailed(paymentRow.orderId, paymentEntity.error_description);
      return { handled: true, eventType };
    }

    return { handled: false, eventType };
  }
}
