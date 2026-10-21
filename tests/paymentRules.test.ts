import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionPayment, planRefund, refundableAmount, checkPaymentAmount, classifyPayment,
  isRetryableGatewayStatus, nextRefundStatus, mapRefundStatus, rupeesToPaise,
} from '../src/lib/paymentRules';
import type { PaymentRecord, PaymentStatus } from '../src/lib/paymentRules';

const pay = (o: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: 1, orderId: 1, userId: 1, providerOrderId: 'order_1', providerPaymentId: null, amount: 100_00, capturedAmount: 0,
  refundedAmount: 0, currency: 'INR', status: 'CREATED', method: null, failureCode: null, failureReason: null,
  attemptNo: 1, idempotencyKey: null, createdAt: new Date(), ...o,
});

test('PAID can only move to REFUNDED; REFUNDED is terminal', () => {
  const all: PaymentStatus[] = ['CREATED', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'MISMATCH', 'REFUNDED'];
  for (const to of all) {
    assert.equal(canTransitionPayment('PAID', to), to === 'REFUNDED');
    assert.equal(canTransitionPayment('REFUNDED', to), false);
  }
  assert.equal(canTransitionPayment('FAILED', 'PAID'), true);
  assert.equal(canTransitionPayment('CANCELLED', 'PAID'), true);
});

test('checkPaymentAmount: gateway amount, currency and the order total must all agree', () => {
  const base = { paymentAmount: 100_00, paymentCurrency: 'INR', orderTotalRupees: 100, remoteAmount: 100_00, remoteCurrency: 'INR' };
  assert.equal(checkPaymentAmount(base), null);
  assert.equal(checkPaymentAmount({ ...base, remoteAmount: 99_99 }), 'AMOUNT_MISMATCH');
  assert.equal(checkPaymentAmount({ ...base, remoteCurrency: 'USD' }), 'CURRENCY_MISMATCH');
  assert.equal(checkPaymentAmount({ ...base, orderTotalRupees: 101 }), 'ORDER_TOTAL_MISMATCH');
  assert.throws(() => rupeesToPaise(10.5));
  assert.throws(() => rupeesToPaise(-1));
});

test('planRefund bounds', () => {
  const p = { status: 'PAID' as const, capturedAmount: 1000, refundedAmount: 400 };
  assert.deepEqual(planRefund(p), { ok: true, amount: 600 });
  assert.deepEqual(planRefund(p, 600), { ok: true, amount: 600 });
  assert.equal((planRefund(p, 601) as { error: string }).error, 'EXCEEDS_REFUNDABLE');
  for (const bad of [0, -5, 1.5, NaN]) assert.equal((planRefund(p, bad) as { error: string }).error, 'INVALID_AMOUNT');
  assert.equal((planRefund({ ...p, refundedAmount: 1000 }) as { error: string }).error, 'NOTHING_TO_REFUND');
  for (const status of ['CREATED', 'PENDING', 'AUTHORIZED', 'FAILED', 'CANCELLED', 'REFUNDED'] as const) {
    assert.equal(planRefund({ ...p, status }).ok, false);
    assert.equal(refundableAmount({ ...p, status }), 0);
  }
  assert.equal(planRefund({ ...p, status: 'MISMATCH' }).ok, true);
});

test('refund status helpers', () => {
  assert.equal(mapRefundStatus('processed'), 'PROCESSED');
  assert.equal(mapRefundStatus('FAILED'), 'FAILED');
  assert.equal(mapRefundStatus('pending'), 'PENDING');
  assert.equal(nextRefundStatus('PROCESSED', 'FAILED'), 'PROCESSED');
  assert.equal(nextRefundStatus('FAILED', 'PROCESSED'), 'PROCESSED');
  assert.equal(nextRefundStatus('PENDING', 'FAILED'), 'FAILED');
});

test('gateway error classification', () => {
  for (const s of [null, 408, 429, 500, 502, 503]) assert.equal(isRetryableGatewayStatus(s), true, String(s));
  for (const s of [400, 401, 403, 404, 422]) assert.equal(isRetryableGatewayStatus(s), false, String(s));
});

test('classifyPayment', () => {
  const remote = (status: string, extra = {}) => ({ id: 'pay_1', order_id: 'order_1', amount: 100_00, currency: 'INR', status, ...extra });
  assert.equal(classifyPayment(null, remote('captured')).kind, 'UNKNOWN_TO_LOCAL');
  assert.deepEqual(classifyPayment(pay(), remote('captured')), { kind: 'GATEWAY_CAPTURED_LOCAL_NOT_PAID', action: 'HEAL' });
  assert.equal(classifyPayment(pay({ status: 'PAID', capturedAmount: 100_00 }), remote('captured')).action, 'NONE');
  assert.equal(classifyPayment(pay({ status: 'PAID', capturedAmount: 90_00 }), remote('captured')).kind, 'PAID_AMOUNT_DIFFERS');
  assert.equal(classifyPayment(pay({ status: 'PAID', capturedAmount: 100_00 }), remote('captured', { amount_refunded: 50_00 }), 0).kind, 'REFUNDED_AMOUNT_DIFFERS');
  assert.equal(classifyPayment(pay({ status: 'PAID', capturedAmount: 100_00 }), remote('captured', { amount_refunded: 50_00 }), 50_00).action, 'NONE');
  assert.equal(classifyPayment(pay({ status: 'PAID', capturedAmount: 100_00 }), remote('failed')).kind, 'LOCAL_PAID_GATEWAY_NOT_CAPTURED');
  assert.equal(classifyPayment(pay({ status: 'PAID', capturedAmount: 100_00 }), remote('created')).action, 'REVIEW');
  assert.deepEqual(classifyPayment(pay({ status: 'CREATED' }), remote('failed')), { kind: 'GATEWAY_FAILED_LOCAL_OPEN', action: 'HEAL' });
  assert.equal(classifyPayment(pay({ status: 'FAILED' }), remote('failed')).action, 'NONE');
  assert.equal(classifyPayment(pay({ status: 'CREATED' }), remote('authorized')).action, 'HEAL');
  assert.equal(classifyPayment(pay({ status: 'CREATED' }), remote('refunded')).action, 'REVIEW', 'never auto-fulfil an already-refunded payment');
});
