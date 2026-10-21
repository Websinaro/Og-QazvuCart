import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Clock, FakeGateway, FakeStore, checkoutSignature, signedWebhook, webhookSignature,
} from './helpers/fakePayments';
import { PaymentEngine, PaymentError } from '../src/server/modules/payments/paymentEngine';
import { PaymentReconciler } from '../src/server/modules/payments/reconciler';
import { RefundError } from '../src/server/modules/payments/ports';
import { verifyCheckoutSignature, verifyWebhookSignature } from '../src/lib/razorpay';
import { MAX_PAYMENT_ATTEMPTS } from '../src/lib/paymentRules';

function setup(orderTotal = 1000) {
  const clock = new Clock();
  const store = new FakeStore(clock);
  const gateway = new FakeGateway(clock);
  const paid: number[] = [];
  const settled: number[] = [];
  const engine = new PaymentEngine(store, gateway, {
    onOrderPaid: (id) => { paid.push(id); },
    onRefundSettled: (r) => { settled.push(r.id); },
  }, clock.now);
  const order = store.addOrder({ id: 1, total: orderTotal });
  return { clock, store, gateway, engine, paid, settled, order };
}

/** Start a payment for order 1 and have the customer pay at the gateway. */
async function startAndPay(ctx: ReturnType<typeof setup>, opts: Parameters<FakeGateway['pay']>[1] = {}) {
  const start = await ctx.engine.createPayment(1, 1);
  const remote = ctx.gateway.pay(start.razorpayOrderId, opts);
  return { start, remote };
}

const deliver = (ctx: ReturnType<typeof setup>, event: string, entity: object, kind: 'payment' | 'refund' = 'payment', eventId?: string) => {
  const w = signedWebhook(event, entity, kind, eventId);
  return { w, run: () => ctx.engine.handleWebhook(w.rawBody, w.signature, w.eventId) };
};

const rejects = async (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: unknown) => (e instanceof PaymentError || e instanceof RefundError) && e.code === code, `expected ${code}`);

// ===========================================================================
// Forged signatures
// ===========================================================================

test('signature primitives reject empty, non-hex, wrong-length and wrong-key values', () => {
  const good = checkoutSignature('order_x', 'pay_x');
  assert.equal(verifyCheckoutSignature({ razorpayOrderId: 'order_x', razorpayPaymentId: 'pay_x', razorpaySignature: good }), true);
  for (const bad of ['', 'zz', good.slice(0, -2), good.toUpperCase() === good ? good + '0' : good.toUpperCase() + '00', 'g'.repeat(64), checkoutSignature('order_x', 'pay_y')]) {
    assert.equal(verifyCheckoutSignature({ razorpayOrderId: 'order_x', razorpayPaymentId: 'pay_x', razorpaySignature: bad }), false, `accepted ${bad}`);
  }
  const body = '{"a":1}';
  assert.equal(verifyWebhookSignature(body, webhookSignature(body)), true);
  assert.equal(verifyWebhookSignature(body + ' ', webhookSignature(body)), false);
  assert.equal(verifyWebhookSignature(body, ''), false);
});

test('forged checkout signature is rejected and changes nothing', async () => {
  const ctx = setup();
  const { start, remote } = await startAndPay(ctx);
  await rejects(ctx.engine.verifyCheckout(1, {
    orderId: 1, razorpayOrderId: start.razorpayOrderId, razorpayPaymentId: remote.id, razorpaySignature: 'a'.repeat(64),
  }), 'INVALID_SIGNATURE');
  assert.equal(ctx.store.order(1).paymentStatus, 'PENDING');
  assert.equal(ctx.store.order(1).status, 'PENDING_PAYMENT');
  assert.equal(ctx.store.payment(1).status, 'CREATED', 'a forged call must not even mark the attempt failed');
  assert.deepEqual(ctx.paid, []);
});

test('a genuine signature for a DIFFERENT payment id is rejected', async () => {
  const ctx = setup();
  const { start, remote } = await startAndPay(ctx);
  await rejects(ctx.engine.verifyCheckout(1, {
    orderId: 1, razorpayOrderId: start.razorpayOrderId, razorpayPaymentId: remote.id,
    razorpaySignature: checkoutSignature(start.razorpayOrderId, 'pay_somebody_elses'),
  }), 'INVALID_SIGNATURE');
  assert.equal(ctx.store.order(1).paymentStatus, 'PENDING');
});

test('forged signature on an ALREADY-PAID order is still rejected (no "already processed" oracle)', async () => {
  const ctx = setup();
  const { start, remote } = await startAndPay(ctx);
  const sig = checkoutSignature(start.razorpayOrderId, remote.id);
  await ctx.engine.verifyCheckout(1, { orderId: 1, razorpayOrderId: start.razorpayOrderId, razorpayPaymentId: remote.id, razorpaySignature: sig });
  await rejects(ctx.engine.verifyCheckout(1, {
    orderId: 1, razorpayOrderId: start.razorpayOrderId, razorpayPaymentId: remote.id, razorpaySignature: 'b'.repeat(64),
  }), 'INVALID_SIGNATURE');
});

test("a user cannot verify (or pay) someone else's order", async () => {
  const ctx = setup();
  const { start, remote } = await startAndPay(ctx);
  await rejects(ctx.engine.verifyCheckout(2, {
    orderId: 1, razorpayOrderId: start.razorpayOrderId, razorpayPaymentId: remote.id,
    razorpaySignature: checkoutSignature(start.razorpayOrderId, remote.id),
  }), 'NOT_FOUND');
  await rejects(ctx.engine.createPayment(2, 1), 'NOT_FOUND');
});

