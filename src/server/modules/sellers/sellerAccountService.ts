import { assertPickupServiceable } from '@/src/lib/shiprocket';
import { and, asc, desc, eq, ilike, or, sql, SQL } from 'drizzle-orm';
import { db } from '@/src/db';
import { sellers, users, products, sellerOrders, categories } from '@/src/db/schema';
import { bpsToPercent, percentToBps, resolveCommissionRate } from '@/src/lib/commission';
import { decryptField, encryptField, maskAccount } from '@/src/lib/fieldCrypto';
import { NotificationService } from '../notifications/notificationService';
import { PlatformSettingsService } from '../settings/platformSettingsService';
import { NotFoundError } from '../orders/fulfilment';

export interface SellerApplicationInput {
  storeName: string;
  description?: string;
  supportEmail?: string;
  supportPhone?: string;
  businessAddress: string;
  pickupCity: string;
  pickupState: string;
  pickupPincode: string;
  taxId?: string;
}

export interface PayoutDetailsInput {
  accountHolder?: string;
  bankName?: string;
  ifsc?: string;
  accountNumber?: string;
  upiId?: string;
}

type SellerRow = typeof sellers.$inferSelect;

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'store';
}

function isUniqueViolation(err: unknown, constraintHint?: string): boolean {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } } | null;
  const code = e?.code ?? e?.cause?.code;
  const constraint = e?.constraint ?? e?.cause?.constraint;
  if (code !== '23505') return false;
  return constraintHint ? Boolean(constraint && constraint.includes(constraintHint)) : true;
}

/** Seller-facing shape: payout account is only ever exposed masked. */
function toSellerProfile(s: SellerRow) {
  return {
    id: s.id,
    storeName: s.storeName,
    slug: s.slug,
    status: s.status,
    isVerified: s.isVerified,
    description: s.description,
    supportEmail: s.supportEmail,
    supportPhone: s.supportPhone,
    businessAddress: s.businessAddress,
    pickupCity: s.pickupCity,
    pickupState: s.pickupState,
    pickupPincode: s.pickupPincode,
    taxId: s.taxId,
    rating: Number(s.rating || 0),
    reviewCount: s.reviewCount,
    commissionOverridePercent: s.commissionBps === null ? null : bpsToPercent(s.commissionBps),
    rejectionReason: s.rejectionReason,
    suspensionReason: s.suspensionReason,
    approvedAt: s.approvedAt ? s.approvedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    payout: {
      accountHolder: s.payoutAccountHolder,
      bankName: s.payoutBankName,
      ifsc: s.payoutIfsc,
      accountMasked: maskAccount(s.payoutAccountLast4),
      upiId: s.payoutUpiId,
      isConfigured: Boolean((s.payoutAccountEnc && s.payoutAccountHolder && s.payoutIfsc) || s.payoutUpiId),
    },
  };
}

export class SellerAccountService {
  // -------------------------------------------------------------------
  // Application (seller-side)
  // -------------------------------------------------------------------

