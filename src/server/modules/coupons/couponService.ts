import { and, eq, sql } from 'drizzle-orm';
import type { PgTransaction, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { db } from '@/src/db';
import * as schema from '@/src/db/schema';
import { coupons, couponRedemptions } from '@/src/db/schema';

// Same rationale as OrderService's DbClient: helpers here may run either
// standalone (the /validate preview endpoint) or inside the order-creation
// transaction (the actual redemption), so they accept either.
export type DbClient = typeof db | PgTransaction<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export interface CouponValidationResult {
  valid: boolean;
  message: string;
  coupon?: {
    id: number;
    code: string;
    type: 'PERCENT' | 'FIXED';
    value: number;
  };
  discountAmount: number;
}

export class CouponService {
  /**
   * Checks a code against every business rule (exists, active, not
   * expired, minimum order met, global usage limit, per-user usage limit)
   * and returns the resulting discount WITHOUT recording a redemption.
   * Safe to call as many times as the person edits their cart — nothing
   * is persisted until `redeem` runs inside the order transaction.
   */
  static async validate(code: string, userId: number, subtotal: number, client: DbClient = db): Promise<CouponValidationResult> {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      return { valid: false, message: 'Enter a coupon code', discountAmount: 0 };
    }

    const [coupon] = await client.select().from(coupons).where(eq(coupons.code, normalizedCode)).limit(1);

    if (!coupon) {
      return { valid: false, message: 'Invalid coupon code', discountAmount: 0 };
    }
    if (!coupon.isActive) {
      return { valid: false, message: 'This coupon is no longer active', discountAmount: 0 };
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return { valid: false, message: 'This coupon has expired', discountAmount: 0 };
    }
    if (subtotal < coupon.minOrderValue) {
      return {
        valid: false,
        message: `Add ${coupon.minOrderValue - subtotal} more to your cart to use this coupon`,
        discountAmount: 0,
      };
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, message: 'This coupon has reached its usage limit', discountAmount: 0 };
    }

    const [{ count: userRedemptions }] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(couponRedemptions)
      .where(and(eq(couponRedemptions.couponId, coupon.id), eq(couponRedemptions.userId, userId)));

    if (userRedemptions >= coupon.perUserLimit) {
      return { valid: false, message: "You've already used this coupon", discountAmount: 0 };
    }

    let discountAmount =
      coupon.type === 'PERCENT' ? Math.round((subtotal * coupon.value) / 100) : coupon.value;

    if (coupon.type === 'PERCENT' && coupon.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }
    // A coupon can never make the order free-and-then-some — clamp to the
    // subtotal so `total = subtotal - discount + delivery` never goes
    // negative regardless of coupon configuration.
    discountAmount = Math.min(discountAmount, subtotal);

    return {
      valid: true,
      message: `Coupon applied — you save ${discountAmount}`,
      coupon: { id: coupon.id, code: coupon.code, type: coupon.type as 'PERCENT' | 'FIXED', value: coupon.value },
      discountAmount,
    };
  }

  /**
   * Records the redemption and increments used_count. MUST be called with
   * the same transaction (`tx`) that creates the order, and only after
   * validate() has already confirmed the coupon is usable — this method
   * doesn't re-check business rules, it just persists the result.
   */
  static async redeem(tx: DbClient, couponId: number, userId: number, orderId: number, discountAmount: number) {
    await tx.insert(couponRedemptions).values({ couponId, userId, orderId, discountAmount });
    await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.id, couponId));
  }

  // ------------------------------------------------------------------
  // Admin CRUD
  // ------------------------------------------------------------------

  static async listAll() {
    return db.select().from(coupons).orderBy(sql`${coupons.createdAt} DESC`);
  }

  static async create(createdBy: number, input: {
    code: string;
    description?: string;
    type: 'PERCENT' | 'FIXED';
    value: number;
    minOrderValue?: number;
    maxDiscountAmount?: number | null;
    usageLimit?: number | null;
    perUserLimit?: number;
    expiresAt?: Date | null;
  }) {
    const normalizedCode = input.code.trim().toUpperCase();
    const [existing] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.code, normalizedCode)).limit(1);
    if (existing) throw new Error(`A coupon with code "${normalizedCode}" already exists`);

    const [row] = await db
      .insert(coupons)
      .values({
        code: normalizedCode,
        description: input.description || null,
        type: input.type,
        value: input.value,
        minOrderValue: input.minOrderValue ?? 0,
        maxDiscountAmount: input.maxDiscountAmount ?? null,
        usageLimit: input.usageLimit ?? null,
        perUserLimit: input.perUserLimit ?? 1,
        expiresAt: input.expiresAt ?? null,
        createdBy,
      })
      .returning();
    return row;
  }

  static async setActive(id: number, isActive: boolean) {
    const [row] = await db.update(coupons).set({ isActive }).where(eq(coupons.id, id)).returning();
    return row;
  }

  static async remove(id: number) {
    await db.delete(coupons).where(eq(coupons.id, id));
  }
}
