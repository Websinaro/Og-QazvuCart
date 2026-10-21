import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_PERMISSIONS, STEP_UP_MAX_FAILURES, changedPayoutFields, isReadOnlyMethod, isStepUpLocked,
} from '../src/lib/adminAccessPolicy.ts';

test('admin view-as allows only read methods', () => {
  for (const m of ['GET', 'HEAD', 'OPTIONS', 'get']) assert.equal(isReadOnlyMethod(m), true, m);
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'put']) assert.equal(isReadOnlyMethod(m), false, m);
});

test('unknown or missing methods fail closed', () => {
  assert.equal(isReadOnlyMethod(undefined), false);
  assert.equal(isReadOnlyMethod(null), false);
  assert.equal(isReadOnlyMethod(''), false);
  assert.equal(isReadOnlyMethod('PROPFIND'), false);
});

test('payout-details writes need their own permission, distinct from the ADMIN role', () => {
  assert.equal(ADMIN_PERMISSIONS.SELLER_PAYOUT_DETAILS_WRITE, 'seller_payout_details:write');
});

test('step-up locks out after the allowed number of failures', () => {
  assert.equal(isStepUpLocked(STEP_UP_MAX_FAILURES - 1), false);
  assert.equal(isStepUpLocked(STEP_UP_MAX_FAILURES), true);
  assert.equal(isStepUpLocked(STEP_UP_MAX_FAILURES + 3), true);
});

test('audit log records which payout fields changed, never their values', () => {
  const fields = changedPayoutFields({ accountNumber: '123456789012', ifsc: 'HDFC0001234', note: 'ignored', upiId: undefined });
  assert.deepEqual(fields, ['ifsc', 'accountNumber']);
  assert.ok(!JSON.stringify(fields).includes('123456789012'));
});