test('a valid signature for another order\'s gateway ids cannot confirm this order', async () => {
  const ctx = setup();
  ctx.store.addOrder({ id: 2, total: 500 });
  const a = await ctx.engine.createPayment(1, 1);
  const b = await ctx.engine.createPayment(1, 2);
  const paidB = ctx.gateway.pay(b.razorpayOrderId);
  // genuinely signed pair for order 2, submitted against order 1
  await rejects(ctx.engine.verifyCheckout(1, {
    orderId: 1, razorpayOrderId: b.razorpayOrderId, razorpayPaymentId: paidB.id,
    razorpaySignature: checkoutSignature(b.razorpayOrderId, paidB.id),
  }), 'PAYMENT_ORDER_MISMATCH');
  assert.equal(ctx.store.order(1).paymentStatus, 'PENDING');
  assert.ok(a.razorpayOrderId);
});

test('forged / tampered / unsigned webhooks are rejected before touching any state or the ledger', async () => {
  const ctx = setup();
  const { remote } = await startAndPay(ctx);
  const good = signedWebhook('payment.captured', remote);

  await rejects(ctx.engine.handleWebhook(good.rawBody, 'c'.repeat(64), good.eventId), 'INVALID_SIGNATURE');
  await rejects(ctx.engine.handleWebhook(good.rawBody, '', good.eventId), 'INVALID_SIGNATURE');
  // valid signature, but over a different body (attacker edits the amount)
  const tampered = good.rawBody.replace(`"amount":${remote.amount}`, '"amount":1');
  assert.notEqual(tampered, good.rawBody);
  await rejects(ctx.engine.handleWebhook(tampered, good.signature, good.eventId), 'INVALID_SIGNATURE');

  assert.equal(ctx.store.state.events.size, 0, 'rejected deliveries must not enter the ledger');
  assert.equal(ctx.store.order(1).paymentStatus, 'PENDING');
});

test('webhook signed with the API key secret (wrong secret) is rejected', async () => {
  const ctx = setup();
  const { remote } = await startAndPay(ctx);
  const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: remote } } });
  const wrong = (await import('./helpers/fakePayments')).hmac('test_key_secret', raw);
  await rejects(ctx.engine.handleWebhook(raw, wrong, 'evt_1'), 'INVALID_SIGNATURE');
});

// ===========================================================================
// Duplicate / replayed / reordered webhooks
// ===========================================================================

test('the same webhook delivered twice updates the order exactly once', async () => {
  const ctx = setup();
  const { remote } = await startAndPay(ctx);
  const d = deliver(ctx, 'payment.captured', remote, 'payment', 'evt_same');
  const first = await d.run();
  const second = await d.run();
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(ctx.store.state.counters.ordersPaid, 1);
  assert.deepEqual(ctx.paid, [1], 'sellers are notified once');
  assert.equal(ctx.store.timelineFor(1).filter((t) => t === 'Payment Confirmed').length, 1);
  assert.equal(ctx.store.order(1).status, 'CONFIRMED');
});

test('payment.captured + order.paid + a replay with a NEW event id still apply once (state-level idempotency)', async () => {
  const ctx = setup();
  const { remote } = await startAndPay(ctx);
  await deliver(ctx, 'payment.captured', remote).run();
  await deliver(ctx, 'order.paid', remote).run();
  await deliver(ctx, 'payment.captured', remote).run();
  assert.equal(ctx.store.state.counters.ordersPaid, 1);
  assert.equal(ctx.store.state.refunds.length, 0, 'replays must never trigger a refund');
  assert.deepEqual(ctx.paid, [1]);
});

test('without an event-id header, an identical body is de-duplicated by its hash', async () => {
  const ctx = setup();
  const { remote } = await startAndPay(ctx);
  const w = signedWebhook('payment.captured', remote);
  const a = await ctx.engine.handleWebhook(w.rawBody, w.signature, null);
  const b = await ctx.engine.handleWebhook(w.rawBody, w.signature, null);
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
});

test('five concurrent deliveries of one event: one winner, nothing double-applied', async () => {
  const ctx = setup();
  const { remote } = await startAndPay(ctx);
  const w = signedWebhook('payment.captured', remote, 'payment', 'evt_race');
  const results = await Promise.all(Array.from({ length: 5 }, () => ctx.engine.handleWebhook(w.rawBody, w.signature, w.eventId)));
  assert.equal(results.filter((r) => !r.duplicate).length, 1);
  assert.equal(ctx.store.state.counters.ordersPaid, 1);
  assert.deepEqual(ctx.paid, [1]);
});

test('concurrent webhook + browser verify: order paid once, both callers succeed', async () => {
  const ctx = setup();
  const { start, remote } = await startAndPay(ctx);
  const w = signedWebhook('payment.captured', remote);
  const [, v] = await Promise.all([
    ctx.engine.handleWebhook(w.rawBody, w.signature, w.eventId),
    ctx.engine.verifyCheckout(1, { orderId: 1, razorpayOrderId: start.razorpayOrderId, razorpayPaymentId: remote.id, razorpaySignature: checkoutSignature(start.razorpayOrderId, remote.id) }),
  ]);
  assert.equal(v.status, 'PAID');
  assert.equal(ctx.store.state.counters.ordersPaid, 1);
  assert.deepEqual(ctx.paid, [1]);
  assert.equal(ctx.store.state.refunds.length, 0);
});

