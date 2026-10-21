import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coversWholeParcel, lineNetOfCoupon, priceReturn, remainingReturnable, returnDeadline, type ReturnableLine,
} from '../src/lib/returnRules.ts';

const line = (over: Partial<ReturnableLine> = {}): ReturnableLine => ({
  orderItemId: 1, sellerOrderId: 10, quantity: 3, totalPrice: 1000, commissionAmount: 100, sellerEarning: 900, liveReturned: 0, ...over,
});
const noCoupon = { discount: 0, subtotal: 2000 };

test('returning one unit of a multi-unit line refunds one unit, not the line', () => {
  const p = priceReturn(line(), 1, noCoupon);
  assert.deepEqual(p, { lineAmount: 333, refundAmount: 333, commissionAmount: 33, sellerEarning: 300 });
});

test('returning every unit refunds exactly the line value', () => {
  const p = priceReturn(line(), 3, noCoupon);
  assert.deepEqual(p, { lineAmount: 1000, refundAmount: 1000, commissionAmount: 100, sellerEarning: 900 });
});

test('splitting a line across several returns adds up to exactly the line value (no rounding drift)', () => {
  let returned = 0;
  const total = { refund: 0, commission: 0, earning: 0 };
  for (let i = 0; i < 3; i++) {
    const p = priceReturn(line({ liveReturned: returned }), 1, noCoupon);
    total.refund += p.refundAmount; total.commission += p.commissionAmount; total.earning += p.sellerEarning;
    returned += 1;
  }
  assert.deepEqual(total, { refund: 1000, commission: 100, earning: 900 });
});

test('refund is net of the pro-rata coupon share', () => {
  // Order subtotal 2000 with a 200 coupon: this 1000 line carries a 100 discount.
  assert.equal(lineNetOfCoupon(1000, 200, 2000), 900);
  const p = priceReturn(line({ quantity: 1 }), 1, { discount: 200, subtotal: 2000 });
  assert.equal(p.refundAmount, 900);
  assert.equal(p.lineAmount, 1000); // seller's gross is unaffected by the platform coupon
});

test('a line cannot be returned beyond the units still available', () => {
  assert.equal(remainingReturnable(line({ liveReturned: 2 })), 1);
  assert.throws(() => priceReturn(line({ liveReturned: 2 }), 2, noCoupon), /more units than were ordered/);
  assert.throws(() => priceReturn(line(), 0, noCoupon), /positive whole number/);
  assert.throws(() => priceReturn(line(), 1.5, noCoupon), /positive whole number/);
});

test('a parcel counts as fully returned only when every unit of every line is approved', () => {
  assert.equal(coversWholeParcel([{ quantity: 2, approvedReturned: 2 }, { quantity: 1, approvedReturned: 1 }]), true);
  assert.equal(coversWholeParcel([{ quantity: 2, approvedReturned: 1 }, { quantity: 1, approvedReturned: 1 }]), false);
  assert.equal(coversWholeParcel([{ quantity: 2, approvedReturned: 2 }, { quantity: 1, approvedReturned: 0 }]), false);
  assert.equal(coversWholeParcel([]), false);
});

test('return window is measured from the parcel\'s own delivery date', () => {
  const d = new Date('2026-10-01T00:00:00Z');
  assert.equal(returnDeadline(d, 7).toISOString(), '2026-10-08T00:00:00.000Z');
});
