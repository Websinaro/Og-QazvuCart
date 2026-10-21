/**
 * Production wiring of the payment engine: Postgres store + real Razorpay
 * client + post-commit side effects. Routes talk to this class only.
 *
 * All the money rules live in src/lib/paymentRules.ts and
 * ./paymentEngine.ts (unit-tested with an in-memory store in
 * tests/payments.test.ts); this file is deliberately thin.
 */
import { razorpayGateway } from '@/src/lib/razorpay';
import { notifySellersOfNewOrder } from '../orders/fulfilment';
import { OrderService } from '../orders/orderService';
import { drizzleStore } from './drizzleStore';
import { PaymentEngine, PaymentError } from './paymentEngine';
import { PaymentReconciler } from './reconciler';
import type { ReconcileOptions } from './reconciler';
import type { PaymentGateway } from './ports';
import type { RefundReason } from '@/src/lib/paymentRules';

const engine = new PaymentEngine(drizzleStore, razorpayGateway as PaymentGateway, {
  onOrderPaid: (orderId) => { void notifySellersOfNewOrder(orderId); },
  log: (level, msg, meta) => {
    const line = `[payments] ${msg}`;
    if (level === 'error') console.error(line, meta ?? '');
    else if (level === 'warn') console.warn(line, meta ?? '');
    else console.info(line, meta ?? '');
  },
});
const reconciler = new PaymentReconciler(drizzleStore, razorpayGateway as PaymentGateway, engine);

export { PaymentError };
export { RefundError } from './ports';

export class PaymentService {
  /** Step 1: create (or reuse / retry) the Razorpay order for an order the user owns. Amount is always the server-side total. */
  static createPaymentForOrder(userId: number, orderId: number) {
    return engine.createPayment(userId, orderId);
  }

  /** Step 2: browser success callback. Signature checked first; Razorpay is the source of truth. */
  static verifyPayment(userId: number, params: { orderId: number; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
    return engine.verifyCheckout(userId, params);
  }

  /** Step 3 (authoritative): Razorpay webhook. `rawBody` must be the unparsed request text. */
  static handleWebhook(rawBody: string, signatureHeader: string, eventId?: string | null) {
    return engine.handleWebhook(rawBody, signatureHeader, eventId);
  }

  static getPaymentStatus(userId: number, orderId: number) {
    return engine.getPaymentStatus(userId, orderId);
  }

  static requestRefund(args: { orderId: number; amountPaise?: number | null; reason: RefundReason; idempotencyKey: string; note?: string | null; initiatedBy?: number | null }) {
    return engine.requestRefund({ ...args, source: 'ADMIN' });
  }

  static processDueRefunds(limit = 20) {
    return engine.processDueRefunds(limit);
  }

  static reconcile(opts: ReconcileOptions) {
    return reconciler.run(opts);
  }

  /**
   * Everything that should happen periodically (see
   * app/api/internal/payments/maintenance/route.ts):
   *  1. recover payments for orders whose payment window ended - the money
   *     may have arrived without us hearing about it;
   *  2. cancel orders that are still unpaid after that (stock released);
   *  3. push out / retry pending refunds;
   *  4. reconcile the last `windowHours` against Razorpay.
   * Each step is independent: one failing does not stop the others.
   */
  static async runMaintenance(opts: { windowHours?: number } = {}) {
    const report: Record<string, unknown> = {};
    const step = async (name: string, fn: () => Promise<unknown>) => {
      try { report[name] = await fn(); } catch (err) { report[name] = { error: err instanceof Error ? err.message : String(err) }; console.error(`[payments] maintenance step ${name} failed:`, err); }
    };

    await step('recoverExpired', async () => {
      const ids = await drizzleStore.listExpiredPendingOrderIds();
      let recovered = 0;
      for (const id of ids) {
        const results = await engine.syncOrderWithGateway(id).catch(() => []);
        if (results.some((r) => r.newlyPaid)) recovered++;
      }
      return { checked: ids.length, recovered };
    });
    await step('expireReservations', () => OrderService.releaseExpiredReservations());
    await step('refunds', () => engine.processDueRefunds(50));
    await step('reconcile', () => {
      const to = new Date();
      const from = new Date(to.getTime() - (opts.windowHours ?? 48) * 3600_000);
      return reconciler.run({ from, to, heal: true, trigger: 'SCHEDULED' });
    });
    return report;
  }
}