test('a webhook that fails mid-processing is retried (ledger row is FAILED, not PROCESSED)', async () => {
  const ctx = setup();
  const { remote } = await startAndPay(ctx);
  const w = signedWebhook('payment.captured', remote, 'payment', 'evt_retry');
  const original = ctx.store.transaction.bind(ctx.store);
  let boom = true;
  ctx.store.transaction = (async (fn: Parameters<typeof original>[0]) => {
    if (boom) { boom = false; throw new Error('db down'); }
    return original(fn);
  }) as typeof ctx.store.transaction;

  await assert.rejects(ctx.engine.handleWebhook(w.rawBody, w.signature, w.eventId), /db down/);
  assert.equal(ctx.store.state.events.get('evt_retry')!.status, 'FAILED');
  const again = await ctx.engine.handleWebhook(w.rawBody, w.signature, w.eventId);
  assert.equal(again.duplicate, false);
  assert.equal(ctx.store.order(1).paymentStatus, 'PAID');
});

test('a stale PROCESSING claim (crashed worker) is re-claimable; a fresh one is not', async () => {
  const ctx = setup();
  assert.equal(await ctx.store.claimWebhookEvent({ eventId: 'e', eventType: 't' }), 'CLAIMED');
  assert.equal(await ctx.store.claimWebhookEvent({ eventId: 'e', eventType: 't' }), 'DUPLICATE_IN_FLIGHT');
  ctx.clock.advance(5 * 60_000);
  assert.equal(await ctx.store.claimWebhookEvent({ eventId: 'e', eventType: 't' }), 'CLAIMED');
});

test('out-of-order: a late payment.failed after capture never undoes the payment', async () => {
  const ctx = setup();
  const { start, remote } = await startAndPay(ctx);
  await deliver(ctx, 'payment.captured', remote).run();
  await deliver(ctx, 'payment.failed', { ...remote, status: 'failed', error_code: 'X', error_description: 'late' }).run();
  assert.equal(ctx.store.payment(1).status, 'PAID');
  assert.equal(ctx.store.order(1).paymentStatus, 'PAID');
  assert.ok(start);
});

test('customer fails once, then succeeds inside the same Razorpay order: FAILED -> PAID', async () => {
  const ctx = setup();
  const start = await ctx.engine.createPayment(1, 1);
  const failed = ctx.gateway.pay(start.razorpayOrderId, { status: 'failed' });
  await deliver(ctx, 'payment.failed', failed).run();
  assert.equal(ctx.store.payment(1).status, 'FAILED');
  assert.equal(ctx.store.order(1).status, 'PENDING_PAYMENT', 'one failed attempt must not cancel the order');

  const ok = ctx.gateway.pay(start.razorpayOrderId);
  await deliver(ctx, 'payment.captured', ok).run();
  assert.equal(ctx.store.payment(1).status, 'PAID');
  assert.equal(ctx.store.payment(1).providerPaymentId, ok.id);
  assert.equal(ctx.store.order(1).status, 'CONFIRMED');
});

test('unknown gateway orders and unhandled events are acknowledged without effect', async () => {
  const ctx = setup();
  const r = await deliver(ctx, 'payment.captured', { id: 'pay_x', order_id: 'order_unknown', amount: 100, currency: 'INR', status: 'captured' }).run();
  assert.equal(r.outcome, 'UNKNOWN_ORDER');
  const u = await deliver(ctx, 'payout.processed', {}).run();
  assert.equal(u.outcome, 'UNHANDLED');
});

test('malformed signed payloads are a 400, never a silent success', async () => {
  const ctx = setup();
  const w = signedWebhook('payment.captured', { nope: true });
  await rejects(ctx.engine.handleWebhook(w.rawBody, w.signature, w.eventId), 'BAD_PAYLOAD');
  const raw = 'not json';
  await rejects(ctx.engine.handleWebhook(raw, webhookSignature(raw), 'e2'), 'BAD_PAYLOAD');
});

// ===========================================================================
// Mismatched amounts: the server is authoritative
// ===========================================================================

test('gateway captures LESS than the order total: order is not confirmed, money is refunded', async () => {
  const ctx = setup(1000);
  const { remote } = await startAndPay(ctx, { amount: 100_00 }); // ₹100 instead of ₹1000
  const r = await deliver(ctx, 'payment.captured', remote).run();
  assert.equal(r.outcome, 'AMOUNT_MISMATCH_REFUND_QUEUED');

  assert.equal(ctx.store.order(1).status, 'PENDING_PAYMENT');
  assert.notEqual(ctx.store.order(1).paymentStatus, 'PAID');
  assert.equal(ctx.store.state.counters.ordersPaid, 0);
  assert.deepEqual(ctx.paid, []);
  const p = ctx.store.payment(1);
  assert.equal(p.status, 'MISMATCH');
  assert.equal(p.failureCode, 'AMOUNT_MISMATCH');
  assert.equal(p.capturedAmount, 100_00, 'we record what was really taken');

  // the refund goes out for exactly what was captured
  const refunds = ctx.store.refundsFor(1);
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].amount, 100_00);
  assert.equal(refunds[0].reason, 'AMOUNT_MISMATCH');
  await ctx.engine.processRefund(refunds[0].id);
  assert.equal(ctx.store.payment(1).status, 'REFUNDED');
  assert.equal(ctx.gateway.refunds.size, 1);
});

