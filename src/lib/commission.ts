/**
 * Pure commission / settlement math. No database, no I/O — everything here is
 * deterministic and unit-tested (see tests/commission.test.ts).
 *
 * Money is whole rupees (integers) everywhere in this codebase. Commission
 * rates are basis points: 1% = 100 bps, 10% = 1000 bps, 100% = 10000 bps.
 */

export const MAX_BPS = 10000;

export function assertValidBps(bps: number, label = 'Commission rate'): void {
  if (!Number.isInteger(bps) || bps < 0 || bps > MAX_BPS) {
    throw new Error(`${label} must be between 0% and 100%.`);
  }
}

/** 12.5 -> 1250. Rounds to the nearest basis point. */
export function percentToBps(percent: number): number {
  if (!Number.isFinite(percent)) throw new Error('Commission percent must be a number.');
  const bps = Math.round(percent * 100);
  assertValidBps(bps);
  return bps;
}

/** 1250 -> 12.5 */
export function bpsToPercent(bps: number): number {
  return Math.round(bps) / 100;
}

/**
 * Commission on an amount, rounded to the nearest whole rupee (half up).
 * Computed with integer math so e.g. 999 @ 12.5% is exact, never 124.875.
 */
export function calculateCommission(amount: number, rateBps: number): number {
  assertValidBps(rateBps);
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('Amount must be a non-negative whole number.');
  }
  return Math.floor((amount * rateBps + 5000) / 10000);
}

export type CommissionSource = 'SELLER' | 'CATEGORY' | 'PLATFORM';

export interface ResolvedRate {
  bps: number;
  source: CommissionSource;
}

/**
 * Precedence: seller override > category override > platform default.
 * `null`/`undefined` means "not set at this level".
 */
export function resolveCommissionRate(input: {
  sellerBps?: number | null;
  categoryBps?: number | null;
  platformDefaultBps: number;
}): ResolvedRate {
  if (input.sellerBps !== null && input.sellerBps !== undefined) {
    return { bps: input.sellerBps, source: 'SELLER' };
  }
  if (input.categoryBps !== null && input.categoryBps !== undefined) {
    return { bps: input.categoryBps, source: 'CATEGORY' };
  }
  return { bps: input.platformDefaultBps, source: 'PLATFORM' };
}

export interface PricedLine {
  totalPrice: number;
  rateBps: number;
}

export interface PricedLineResult {
  commissionAmount: number;
  sellerEarning: number;
}

/** Per-line commission snapshot: earning = line total - commission. */
export function priceLine(line: PricedLine): PricedLineResult {
  const commissionAmount = calculateCommission(line.totalPrice, line.rateBps);
  return { commissionAmount, sellerEarning: line.totalPrice - commissionAmount };
}

/**
 * Totals for one seller's parcel. Sums the *per-line* rounded commissions, so
 * the parcel total always equals the sum of what was stored on each item.
 */
export function summarizeSellerParcel(lines: PricedLine[]) {
  let subtotal = 0;
  let commissionAmount = 0;
  for (const l of lines) {
    const r = priceLine(l);
    subtotal += l.totalPrice;
    commissionAmount += r.commissionAmount;
  }
  return { subtotal, commissionAmount, sellerEarning: subtotal - commissionAmount };
}

/**
 * Net payable for a payout: eligible earnings plus signed adjustments.
 * Negative results mean the seller owes the platform and nothing is paid;
 * the shortfall carries forward because adjustments stay unapplied.
 */
export function computePayoutNet(input: { earnings: number; adjustments: number }): number {
  return input.earnings + input.adjustments;
}
