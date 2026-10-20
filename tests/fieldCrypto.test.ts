import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encryptField, decryptField, maskAccount } from '../src/lib/fieldCrypto.ts';

test('encrypt/decrypt round trip, random IV, tamper detection', () => {
  process.env.PAYOUT_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  const a = encryptField('123456789012');
  const b = encryptField('123456789012');
  assert.notEqual(a, b);
  assert.equal(decryptField(a), '123456789012');
  const parts = a.split(':');
  parts[3] = Buffer.from('tampered').toString('base64');
  assert.throws(() => decryptField(parts.join(':')));
});

test('missing or short key fails loudly', () => {
  delete process.env.PAYOUT_ENCRYPTION_KEY;
  assert.throws(() => encryptField('x'), /PAYOUT_ENCRYPTION_KEY is required/);
  process.env.PAYOUT_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
  assert.throws(() => encryptField('x'), /32 bytes/);
});

test('maskAccount', () => {
  assert.equal(maskAccount('9012'), '••••9012');
  assert.equal(maskAccount(null), null);
});