test('gateway captures MORE than the order total: same treatment', async () => {
  const ctx = setup(1000);
  const { remote } = await startAndPay(ctx, { amount: 5000_00 });
  assert.equal((await deliver(ctx, 'payment.captured', remote).run()).outcome, 'AMOUNT_MISMATCH_REFUND_QUEUED');
  assert.notEqual(ctx.store.order(1).paymentStatus, 'PAID');
  assert.equal(ctx.store.refundsFor(1)[0].amount, 5000_00);
});

test('wrong currency is a mismatch even when the number matches', async () => {
  const ctx = setup(1000);
  const { remote } = await startAndPay(ctx, { currency: 'USD' });
  assert.equal((await deliver(ctx, 'payment.captured', remote).run()).outcome, 'AMOUNT_MISMATCH_REFUND_QUEUED');
  assert.equal(ctx.store.payment(1).failureCode, 'CURRENCY_MISMATCH');
  assert.notEqual(ctx.store.order(1).paymentStatus, 'PAID');
});

test("if the order's server-side total no longer equals the attempt's amount, payment is not accepted", async () => {
  const ctx = setup(1000);
  const { remote } = await startAndPay(ctx);
  ctx.store.order(1).total = 900; // total changed after the Razorpay order was created
  assert.equal((await deliver(ctx, 'payment.captured', remote).run()).outcome, 'AMOUNT_MISMATCH_REFUND_QUEUED');
  assert.equal(ctx.store.payment(1).failureCode, 'ORDER_TOTAL_MISMATCH');
  assert.notEqual(ctx.store.order(1).paymentStatus, 'PAID');
});

test('browser verify with a mismatched amount: error to the user, order untouched, refund queued', async () => {
  const ctx = setup(1000);
  const { start, remote } = await startAndPay(ctx, { amount: 1 });
  await rejects(ctx.engine.verifyCheckout(1, {
    orderId: 1, razorpayOrderId: start.razorpayOrderId, razorpayPaymentId: remote.id,
    razorpaySignature: checkoutSignature(start.razorpayOrderId, remote.id),
  }), 'AMOUNT_MISMATCH');
  assert.notEqual(ctx.store.order(1).paymentStatus, 'PAID');
  assert.equal(ctx.store.refundsFor(1).length, 1);
});

test('an authorized payment with the wrong amount is never captured', async () => {
  const ctx = setup(1000);
  const { remote } = await startAndPay(ctx, { status: 'authorized', amount: 200_00 });
  const r = await deliver(ctx, 'payment.authorized', remote).run();
  assert.equal(r.outcome, 'AUTHORIZED_REJECTED');
  assert.ok(!ctx.gateway.calls.includes('capturePayment'));
  assert.equal(ctx.store.state.refunds.length, 0, 'nothing was captured, so nothing to refund');
  assert.notEqual(ctx.store.order(1).paymentStatus, 'PAID');
});

test('an authorized payment with the right amount is captured by the server, for the server amount', async () => {
  const ctx = setup(1000);
  const { remote } = await startAndPay(ctx, { status: 'authorized' });
  const r = await deliver(ctx, 'payment.authorized', remote).run();
  assert.equal(r.outcome, 'PAID');
  assert.ok(ctx.gateway.calls.includes('capturePayment'));
  assert.equal(ctx.store.order(1).paymentStatus, 'PAID');
  assert.equal(ctx.store.payment(1).capturedAmount, 1000_00);
});

test('authorized but capture fails: stays AUTHORIZED, order unpaid, reconciliation completes it later', async () => {
  const ctx = setup(1000);
  const { remote } = await startAndPay(ctx, { status: 'authorized' });
  ctx.gateway.failNext = { op: 'capturePayment', status: 500, times: 1 };
  await deliver(ctx, 'payment.authorized', remote).run();
  assert.equal(ctx.store.payment(1).status, 'AUTHORIZED');
  assert.notEqual(ctx.store.order(1).paymentStatus, 'PAID');
  const out = await ctx.engine.syncOrderWithGateway(1);
  assert.equal(out[0].outcome, 'PAID');
  assert.equal(ctx.store.order(1).paymentStatus, 'PAID');
});

test('createPayment always charges the server-side order total in paise', async () => {
  const ctx = setup(1499);
  const s = await ctx.engine.createPayment(1, 1);
  assert.equal(s.amount, 149_900);
  assert.equal(ctx.gateway.orders.get(s.razorpayOrderId)!.amount, 149_900);
  assert.equal(ctx.store.payment(1).amount, 149_900);
});

// ===========================================================================
// Retry / recovery
// ===========================================================================

test('createPayment reuses the open attempt instead of creating another Razorpay order', async () => {
  const ctx = setup();
  const a = await ctx.engine.createPayment(1, 1);
  const b = await ctx.engine.createPayment(1, 1);
  assert.equal(a.razorpayOrderId, b.razorpayOrderId);
  assert.equal(b.reused, true);
  assert.equal(ctx.gateway.orders.size, 1);
});

