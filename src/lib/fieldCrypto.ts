/**
 * Field-level encryption (AES-256-GCM) for payout account numbers.
 *
 * PAYOUT_ENCRYPTION_KEY must be 32 random bytes, base64-encoded:
 *   openssl rand -base64 32
 * Like every other secret in this codebase it has NO fallback; saving payout
 * details fails loudly if it is missing instead of storing plaintext.
 *
 * Format: v1:<iv b64>:<tag b64>:<ciphertext b64>
 */
import crypto from 'crypto';

function getKey(): Buffer {
  const raw = process.env.PAYOUT_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error('PAYOUT_ENCRYPTION_KEY is required to store payout details. See .env.example.');
  }
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== 32) {
    throw new Error('PAYOUT_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).');
  }
  return key;
}

export function encryptField(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptField(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Unrecognised encrypted payload format.');
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

export function maskAccount(last4: string | null | undefined): string | null {
  return last4 ? `••••${last4}` : null;
}
