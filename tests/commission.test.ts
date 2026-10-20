import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCommission, percentToBps, bpsToPercent, resolveCommissionRate,
  summarizeSellerParcel, priceLine, computePayoutNet,
} from '../src/lib/commission.ts';
import { aggregateOrderStatus, canCustomerCancel } from '../src/lib/fulfilmentStatus.ts';

test('calculateCommission rounds half-up in whole rupees', () => {
  assert.equal(calculateCommission(1000, 1000), 100);   // 10%
  assert.equal(calculateCommission(999, 1250), 125);    // 124.875 -> 125
  assert.equal(calculateCommission(1, 1000), 0);        // 0.1 -> 0
  assert.equal(calculateCommission(5, 1000), 1);        // 0.5 -> 1
  assert.equal(calculateCommission(0, 1000), 0);
  assert.equal(calculateCommission(1234, 0), 0);
  assert.equal(calculateCommission(1234, 10000), 1234);
});

test('calculateCommission rejects bad input', () => {
  assert.throws(() => calculateCommission(-1, 1000));
  assert.throws(() => calculateCommission(10.5, 1000));
  assert.throws(() => calculateCommission(100, -1));
  assert.throws(() => calculateCommission(100, 10001));
  assert.throws(() => calculateCommission(100, 10.5));
});

test('percent <-> bps', () => {
  assert.equal(percentToBps(12.5), 1250);
  assert.equal(percentToBps(0), 0);
  assert.equal(percentToBps(100), 10000);
  assert.equal(bpsToPercent(1250), 12.5);
  assert.throws(() => percentToBps(100.01));
  assert.throws(() => percentToBps(-1));
  assert.throws(() => percentToBps(NaN));
});

test('rate precedence: seller > category > platform', () => {
  assert.deepEqual(resolveCommissionRate({ sellerBps: 500, categoryBps: 800, platformDefaultBps: 1000 }), { bps: 500, source: 'SELLER' });
  assert.deepEqual(resolveCommissionRate({ sellerBps: null, categoryBps: 800, platformDefaultBps: 1000 }), { bps: 800, source: 'CATEGORY' });
  assert.deepEqual(resolveCommissionRate({ categoryBps: null, platformDefaultBps: 1000 }), { bps: 1000, source: 'PLATFORM' });
  // An explicit 0% seller override must win (0 is not "unset").
  assert.deepEqual(resolveCommissionRate({ sellerBps: 0, categoryBps: 800, platformDefaultBps: 1000 }), { bps: 0, source: 'SELLER' });
});

test('parcel total equals the sum of per-line rounded commissions', () => {
  const lines = [
    { totalPrice: 999, rateBps: 1250 },   // 125
    { totalPrice: 333, rateBps: 1000 },   // 33
    { totalPrice: 5, rateBps: 1000 },     // 1
  ];
  const r = summarizeSellerParcel(lines);
  assert.equal(r.subtotal, 1337);
  assert.equal(r.commissionAmount, 125 + 33 + 1);
  assert.equal(r.sellerEarning, 1337 - 159);
  assert.equal(lines.map((l) => priceLine(l).sellerEarning).reduce((a, b) => a + b, 0), r.sellerEarning);
});

test('payout net carries negative balances', () => {
  assert.equal(computePayoutNet({ earnings: 900, adjustments: -100 }), 800);
  assert.equal(computePayoutNet({ earnings: 0, adjustments: -100 }), -100);
});

test('aggregateOrderStatus: least advanced live parcel wins', () => {
  assert.equal(aggregateOrderStatus([]), null);
  assert.equal(aggregateOrderStatus(['CONFIRMED']), 'CONFIRMED');
  assert.equal(aggregateOrderStatus(['SHIPPED', 'CONFIRMED']), 'CONFIRMED');
  assert.equal(aggregateOrderStatus(['DELIVERED', 'OUT_FOR_DELIVERY']), 'OUT_FOR_DELIVERY');
  assert.equal(aggregateOrderStatus(['DELIVERED', 'DELIVERED']), 'DELIVERED');
});

test('aggregateOrderStatus: cancelled/returned parcels are ignored while others are live', () => {
  assert.equal(aggregateOrderStatus(['CANCELLED', 'PACKED']), 'PACKED');
  assert.equal(aggregateOrderStatus(['RETURNED', 'DELIVERED']), 'DELIVERED');
  assert.equal(aggregateOrderStatus(['CANCELLED', 'CANCELLED']), 'CANCELLED');
  assert.equal(aggregateOrderStatus(['CANCELLED', 'RETURNED']), 'RETURNED');
  assert.equal(aggregateOrderStatus(['RETURNED']), 'RETURNED');
});

test('canCustomerCancel only while every live parcel is pre-dispatch', () => {
  assert.equal(canCustomerCancel(['CONFIRMED', 'PACKED']), true);
  assert.equal(canCustomerCancel(['CONFIRMED', 'SHIPPED']), false);
  assert.equal(canCustomerCancel(['CANCELLED', 'CONFIRMED']), true);
  assert.equal(canCustomerCancel(['CANCELLED']), false);
  assert.equal(canCustomerCancel(['DELIVERED']), false);
});