test('after a failed attempt, retry creates a NEW attempt and the order is still payable', async () => {
  const ctx = setup();
  const a = await ctx.engine.createPayment(1, 1);
  await deliver(ctx, 'payment.failed', ctx.gateway.pay(a.razorpayOrderId, { status: 'failed', error: 'Card declined' })).run();
  assert.equal(ctx.store.order(1).paymentStatus, 'FAILED');
  assert.equal(ctx.store.order(1).status, 'PENDING_PAYMENT');

  const status = await ctx.engine.getPaymentStatus(1, 1);
  assert.equal(status.canRetry, true);
  assert.equal(status.lastFailureReason, 'Card declined');
  assert.equal(status.attemptsRemaining, MAX_PAYMENT_ATTEMPTS - 1);

  const b = await ctx.engine.createPayment(1, 1);
  assert.notEqual(b.razorpayOrderId, a.razorpayOrderId);
  assert.equal(b.attemptNo, 2);
  assert.equal(ctx.store.order(1).paymentStatus, 'PENDING');

  await deliver(ctx, 'payment.captured', ctx.gateway.pay(b.razorpayOrderId)).run();
  assert.equal(ctx.store.order(1).status, 'CONFIRMED');
  assert.equal(ctx.store.paymentsFor(1).map((p) => p.status).join(), 'FAILED,PAID');
});

test(`after ${MAX_PAYMENT_ATTEMPTS} failed attempts the order is cancelled and stock released`, async () => {
  const ctx = setup();
  for (let i = 0; i < MAX_PAYMENT_ATTEMPTS; i++) {
    const s = await ctx.engine.createPayment(1, 1);
    await deliver(ctx, 'payment.failed', ctx.gateway.pay(s.razorpayOrderId, { status: 'failed' })).run();
    if (i < MAX_PAYMENT_ATTEMPTS - 1) assert.equal(ctx.store.order(1).status, 'PENDING_PAYMENT');
  }
  assert.equal(ctx.store.order(1).status, 'CANCELLED');
  assert.equal(ctx.store.state.counters.stockReleases, 1);
  await rejects(ctx.engine.createPayment(1, 1), 'ORDER_CANCELLED');
});

test('retry is refused once the payment window has expired', async () => {
  const ctx = setup();
  ctx.clock.advance(16 * 60_000);
  await rejects(ctx.engine.createPayment(1, 1), 'PAYMENT_WINDOW_EXPIRED');
  assert.equal((await ctx.engine.getPaymentStatus(1, 1)).canRetry, false);
});

test('already-paid, COD and cancelled orders cannot start a payment', async () => {
  const ctx = setup();
  ctx.store.addOrder({ id: 2, total: 10, paymentMethod: 'COD', status: 'CONFIRMED' });
  ctx.store.addOrder({ id: 3, total: 10, paymentStatus: 'PAID', status: 'CONFIRMED' });
  ctx.store.addOrder({ id: 4, total: 10, status: 'CANCELLED' });
  await rejects(ctx.engine.createPayment(1, 2), 'NOT_ONLINE');
  await rejects(ctx.engine.createPayment(1, 3), 'ALREADY_PAID');
  await rejects(ctx.engine.createPayment(1, 4), 'ORDER_CANCELLED');
});

test('two simultaneous "pay" requests cannot both create a gateway order', async () => {
  const ctx = setup();
  const results = await Promise.allSettled([ctx.engine.createPayment(1, 1), ctx.engine.createPayment(1, 1)]);
  // Whichever interleaving, there is never more than one gateway order for attempt 1.
  assert.equal(ctx.gateway.orders.size, 1);
  assert.equal(ctx.store.paymentsFor(1).length, 1);
  assert.ok(results.some((r) => r.status === 'fulfilled'));
});

test('losing the claim race tells the caller to retry rather than creating a second order', async () => {
  const ctx = setup();
  ctx.store.raceOnClaim = true;
  await rejects(ctx.engine.createPayment(1, 1), 'PAYMENT_IN_PROGRESS');
  assert.equal(ctx.gateway.orders.size, 0);
});

test('a gateway outage while creating the order does not burn a retry', async () => {
  const ctx = setup();
  for (let i = 0; i < MAX_PAYMENT_ATTEMPTS + 2; i++) {
    ctx.gateway.failNext = { op: 'createOrder', status: 503, times: 1 };
    await assert.rejects(ctx.engine.createPayment(1, 1));
  }
  const ok = await ctx.engine.createPayment(1, 1);
  assert.ok(ok.razorpayOrderId, 'still able to pay after repeated gateway outages');
  assert.equal((await ctx.engine.getPaymentStatus(1, 1)).attemptsRemaining, MAX_PAYMENT_ATTEMPTS);
});

test('money arriving after the reservation was cancelled is accepted then automatically refunded', async () => {
  const ctx = setup();
  const s = await ctx.engine.createPayment(1, 1);
  const remote = ctx.gateway.pay(s.razorpayOrderId);
  await ctx.store.transaction(async (u) => u.cancelUnpaidOrder(1, 'Payment reservation expired'));
  assert.equal(ctx.store.order(1).status, 'CANCELLED');

  const r = await deliver(ctx, 'payment.captured', remote).run();
  assert.equal(r.outcome, 'LATE_PAYMENT_REFUND_QUEUED');
  assert.equal(ctx.store.order(1).status, 'CANCELLED', 'must not resurrect a cancelled order');
  assert.deepEqual(ctx.paid, []);
  const [refund] = ctx.store.refundsFor(1);
  assert.equal(refund.reason, 'LATE_PAYMENT');
  assert.equal(refund.amount, 1000_00);
  await ctx.engine.processRefund(refund.id);
  assert.equal(ctx.store.order(1).paymentStatus, 'REFUNDED');
});