  private static async uniqueSlug(storeName: string): Promise<string> {
    const base = slugify(storeName);
    for (let i = 0; i < 6; i++) {
      const candidate = i === 0 ? base : `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
      const [hit] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.slug, candidate)).limit(1);
      if (!hit) return candidate;
    }
    return `${base}-${Date.now()}`;
  }

  /** True when another store already uses this name (case-insensitive). */
  static async isStoreNameTaken(storeName: string, exceptSellerId?: number): Promise<boolean> {
    const rows = await db
      .select({ id: sellers.id })
      .from(sellers)
      .where(sql`LOWER(${sellers.storeName}) = ${storeName.trim().toLowerCase()}`)
      .limit(2);
    return rows.some((r) => r.id !== exceptSellerId);
  }

  /**
   * A signed-in customer applies to sell (or re-applies after a rejection).
   * The account stays a CUSTOMER until an admin approves the application, so
   * nobody can reach seller tools just by submitting a form.
   */
  static async apply(userId: number, input: SellerApplicationInput) {
    await assertPickupServiceable(input.pickupPincode);
    const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error('User not found');
    if (user.role === 'ADMIN') throw new Error('Admin accounts cannot apply as sellers.');

    const [existing] = await db.select().from(sellers).where(eq(sellers.userId, userId)).limit(1);

    if (existing) {
      if (existing.status === 'PENDING') throw new Error('Your application is already under review.');
      if (existing.status === 'APPROVED') throw new Error('You are already an approved seller.');
      if (existing.status === 'SUSPENDED') throw new Error('Your seller account is suspended. Please contact support.');

      // REJECTED -> resubmit with updated details.
      if (await this.isStoreNameTaken(input.storeName, existing.id)) {
        throw new Error('A store with this name already exists. Please choose another name.');
      }
      const [updated] = await db
        .update(sellers)
        .set({
          storeName: input.storeName,
          description: input.description ?? null,
          supportEmail: input.supportEmail ?? null,
          supportPhone: input.supportPhone ?? null,
          businessAddress: input.businessAddress,
          pickupCity: input.pickupCity,
          pickupState: input.pickupState,
          pickupPincode: input.pickupPincode,
          taxId: input.taxId ?? null,
          status: 'PENDING',
          rejectionReason: null,
          statusChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sellers.id, existing.id))
        .returning();
      return toSellerProfile(updated);
    }

    if (await this.isStoreNameTaken(input.storeName)) {
      throw new Error('A store with this name already exists. Please choose another name.');
    }

    try {
      const [created] = await db
        .insert(sellers)
        .values({
          userId,
          storeName: input.storeName,
          slug: await this.uniqueSlug(input.storeName),
          description: input.description ?? null,
          supportEmail: input.supportEmail ?? null,
          supportPhone: input.supportPhone ?? null,
          businessAddress: input.businessAddress,
          pickupCity: input.pickupCity,
          pickupState: input.pickupState,
          pickupPincode: input.pickupPincode,
          taxId: input.taxId ?? null,
          // Explicit, so the DB default can never accidentally make a new store live.
          status: 'PENDING',
          isVerified: false,
          rating: '0',
          reviewCount: 0,
        })
        .returning();
      return toSellerProfile(created);
    } catch (err) {
      if (isUniqueViolation(err, 'user_id')) throw new Error('You have already submitted a seller application.');
      if (isUniqueViolation(err)) throw new Error('That store name is already in use. Please try a different one.');
      throw err;
    }
  }

  /** The caller's own seller record (any status), or null if they never applied. */
  static async getMine(userId: number) {
    const [row] = await db.select().from(sellers).where(eq(sellers.userId, userId)).limit(1);
    return row ? toSellerProfile(row) : null;
  }

  /** Any seller's profile by id (admin "view as seller" only). */
  static async getById(sellerId: number) {
    const [row] = await db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    return row ? toSellerProfile(row) : null;
  }

  static async updateProfile(sellerId: number, input: Partial<SellerApplicationInput>) {
    if (input.pickupPincode !== undefined) await assertPickupServiceable(input.pickupPincode);
    const updates: Partial<typeof sellers.$inferInsert> = { updatedAt: new Date() };

    if (input.storeName !== undefined) {
      if (await this.isStoreNameTaken(input.storeName, sellerId)) {
        throw new Error('A store with this name already exists. Please choose another name.');
      }
      // The slug (public URL) is intentionally stable once created.
      updates.storeName = input.storeName;
    }
    if (input.description !== undefined) updates.description = input.description || null;
    if (input.supportEmail !== undefined) updates.supportEmail = input.supportEmail || null;
    if (input.supportPhone !== undefined) updates.supportPhone = input.supportPhone || null;
    if (input.businessAddress !== undefined) updates.businessAddress = input.businessAddress;
    if (input.pickupCity !== undefined) updates.pickupCity = input.pickupCity;
    if (input.pickupState !== undefined) updates.pickupState = input.pickupState;
    if (input.pickupPincode !== undefined) updates.pickupPincode = input.pickupPincode;
    // Address changed: the courier pickup location must be re-registered on next shipment.
    if (input.businessAddress !== undefined || input.pickupPincode !== undefined) updates.shiprocketPickup = null;
    if (input.taxId !== undefined) updates.taxId = input.taxId || null;

    const [updated] = await db.update(sellers).set(updates).where(eq(sellers.id, sellerId)).returning();
    if (!updated) throw new NotFoundError('Seller not found');
    return toSellerProfile(updated);
  }

  // -------------------------------------------------------------------
  // Payout destination
  // -------------------------------------------------------------------

  /** `client` lets a caller run this inside its own transaction (e.g. together with an audit row). */
  static async savePayoutDetails(sellerId: number, input: PayoutDetailsInput, client: Pick<typeof db, 'update'> = db) {
    const updates: Partial<typeof sellers.$inferInsert> = { updatedAt: new Date() };

    if (input.accountHolder !== undefined) updates.payoutAccountHolder = input.accountHolder;
    if (input.bankName !== undefined) updates.payoutBankName = input.bankName;
    if (input.ifsc !== undefined) updates.payoutIfsc = input.ifsc;
    if (input.upiId !== undefined) updates.payoutUpiId = input.upiId || null;
    if (input.accountNumber !== undefined) {
      updates.payoutAccountEnc = encryptField(input.accountNumber);
      updates.payoutAccountLast4 = input.accountNumber.slice(-4);
    }

    const [updated] = await client.update(sellers).set(updates).where(eq(sellers.id, sellerId)).returning();
    if (!updated) throw new NotFoundError('Seller not found');
    return toSellerProfile(updated).payout;
  }

  /**
   * Full (decrypted) payout destination — ADMIN payout screens only, never
   * returned by any seller-facing route.
   */
  static revealPayoutDestination(s: SellerRow) {
    return {
      accountHolder: s.payoutAccountHolder,
      bankName: s.payoutBankName,
      ifsc: s.payoutIfsc,
      accountNumber: s.payoutAccountEnc ? decryptField(s.payoutAccountEnc) : null,
      upiId: s.payoutUpiId,
    };
  }

  /** Masked snapshot stored on each payout so history survives later edits. */
  static maskedDestinationSnapshot(s: SellerRow) {
    return {
      accountHolder: s.payoutAccountHolder,
      bankName: s.payoutBankName,
      ifsc: s.payoutIfsc,
      accountMasked: maskAccount(s.payoutAccountLast4),
      upiId: s.payoutUpiId,
    };
  }

  // -------------------------------------------------------------------
  // Commission transparency for sellers
  // -------------------------------------------------------------------

  /** What rate applies to each category for this seller, and why. */
  static async getRateCard(sellerId: number) {
    const [seller] = await db.select({ commissionBps: sellers.commissionBps }).from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    if (!seller) throw new NotFoundError('Seller not found');
    const settings = await PlatformSettingsService.get();
    const cats = await db
      .select({ id: categories.id, name: categories.name, commissionBps: categories.commissionBps })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.displayOrder));

    return {
      platformDefaultPercent: bpsToPercent(settings.defaultCommissionBps),
      sellerOverridePercent: seller.commissionBps === null ? null : bpsToPercent(seller.commissionBps),
      payoutHoldDays: settings.payoutHoldDays,
      minPayoutAmount: settings.minPayoutAmount,
      categories: cats.map((c) => {
        const r = resolveCommissionRate({
          sellerBps: seller.commissionBps,
          categoryBps: c.commissionBps,
          platformDefaultBps: settings.defaultCommissionBps,
        });
        return { categoryId: c.id, name: c.name, percent: bpsToPercent(r.bps), source: r.source };
      }),
    };
  }

  // -------------------------------------------------------------------
  // Admin: review + lifecycle
  // -------------------------------------------------------------------

  static async listForAdmin(params: { status?: string; q?: string; id?: number } = {}) {
    const conditions: SQL[] = [];
    if (params.id !== undefined) conditions.push(eq(sellers.id, params.id));
    if (params.status && params.status !== 'ALL') conditions.push(eq(sellers.status, params.status.toUpperCase()));
    if (params.q && params.q.trim()) {
      const term = `%${params.q.trim()}%`;
      conditions.push(or(ilike(sellers.storeName, term), ilike(users.email, term), ilike(users.username, term))!);
    }

    const rows = await db
      .select({
        seller: sellers,
        ownerUsername: users.username,
        ownerEmail: users.email,
        ownerPhone: users.phone,
        productCount: sql<number>`(SELECT count(*)::int FROM ${products} WHERE ${products.sellerId} = ${sellers.id})`,
        lifetimeSales: sql<number>`(SELECT COALESCE(SUM(${sellerOrders.subtotal}), 0)::int FROM ${sellerOrders} WHERE ${sellerOrders.sellerId} = ${sellers.id} AND ${sellerOrders.status} NOT IN ('CANCELLED', 'RETURNED') AND ${sellerOrders.settlementStatus} <> 'LEGACY')`,
      })
      .from(sellers)
      .innerJoin(users, eq(sellers.userId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(
        // Applications awaiting review float to the top.
        sql`CASE ${sellers.status} WHEN 'PENDING' THEN 0 ELSE 1 END`,
        desc(sellers.createdAt)
      )
      .limit(300);

    const counts = await db
      .select({ status: sellers.status, count: sql<number>`count(*)::int` })
      .from(sellers)
      .groupBy(sellers.status);

    return {
      sellers: rows.map((r) => ({
        ...toSellerProfile(r.seller),
        ownerUsername: r.ownerUsername,
        ownerEmail: r.ownerEmail,
        ownerPhone: r.ownerPhone,
        productCount: r.productCount,
        lifetimeSales: r.lifetimeSales,
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c.count])) as Record<string, number>,
    };
  }

  private static async loadForUpdate(tx: Pick<typeof db, 'select'>, sellerId: number) {
    const [row] = await tx.select().from(sellers).where(eq(sellers.id, sellerId)).for('update');
    if (!row) throw new NotFoundError('Seller not found');
    return row;
  }

  /** Approving (or reinstating) makes sure the owner's account actually carries the SELLER role. */
  private static async grantSellerRole(tx: Pick<typeof db, 'update'>, userId: number) {
    await tx
      .update(users)
      .set({ role: 'SELLER', updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.role, 'CUSTOMER')));
  }

  static async approve(sellerId: number, adminUserId: number) {
    const seller = await db.transaction(async (tx) => {
      const current = await this.loadForUpdate(tx, sellerId);
      if (current.status === 'APPROVED') throw new Error('This seller is already approved.');
      if (current.status === 'SUSPENDED') throw new Error('Use "Reinstate" for a suspended seller.');

      const [updated] = await tx
        .update(sellers)
        .set({
          status: 'APPROVED',
          isVerified: true,
          approvedAt: new Date(),
          approvedBy: adminUserId,
          rejectionReason: null,
          suspensionReason: null,
          statusChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sellers.id, sellerId))
        .returning();
      await this.grantSellerRole(tx, updated.userId);
      return updated;
    });

    void NotificationService.notifyUser(seller.userId, {
      type: 'SYSTEM',
      title: 'Your seller application was approved 🎉',
      body: `${seller.storeName} is now live. Add products and start selling from the Seller Center.`,
      link: '/seller-center',
    });
    return toSellerProfile(seller);
  }

  static async reject(sellerId: number, reason: string) {
    const seller = await db.transaction(async (tx) => {
      const current = await this.loadForUpdate(tx, sellerId);
      if (current.status !== 'PENDING') throw new Error('Only pending applications can be rejected.');
      const [updated] = await tx
        .update(sellers)
        .set({ status: 'REJECTED', isVerified: false, rejectionReason: reason, statusChangedAt: new Date(), updatedAt: new Date() })
        .where(eq(sellers.id, sellerId))
        .returning();
      return updated;
    });

    void NotificationService.notifyUser(seller.userId, {
      type: 'SYSTEM',
      title: 'Update on your seller application',
      body: `Your application for ${seller.storeName} was not approved: ${reason}. You can update your details and re-apply.`,
      link: '/sell',
    });
    return toSellerProfile(seller);
  }

  static async suspend(sellerId: number, reason: string) {
    const seller = await db.transaction(async (tx) => {
      const current = await this.loadForUpdate(tx, sellerId);
      if (current.status !== 'APPROVED') throw new Error('Only approved sellers can be suspended.');
      const [updated] = await tx
        .update(sellers)
        .set({ status: 'SUSPENDED', isVerified: false, suspensionReason: reason, statusChangedAt: new Date(), updatedAt: new Date() })
        .where(eq(sellers.id, sellerId))
        .returning();
      return updated;
    });

    void NotificationService.notifyUser(seller.userId, {
      type: 'SYSTEM',
      title: 'Your seller account has been suspended',
      body: `${seller.storeName} is hidden from the storefront: ${reason}. You can still fulfil open orders.`,
      link: '/seller-center',
    });
    return toSellerProfile(seller);
  }

  static async reinstate(sellerId: number) {
    const seller = await db.transaction(async (tx) => {
      const current = await this.loadForUpdate(tx, sellerId);
      if (current.status !== 'SUSPENDED') throw new Error('Only suspended sellers can be reinstated.');
      const [updated] = await tx
        .update(sellers)
        .set({ status: 'APPROVED', isVerified: true, suspensionReason: null, statusChangedAt: new Date(), updatedAt: new Date() })
        .where(eq(sellers.id, sellerId))
        .returning();
      await this.grantSellerRole(tx, updated.userId);
      return updated;
    });

    void NotificationService.notifyUser(seller.userId, {
      type: 'SYSTEM',
      title: 'Your seller account is active again',
      body: `${seller.storeName} is back on the storefront.`,
      link: '/seller-center',
    });
    return toSellerProfile(seller);
  }

  /** `null` clears the per-seller override (category/platform default applies again). */
  static async setCommission(sellerId: number, percent: number | null) {
    const bps = percent === null ? null : percentToBps(percent);
    const [updated] = await db
      .update(sellers)
      .set({ commissionBps: bps, updatedAt: new Date() })
      .where(eq(sellers.id, sellerId))
      .returning();
    if (!updated) throw new NotFoundError('Seller not found');
    return toSellerProfile(updated);
  }

  /** Called when an admin demotes a SELLER account: the store goes dark immediately. */
  static async suspendBecauseRoleRemoved(userId: number) {
    await db
      .update(sellers)
      .set({
        status: 'SUSPENDED',
        isVerified: false,
        suspensionReason: 'Seller access was removed by an administrator.',
        statusChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(sellers.userId, userId), eq(sellers.status, 'APPROVED')));
  }

  /** Raw row for admin payout screens (needs the encrypted destination). */
  static async getRawById(sellerId: number): Promise<SellerRow | null> {
    const [row] = await db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    return row || null;
  }
}
