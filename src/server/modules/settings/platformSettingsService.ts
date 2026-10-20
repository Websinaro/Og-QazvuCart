
import { db } from '@/src/db';
import { asc, eq, inArray } from 'drizzle-orm';
import { categories, platformSettings } from '@/src/db/schema';
import { assertValidBps, bpsToPercent, percentToBps } from '@/src/lib/commission';

export interface MarketplaceSettings {
  defaultCommissionBps: number;
  payoutHoldDays: number;
  minPayoutAmount: number;
}

const KEYS = {
  defaultCommissionBps: 'default_commission_bps',
  payoutHoldDays: 'payout_hold_days',
  minPayoutAmount: 'min_payout_amount',
} as const;

// Used only when the settings rows haven't been created (migration not run).
// Matches the values inserted by migration 0004.
const DEFAULTS: MarketplaceSettings = {
  defaultCommissionBps: 1000,
  payoutHoldDays: 7,
  minPayoutAmount: 500,
};

import type { DbClient } from '../orders/fulfilment';

type DbLike = Pick<DbClient, 'select'>;

export class PlatformSettingsService {
  static async get(client: DbLike = db): Promise<MarketplaceSettings> {
    const rows = await client
      .select({ key: platformSettings.key, value: platformSettings.value })
      .from(platformSettings)
      .where(inArray(platformSettings.key, Object.values(KEYS)));
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const num = (key: string, fallback: number) => {
      const raw = map.get(key);
      const n = raw === undefined ? NaN : Number(raw);
      return Number.isFinite(n) ? n : fallback;
    };

    return {
      defaultCommissionBps: num(KEYS.defaultCommissionBps, DEFAULTS.defaultCommissionBps),
      payoutHoldDays: num(KEYS.payoutHoldDays, DEFAULTS.payoutHoldDays),
      minPayoutAmount: num(KEYS.minPayoutAmount, DEFAULTS.minPayoutAmount),
    };
  }

  /** Admin-facing view with the commission default expressed as a percent. */
  static async getForAdmin() {
    const s = await this.get();
    return {
      defaultCommissionPercent: bpsToPercent(s.defaultCommissionBps),
      payoutHoldDays: s.payoutHoldDays,
      minPayoutAmount: s.minPayoutAmount,
    };
  }

  static async update(
    adminUserId: number,
    input: { defaultCommissionPercent?: number; payoutHoldDays?: number; minPayoutAmount?: number }
  ) {
    const writes: Array<{ key: string; value: string }> = [];

    if (input.defaultCommissionPercent !== undefined) {
      const bps = percentToBps(input.defaultCommissionPercent);
      assertValidBps(bps);
      writes.push({ key: KEYS.defaultCommissionBps, value: String(bps) });
    }
    if (input.payoutHoldDays !== undefined) {
      if (!Number.isInteger(input.payoutHoldDays) || input.payoutHoldDays < 0 || input.payoutHoldDays > 90) {
        throw new Error('Payout hold must be a whole number of days between 0 and 90.');
      }
      writes.push({ key: KEYS.payoutHoldDays, value: String(input.payoutHoldDays) });
    }
    if (input.minPayoutAmount !== undefined) {
      if (!Number.isInteger(input.minPayoutAmount) || input.minPayoutAmount < 0) {
        throw new Error('Minimum payout must be a non-negative whole number of rupees.');
      }
      writes.push({ key: KEYS.minPayoutAmount, value: String(input.minPayoutAmount) });
    }

    for (const w of writes) {
      await db
        .insert(platformSettings)
        .values({ key: w.key, value: w.value, updatedBy: adminUserId })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: { value: w.value, updatedBy: adminUserId, updatedAt: new Date() },
        });
    }
    return this.getForAdmin();
  }

  /** Every category with its commission override (null = uses the platform default). */
  static async listCategoryRates() {
    const rows = await db
      .select({ id: categories.id, name: categories.name, commissionBps: categories.commissionBps })
      .from(categories)
      .orderBy(asc(categories.displayOrder));
    return rows.map((r) => ({
      categoryId: r.id,
      name: r.name,
      commissionPercent: r.commissionBps === null ? null : bpsToPercent(r.commissionBps),
    }));
  }

  /** `null` clears the override. */
  static async setCategoryRate(categoryId: number, percent: number | null) {
    const bps = percent === null ? null : percentToBps(percent);
    const updated = await db
      .update(categories)
      .set({ commissionBps: bps, updatedAt: new Date() })
      .where(eq(categories.id, categoryId))
      .returning({ id: categories.id });
    if (updated.length === 0) throw new Error('Category not found');
    return { categoryId, commissionPercent: percent };
  }
}