test('paying the same order twice through two attempts: second charge is refunded, order paid once', async () => {
  const ctx = setup();
  const a = await ctx.engine.createPayment(1, 1);
  await deliver(ctx, 'payment.failed', ctx.gateway.pay(a.razorpayOrderId, { status: 'failed' })).run();
  const b = await ctx.engine.createPayment(1, 1);
  await deliver(ctx, 'payment.captured', ctx.gateway.pay(b.razorpayOrderId)).run();
  // attempt 1's modal was still open in another tab and succeeded too
  const dup = ctx.gateway.pay(a.razorpayOrderId);
  const r = await deliver(ctx, 'payment.captured', dup).run();

  assert.equal(r.outcome, 'DUPLICATE_PAYMENT_REFUND_QUEUED');
  assert.equal(ctx.store.state.counters.ordersPaid, 1);
  assert.equal(ctx.store.order(1).paymentStatus, 'PAID', 'the first payment keeps the order paid');
  const [refund] = ctx.store.refundsFor(1);
  assert.equal(refund.paymentId, 1);
  assert.equal(refund.reason, 'DUPLICATE_PAYMENT');
  await ctx.engine.processRefund(refund.id);
  assert.equal(ctx.store.order(1).paymentStatus, 'PAID', 'refunding the duplicate must not flip the order to REFUNDED');
});

// ===========================================================================
// Refunds
// ===========================================================================

async function paidOrder(total = 1000) {
  const ctx = setup(total);
  const { remote } = await startAndPay(ctx);
  await deliver(ctx, 'payment.captured', remote).run();
  return { ctx, remote };
}

test('admin partial refunds are bounded by what was captured', async () => {
  const { ctx } = await paidOrder(1000);
  const r1 = await ctx.engine.requestRefund({ orderId: 1, amountPaise: 400_00, reason: 'ADMIN', idempotencyKey: 'k1', initiatedBy: 9 });
  assert.equal(r1.status, 'PROCESSED');
  assert.equal(ctx.store.payment(1).refundedAmount, 400_00);
  assert.equal(ctx.store.payment(1).status, 'PAID', 'partial refund keeps the payment PAID');
  assert.equal(ctx.store.order(1).paymentStatus, 'PAID');

  await rejects(ctx.engine.requestRefund({ orderId: 1, amountPaise: 700_00, reason: 'ADMIN', idempotencyKey: 'k2' }), 'EXCEEDS_REFUNDABLE');
  await rejects(ctx.engine.requestRefund({ orderId: 1, amountPaise: 0, reason: 'ADMIN', idempotencyKey: 'k3' }), 'INVALID_AMOUNT');
  await rejects(ctx.engine.requestRefund({ orderId: 1, amountPaise: 10.5, reason: 'ADMIN', idempotencyKey: 'k4' }), 'INVALID_AMOUNT');

  const r2 = await ctx.engine.requestRefund({ orderId: 1, amountPaise: 600_00, reason: 'ADMIN', idempotencyKey: 'k5' });
  assert.equal(r2.status, 'PROCESSED');
  assert.equal(ctx.store.payment(1).status, 'REFUNDED');
  assert.equal(ctx.store.order(1).paymentStatus, 'REFUNDED');
  await rejects(ctx.engine.requestRefund({ orderId: 1, reason: 'ADMIN', idempotencyKey: 'k6' }), 'NOT_REFUNDABLE');
  assert.equal(ctx.gateway.refunds.size, 2);
});

test('a retried refund request (same idempotency key) returns the same refund and pays out once', async () => {
  const { ctx } = await paidOrder(1000);
  const a = await ctx.engine.requestRefund({ orderId: 1, amountPaise: 250_00, reason: 'ADMIN', idempotencyKey: 'same' });
  const b = await ctx.engine.requestRefund({ orderId: 1, amountPaise: 250_00, reason: 'ADMIN', idempotencyKey: 'same' });
  assert.equal(a.id, b.id);
  assert.equal(ctx.store.state.refunds.length, 1);
  assert.equal(ctx.gateway.refunds.size, 1);
  assert.equal(ctx.store.payment(1).refundedAmount, 250_00);
  await rejects(ctx.engine.requestRefund({ orderId: 1, amountPaise: 300_00, reason: 'ADMIN', idempotencyKey: 'same' }), 'IDEMPOTENCY_KEY_REUSED');
});

test('concurrent refund requests with one key create one refund; with different keys cannot over-refund', async () => {
  const { ctx } = await paidOrder(1000);
  const same = await Promise.all(Array.from({ length: 4 }, () => ctx.engine.requestRefund({ orderId: 1, amountPaise: 300_00, reason: 'ADMIN', idempotencyKey: 'dup' })));
  assert.equal(new Set(same.map((r) => r.id)).size, 1);
  assert.equal(ctx.gateway.refunds.size, 1);

  // 700 left; five different requests of 300 -> at most two succeed
  const settled = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => ctx.engine.requestRefund({ orderId: 1, amountPaise: 300_00, reason: 'ADMIN', idempotencyKey: `n${i}` })));
  assert.equal(settled.filter((s) => s.status === 'fulfilled').length, 2);
  assert.ok(ctx.store.payment(1).refundedAmount <= 1000_00);
  assert.equal(ctx.store.payment(1).refundedAmount, 900_00);
});

test('gateway outage: refund stays PENDING and is completed by the retry sweep without double-paying', async () => {
  const { ctx } = await paidOrder(1000);
  ctx.gateway.failNext = { op: 'createRefund', status: 503, times: 1 };
  const r = await ctx.engine.requestRefund({ orderId: 1, reason: 'ADMIN', idempotencyKey: 'outage' });
  assert.equal(r.status, 'PENDING');
  assert.equal(ctx.store.payment(1).refundedAmount, 1000_00, 'capacity stays reserved while pending');
  await rejects(ctx.engine.requestRefund({ orderId: 1, reason: 'ADMIN', idempotencyKey: 'another' }), 'NOTHING_TO_REFUND');

  assert.deepEqual(await ctx.engine.processDueRefunds(), { attempted: 0 }, 'not due until the lease elapses');
  ctx.clock.advance(31_000);
  assert.deepEqual(await ctx.engine.processDueRefunds(), { attempted: 1 });
  assert.equal(ctx.store.state.refunds[0].status, 'PROCESSED');
  assert.equal(ctx.gateway.refunds.size, 1);
  assert.equal(ctx.store.payment(1).status, 'REFUNDED');
});

test('lost response: gateway refunded but we never saw it; the retry returns the same refund (idempotency header)', async () => {
  const { ctx } = await paidOrder(1000);
  const original = ctx.gateway.createRefund.bind(ctx.gateway);
  let dropResponse = true;
  ctx.gateway.createRefund = (async (...args: Parameters<typeof original>) => {
    const res = await original(...args);
    if (dropResponse) { dropResponse = false; throw Object.assign(new Error('socket hang up'), { status: null }); }
    return res;
  }) as typeof original;
  const r = await ctx.engine.requestRefund({ orderId: 1, reason: 'ADMIN', idempotencyKey: 'lost' });
  assert.equal(r.status, 'PENDING');
  ctx.clock.advance(31_000);
  await ctx.engine.processDueRefunds();
  assert.equal(ctx.gateway.refunds.size, 1, 'exactly one refund at the gateway');
  assert.equal(ctx.store.state.refunds[0].status, 'PROCESSED');
});

test('permanent gateway rejection marks the refund FAILED and frees the reserved amount', async () => {
  const { ctx } = await paidOrder(1000);
  ctx.gateway.failNext = { op: 'createRefund', status: 400, times: 1 };
  const r = await ctx.engine.requestRefund({ orderId: 1, reason: 'ADMIN', idempotencyKey: 'bad' });
  assert.equal(r.status, 'FAILED');
  assert.equal(ctx.store.payment(1).refundedAmount, 0);
  assert.equal(ctx.store.payment(1).status, 'PAID');
  assert.deepEqual(ctx.settled, [r.id]);
  const again = await ctx.engine.requestRefund({ orderId: 1, reason: 'ADMIN', idempotencyKey: 'bad2' });
  assert.equal(again.status, 'PROCESSED');
});

test('a refund that keeps failing transiently is eventually given up on', async () => {
  const { ctx } = await paidOrder(1000);
  ctx.gateway.failNext = { op: 'createRefund', status: 503, times: 99 };
  await ctx.engine.requestRefund({ orderId: 1, reason: 'ADMIN', idempotencyKey: 'forever' });
  for (let i = 0; i < 12; i++) { ctx.clock.advance(31_000); await ctx.engine.processDueRefunds(); }
  assert.equal(ctx.store.state.refunds[0].status, 'FAILED');
  assert.equal(ctx.store.payment(1).refundedAmount, 0);
});

test('refund webhooks: processed / failed / duplicate / created-outside-the-app', async () => {
  const { ctx } = await paidOrder(1000);
  ctx.gateway.failNext = { op: 'createRefund', status: 503, times: 1 };
  const r = await ctx.engine.requestRefund({ orderId: 1, amountPaise: 500_00, reason: 'ADMIN', idempotencyKey: 'w' });
  assert.equal(r.status, 'PENDING');

  // Razorpay processed it (our own response was lost): webhook carries our receipt
  const entity = { id: 'rfnd_web1', payment_id: 'pay_1', amount: 500_00, status: 'processed', receipt: `rf_${r.id}` };
  ctx.store.payment(1).providerPaymentId; // sanity
  const d = deliver(ctx, 'refund.processed', { ...entity, payment_id: ctx.store.payment(1).providerPaymentId }, 'refund', 'evt_rf');
  assert.equal((await d.run()).outcome, 'REFUND_UPDATED');
  assert.equal((await d.run()).duplicate, true);
  assert.equal(ctx.store.state.refunds[0].status, 'PROCESSED');
  assert.equal(ctx.store.state.refunds[0].providerRefundId, 'rfnd_web1');
  assert.equal(ctx.store.state.refunds.length, 1, 'matched by receipt, not duplicated');

  // processed never goes backwards
  await deliver(ctx, 'refund.failed', { ...entity, payment_id: ctx.store.payment(1).providerPaymentId, status: 'failed' }, 'refund').run();
  assert.equal(ctx.store.state.refunds[0].status, 'PROCESSED');

  // a refund issued from the Razorpay dashboard is imported
  const ext = { id: 'rfnd_ext', payment_id: ctx.store.payment(1).providerPaymentId, amount: 500_00, status: 'processed', receipt: null };
  assert.equal((await deliver(ctx, 'refund.processed', ext, 'refund').run()).outcome, 'REFUND_IMPORTED');
  assert.equal(ctx.store.payment(1).status, 'REFUNDED');
  assert.equal(ctx.store.order(1).paymentStatus, 'REFUNDED');
});

test('refund.failed webhook frees capacity so the refund can be re-issued', async () => {
  const { ctx } = await paidOrder(1000);
  ctx.gateway.failNext = { op: 'createRefund', status: 503, times: 1 };
  const r = await ctx.engine.requestRefund({ orderId: 1, reason: 'ADMIN', idempotencyKey: 'f1' });
  await deliver(ctx, 'refund.failed', { id: 'rfnd_f', payment_id: ctx.store.payment(1).providerPaymentId, amount: 1000_00, status: 'failed', receipt: `rf_${r.id}` }, 'refund').run();
  assert.equal(ctx.store.state.refunds[0].status, 'FAILED');
  assert.equal(ctx.store.payment(1).refundedAmount, 0);
});

test('refunds require a captured payment', async () => {
  const ctx = setup();
  await ctx.engine.createPayment(1, 1);
  await rejects(ctx.engine.requestRefund({ orderId: 1, reason: 'ADMIN', idempotencyKey: 'x' }), 'NOT_REFUNDABLE');
});

// ===========================================================================
// Reconciliation
// ===========================================================================

const window = (ctx: ReturnType<typeof setup>) => ({ from: new Date(ctx.clock.t - 3600_000), to: new Date(ctx.clock.t + 3600_000) });

test('reconciliation heals a payment whose webhook was lost and the browser never reported', async () => {
  const ctx = setup();
  const { remote } = await startAndPay(ctx); // no webhook, no verify
  assert.equal(ctx.store.order(1).paymentStatus, 'PENDING');

  const rec = new PaymentReconciler(ctx.store, ctx.gateway, ctx.engine);
  const dry = await rec.run({ ...window(ctx), heal: false });
  assert.equal(dry.needsReview, 1);
  assert.equal(ctx.store.order(1).paymentStatus, 'PENDING', 'report-only mode changes nothing');

  const run = await rec.run(window(ctx));
  assert.equal(run.autoHealed, 1);
  assert.equal(ctx.store.order(1).paymentStatus, 'PAID');
  assert.equal(ctx.store.payment(1).providerPaymentId, remote.id);
  assert.deepEqual(ctx.paid, [1]);
  const again = await rec.run(window(ctx));
  assert.equal(again.autoHealed, 0);
  assert.equal(again.matched, 1);
});

test('reconciliation never fulfils on a mismatched capture: it refunds', async () => {
  const ctx = setup(1000);
  await startAndPay(ctx, { amount: 1 });
  const run = await new PaymentReconciler(ctx.store, ctx.gateway, ctx.engine).run(window(ctx));
  assert.equal(run.autoHealed, 1);
  assert.notEqual(ctx.store.order(1).paymentStatus, 'PAID');
  assert.equal(ctx.store.refundsFor(1).length, 1);
});

test('reconciliation flags (does not change) a PAID order with no money behind it', async () => {
  const ctx = setup();
  const { start, remote } = await startAndPay(ctx);
  await ctx.engine.verifyCheckout(1, { orderId: 1, razorpayOrderId: start.razorpayOrderId, razorpayPaymentId: remote.id, razorpaySignature: checkoutSignature(start.razorpayOrderId, remote.id) });
  ctx.gateway.payments.get(remote.id)!.status = 'failed'; // gateway disagrees
  const run = await new PaymentReconciler(ctx.store, ctx.gateway, ctx.engine).run(window(ctx));
  assert.equal(run.needsReview, 1);
  assert.equal(ctx.store.order(1).paymentStatus, 'PAID');
  assert.equal(ctx.store.state.runs.at(-1)!.items[0].kind, 'LOCAL_PAID_GATEWAY_NOT_CAPTURED');
});

test('reconciliation flags a PAID payment that Razorpay has no record of', async () => {
  const ctx = setup();
  const { remote } = await startAndPay(ctx);
  await deliver(ctx, 'payment.captured', remote).run();
  ctx.gateway.payments.delete(remote.id);
  const run = await new PaymentReconciler(ctx.store, ctx.gateway, ctx.engine).run(window(ctx));
  assert.equal(run.needsReview, 1);
  assert.equal(ctx.store.state.runs.at(-1)!.items[0].kind, 'LOCAL_PAID_MISSING_AT_GATEWAY');
});

test('reconciliation imports refunds made at the gateway and settles ones we left pending', async () => {
  const { ctx, remote } = await paidOrder(1000);
  // refund made directly in the dashboard
  await ctx.gateway.createRefund(remote.id, { amount: 300_00, receipt: 'dash', idempotencyKey: 'dash' });
  const rec = new PaymentReconciler(ctx.store, ctx.gateway, ctx.engine);
  const run = await rec.run(window(ctx));
  assert.equal(run.autoHealed, 1);
  assert.equal(ctx.store.payment(1).refundedAmount, 300_00);
  assert.equal(ctx.store.state.refunds[0].source, 'GATEWAY');
  assert.equal((await rec.run(window(ctx))).autoHealed, 0, 'second run finds nothing to fix');
});

test('syncOrderWithGateway recovers a captured payment the app never heard about', async () => {
  const ctx = setup();
  await startAndPay(ctx);
  const out = await ctx.engine.syncOrderWithGateway(1);
  assert.equal(out[0].outcome, 'PAID');
  assert.equal(ctx.store.order(1).status, 'CONFIRMED');
});
