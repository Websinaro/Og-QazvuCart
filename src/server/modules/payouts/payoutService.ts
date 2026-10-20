import { and, desc, eq, isNull, sql, SQL } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  orders,
  orderItems,
  sellers,
  users,
  sellerOrders,
  sellerPayouts,
  sellerAdjustments,
} from '@/src/db/schema';
import { bpsToPercent, computePayoutNet } from '@/src/lib/commission';
import { NotFoundError } from '../orders/fulfilment';
import { NotificationService } from '../notifications/notificationService';
import { PlatformSettingsService } from '../settings/platformSettingsService';
import { SellerAccountService } from '../sellers/sellerAccountService';
import { computeBuckets } from '../seller/sellerEarningsService';
import { payableCondition } from './eligibility';

function payoutNumber(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `PO-${ymd}-${Math.floor(100000 + Math.random() * 900000)}`;
}

/** CSV cell with quoting + spreadsheet-formula neutralisation (product names are seller-controlled). */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export class PayoutService {
  // -------------------------------------------------------------------
  // Overview: who can be paid right now
  // -------------------------------------------------------------------
  static async payableOverview() {
    const [buckets, settings] = await Promise.all([computeBuckets(), PlatformSettingsService.get()]);

    const rows = await db
      .select({
        id: sellers.id,
        storeName: sellers.storeName,
        status: sellers.status,
        ownerEmail: users.email,
        hasPayoutDetails: sql<boolean>`(${sellers.payoutAccountEnc} IS NOT NULL AND ${sellers.payoutAccountHolder} IS NOT NULL AND ${sellers.payoutIfsc} IS NOT NULL) OR ${sellers.payoutUpiId} IS NOT NULL`,
      })
      .from(sellers)
      .innerJoin(users, eq(sellers.userId, users.id))
      .orderBy(sellers.storeName);

    const overview = rows
      .map((s) => {
        const b = buckets.get(s.id);
        return {
          sellerId: s.id,
          storeName: s.storeName,
          status: s.status,
          ownerEmail: s.ownerEmail,
          hasPayoutDetails: s.hasPayoutDetails,
          available: b?.available ?? 0,
          pendingAdjustments: b?.pendingAdjustments ?? 0,
          availableNet: b?.availableNet ?? 0,
          onHold: b?.onHold ?? 0,
          inFulfilment: b?.inFulfilment ?? 0,
          inPayout: b?.inPayout ?? 0,
          paidOut: b?.paidOut ?? 0,
          totalCommission: b?.totalCommission ?? 0,
          meetsMinimum: (b?.availableNet ?? 0) >= settings.minPayoutAmount && (b?.availableNet ?? 0) > 0,
        };
      })
      // Hide sellers with nothing financial going on.
      .filter((s) => s.availableNet !== 0 || s.onHold > 0 || s.inFulfilment > 0 || s.inPayout > 0 || s.paidOut > 0);

    return {
      settings: {
        payoutHoldDays: settings.payoutHoldDays,
        minPayoutAmount: settings.minPayoutAmount,
        defaultCommissionPercent: bpsToPercent(settings.defaultCommissionBps),
      },
      sellers: overview,
    };
  }

  // -------------------------------------------------------------------
  // Create a payout (settlement batch) for one seller
  // -------------------------------------------------------------------

  /**
   * Claims every currently-payable parcel and every unapplied adjustment for
   * the seller and wraps them in a PROCESSING payout.
   *
   * Concurrency: the seller row is locked FOR UPDATE for the duration, so two
   * admins clicking "Create payout" at once serialise; the second finds the
   * parcels already claimed (settlement_status = IN_PAYOUT) and fails with
   * "nothing to pay" instead of double-paying. The claim itself is a single
   * UPDATE ... RETURNING, so the totals are computed from exactly the rows
   * that were claimed.
   */
  static async createPayout(adminUserId: number, sellerId: number, notes?: string) {
    const settings = await PlatformSettingsService.get();

    const payout = await db.transaction(async (tx) => {
      const [seller] = await tx.select().from(sellers).where(eq(sellers.id, sellerId)).for('update');
      if (!seller) throw new NotFoundError('Seller not found');

      const hasBank = Boolean(seller.payoutAccountEnc && seller.payoutAccountHolder && seller.payoutIfsc);
      if (!hasBank && !seller.payoutUpiId) {
        throw new Error('This seller has not added payout details yet, so there is nowhere to send the money.');
      }

      const [created] = await tx
        .insert(sellerPayouts)
        .values({
          payoutNumber: payoutNumber(),
          sellerId,
          status: 'PROCESSING',
          destinationSnapshot: SellerAccountService.maskedDestinationSnapshot(seller),
          notes: notes || null,
          createdBy: adminUserId,
        })
        .returning();

      // Claim payable parcels. `FROM orders` supplies the payment predicate.
      const claimed = await tx.execute<{ id: number; subtotal: number; commission_amount: number; seller_earning: number }>(sql`
        UPDATE ${sellerOrders}
        SET settlement_status = 'IN_PAYOUT', payout_id = ${created.id}, updated_at = NOW()
        FROM ${orders}
        WHERE ${orders.id} = ${sellerOrders.orderId}
          AND ${sellerOrders.sellerId} = ${sellerId}
          AND ${payableCondition(settings.payoutHoldDays)}
        RETURNING ${sellerOrders.id} AS id, ${sellerOrders.subtotal} AS subtotal,
                  ${sellerOrders.commissionAmount} AS commission_amount, ${sellerOrders.sellerEarning} AS seller_earning
      `);
      const claimedRows = claimed.rows;

      const claimedAdjustments = await tx
        .update(sellerAdjustments)
        .set({ payoutId: created.id })
        .where(and(eq(sellerAdjustments.sellerId, sellerId), isNull(sellerAdjustments.payoutId)))
        .returning({ amount: sellerAdjustments.amount });

      const gross = claimedRows.reduce((a, r) => a + Number(r.subtotal), 0);
      const commission = claimedRows.reduce((a, r) => a + Number(r.commission_amount), 0);
      const earnings = claimedRows.reduce((a, r) => a + Number(r.seller_earning), 0);
      const adjustments = claimedAdjustments.reduce((a, r) => a + r.amount, 0);
      const net = computePayoutNet({ earnings, adjustments });

      if (claimedRows.length === 0 && claimedAdjustments.length === 0) {
        throw new Error('There is nothing payable for this seller right now.');
      }
      if (net <= 0) {
        // Throwing rolls back the claim: negative balances carry forward untouched.
        throw new Error('The seller\'s balance after adjustments is not positive, so nothing can be paid out yet.');
      }
      if (net < settings.minPayoutAmount) {
        throw new Error(`The payable amount (₹${net}) is below the minimum payout of ₹${settings.minPayoutAmount}.`);
      }

      const [finalised] = await tx
        .update(sellerPayouts)
        .set({
          orderCount: claimedRows.length,
          grossAmount: gross,
          commissionAmount: commission,
          adjustmentsAmount: adjustments,
          netAmount: net,
          updatedAt: new Date(),
        })
        .where(eq(sellerPayouts.id, created.id))
        .returning();
      return finalised;
    });

    return payout;
  }

  // -------------------------------------------------------------------
  // Settle or fail
  // -------------------------------------------------------------------

  static async markPaid(
    adminUserId: number,
    payoutId: number,
    input: { method: string; reference: string; notes?: string }
  ) {
    const result = await db.transaction(async (tx) => {
      const [payout] = await tx.select().from(sellerPayouts).where(eq(sellerPayouts.id, payoutId)).for('update');
      if (!payout) throw new NotFoundError('Payout not found');
      if (payout.status === 'PAID') throw new Error('This payout is already marked as paid.');
      if (payout.status !== 'PROCESSING') throw new Error('Only payouts that are processing can be marked as paid.');

      // A reference can only ever settle one payout (prevents pasting the same UTR twice).
      const [dupe] = await tx
        .select({ id: sellerPayouts.id })
        .from(sellerPayouts)
        .where(and(eq(sellerPayouts.reference, input.reference), eq(sellerPayouts.status, 'PAID')))
        .limit(1);
      if (dupe) throw new Error('That transfer reference is already recorded against another payout.');

      const now = new Date();
      const [updated] = await tx
        .update(sellerPayouts)
        .set({
          status: 'PAID',
          method: input.method,
          reference: input.reference,
          notes: input.notes ?? payout.notes,
          paidAt: now,
          updatedAt: now,
        })
        .where(eq(sellerPayouts.id, payoutId))
        .returning();

      await tx
        .update(sellerOrders)
        .set({ settlementStatus: 'PAID', updatedAt: now })
        .where(and(eq(sellerOrders.payoutId, payoutId), eq(sellerOrders.settlementStatus, 'IN_PAYOUT')));

      const [seller] = await tx.select({ userId: sellers.userId, storeName: sellers.storeName }).from(sellers).where(eq(sellers.id, payout.sellerId)).limit(1);
      return { payout: updated, seller };
    });

    if (result.seller) {
      void NotificationService.notifyUser(result.seller.userId, {
        type: 'SYSTEM',
        title: 'Payout sent',
        body: `₹${result.payout.netAmount} for ${result.payout.orderCount} order(s) has been paid out (ref ${result.payout.reference}).`,
        link: '/seller-center?tab=earnings',
      });
    }
    return result.payout;
  }

  /**
   * The transfer didn't go through: release every parcel and adjustment back
   * to the seller's available balance so they can be included in a new payout.
   */
  static async markFailed(adminUserId: number, payoutId: number, reason: string) {
    return db.transaction(async (tx) => {
      const [payout] = await tx.select().from(sellerPayouts).where(eq(sellerPayouts.id, payoutId)).for('update');
      if (!payout) throw new NotFoundError('Payout not found');
      if (payout.status !== 'PROCESSING') throw new Error('Only payouts that are processing can be marked as failed.');

      const now = new Date();

      // Parcels that were returned while the payout was in flight no longer
      // earn anything: void them and drop the clawback that was queued for them.
      const returned = await tx
        .select({ id: sellerOrders.id })
        .from(sellerOrders)
        .where(and(eq(sellerOrders.payoutId, payoutId), eq(sellerOrders.status, 'RETURNED')));
      for (const r of returned) {
        await tx
          .delete(sellerAdjustments)
          .where(and(eq(sellerAdjustments.sellerOrderId, r.id), eq(sellerAdjustments.type, 'RETURN_CLAWBACK'), isNull(sellerAdjustments.payoutId)));
      }
      await tx
        .update(sellerOrders)
        .set({ settlementStatus: 'VOID', payoutId: null, updatedAt: now })
        .where(and(eq(sellerOrders.payoutId, payoutId), eq(sellerOrders.status, 'RETURNED')));

      await tx
        .update(sellerOrders)
        .set({ settlementStatus: 'UNSETTLED', payoutId: null, updatedAt: now })
        .where(and(eq(sellerOrders.payoutId, payoutId), eq(sellerOrders.settlementStatus, 'IN_PAYOUT')));

      await tx.update(sellerAdjustments).set({ payoutId: null }).where(eq(sellerAdjustments.payoutId, payoutId));

      const [updated] = await tx
        .update(sellerPayouts)
        .set({ status: 'FAILED', failureReason: reason, updatedAt: now })
        .where(eq(sellerPayouts.id, payoutId))
        .returning();
      return updated;
    });
  }

  /** Signed manual credit/debit, applied to the seller's next payout. */
  static async addAdjustment(adminUserId: number, sellerId: number, amount: number, reason: string) {
    const [seller] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    if (!seller) throw new NotFoundError('Seller not found');
    const [adj] = await db
      .insert(sellerAdjustments)
      .values({ sellerId, type: 'MANUAL', amount, reason, createdBy: adminUserId })
      .returning();
    return { ...adj, createdAt: adj.createdAt.toISOString() };
  }

  // -------------------------------------------------------------------
  // Listing + settlement report
  // -------------------------------------------------------------------

  static async list(params: { status?: string; sellerId?: number } = {}) {
    const conditions: SQL[] = [];
    if (params.status && params.status !== 'ALL') conditions.push(eq(sellerPayouts.status, params.status.toUpperCase()));
    if (params.sellerId) conditions.push(eq(sellerPayouts.sellerId, params.sellerId));

    const rows = await db
      .select({
        id: sellerPayouts.id,
        payoutNumber: sellerPayouts.payoutNumber,
        sellerId: sellerPayouts.sellerId,
        storeName: sellers.storeName,
        status: sellerPayouts.status,
        orderCount: sellerPayouts.orderCount,
        grossAmount: sellerPayouts.grossAmount,
        commissionAmount: sellerPayouts.commissionAmount,
        adjustmentsAmount: sellerPayouts.adjustmentsAmount,
        netAmount: sellerPayouts.netAmount,
        method: sellerPayouts.method,
        reference: sellerPayouts.reference,
        failureReason: sellerPayouts.failureReason,
        createdAt: sellerPayouts.createdAt,
        paidAt: sellerPayouts.paidAt,
      })
      .from(sellerPayouts)
      .innerJoin(sellers, eq(sellerPayouts.sellerId, sellers.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(sellerPayouts.id))
      .limit(300);

    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    }));
  }

  /**
   * Full settlement report for one payout: header, per-order lines and
   * adjustments. `scopeSellerId` restricts the lookup to one seller — the
   * seller-facing route ALWAYS passes it, so a seller can never open another
   * seller's payout by guessing ids. `revealDestination` is for admins only.
   */
  static async getReport(payoutId: number, opts: { scopeSellerId?: number; revealDestination?: boolean } = {}) {
    const [payout] = await db
      .select()
      .from(sellerPayouts)
      .where(
        opts.scopeSellerId !== undefined
          ? and(eq(sellerPayouts.id, payoutId), eq(sellerPayouts.sellerId, opts.scopeSellerId))
          : eq(sellerPayouts.id, payoutId)
      )
      .limit(1);
    if (!payout) throw new NotFoundError('Payout not found');

    const seller = await SellerAccountService.getRawById(payout.sellerId);
    if (!seller) throw new NotFoundError('Seller not found');

    const lines = await db
      .select({
        parcelId: sellerOrders.id,
        orderNumber: orders.orderNumber,
        orderDate: orders.createdAt,
        deliveredAt: sellerOrders.deliveredAt,
        parcelStatus: sellerOrders.status,
        productName: orderItems.productName,
        variantName: orderItems.variantName,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        totalPrice: orderItems.totalPrice,
        commissionBps: orderItems.commissionBps,
        commissionAmount: orderItems.commissionAmount,
        sellerEarning: orderItems.sellerEarning,
      })
      .from(sellerOrders)
      .innerJoin(orders, eq(sellerOrders.orderId, orders.id))
      .innerJoin(orderItems, eq(orderItems.sellerOrderId, sellerOrders.id))
      .where(eq(sellerOrders.payoutId, payoutId))
      .orderBy(sellerOrders.id, orderItems.id);

    const parcels = await db
      .select({
        id: sellerOrders.id,
        orderNumber: orders.orderNumber,
        deliveredAt: sellerOrders.deliveredAt,
        subtotal: sellerOrders.subtotal,
        commissionAmount: sellerOrders.commissionAmount,
        sellerEarning: sellerOrders.sellerEarning,
      })
      .from(sellerOrders)
      .innerJoin(orders, eq(sellerOrders.orderId, orders.id))
      .where(eq(sellerOrders.payoutId, payoutId))
      .orderBy(sellerOrders.id);

    const adjustments = await db
      .select({ id: sellerAdjustments.id, type: sellerAdjustments.type, amount: sellerAdjustments.amount, reason: sellerAdjustments.reason, createdAt: sellerAdjustments.createdAt })
      .from(sellerAdjustments)
      .where(eq(sellerAdjustments.payoutId, payoutId))
      .orderBy(sellerAdjustments.id);

    return {
      payout: {
        id: payout.id,
        payoutNumber: payout.payoutNumber,
        status: payout.status,
        orderCount: payout.orderCount,
        grossAmount: payout.grossAmount,
        commissionAmount: payout.commissionAmount,
        adjustmentsAmount: payout.adjustmentsAmount,
        netAmount: payout.netAmount,
        method: payout.method,
        reference: payout.reference,
        notes: payout.notes,
        failureReason: payout.failureReason,
        cutoffAt: payout.cutoffAt.toISOString(),
        createdAt: payout.createdAt.toISOString(),
        paidAt: payout.paidAt ? payout.paidAt.toISOString() : null,
        destination: payout.destinationSnapshot,
      },
      seller: { id: seller.id, storeName: seller.storeName, slug: seller.slug },
      // Decrypted only for admins; sellers only ever get the masked snapshot above.
      destinationFull: opts.revealDestination ? SellerAccountService.revealPayoutDestination(seller) : undefined,
      parcels: parcels.map((p) => ({ ...p, deliveredAt: p.deliveredAt ? p.deliveredAt.toISOString() : null })),
      lines: lines.map((l) => ({
        ...l,
        orderDate: l.orderDate.toISOString(),
        deliveredAt: l.deliveredAt ? l.deliveredAt.toISOString() : null,
        commissionPercent: bpsToPercent(l.commissionBps),
      })),
      adjustments: adjustments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    };
  }

  static reportToCsv(report: Awaited<ReturnType<typeof PayoutService.getReport>>): string {
    const p = report.payout;
    const rows: unknown[][] = [
      ['Settlement report'],
      ['Payout', p.payoutNumber],
      ['Seller', report.seller.storeName],
      ['Status', p.status],
      ['Created', p.createdAt],
      ['Paid at', p.paidAt || ''],
      ['Method', p.method || ''],
      ['Reference', p.reference || ''],
      [],
      ['Order', 'Delivered', 'Product', 'Variant', 'Qty', 'Unit price', 'Line total', 'Commission %', 'Commission', 'Seller earning'],
      ...report.lines.map((l) => [
        l.orderNumber,
        l.deliveredAt || '',
        l.productName,
        l.variantName || '',
        l.quantity,
        l.unitPrice,
        l.totalPrice,
        l.commissionPercent,
        l.commissionAmount,
        l.sellerEarning,
      ]),
      [],
      ['Adjustments'],
      ['Type', 'Reason', 'Amount'],
      ...report.adjustments.map((a) => [a.type, a.reason, a.amount]),
      [],
      ['Gross sales', p.grossAmount],
      ['Commission', p.commissionAmount],
      ['Adjustments', p.adjustmentsAmount],
      ['Net payout', p.netAmount],
    ];
    return toCsv(rows);
  }

  // -------------------------------------------------------------------
  // Platform commission report
  // -------------------------------------------------------------------

  static async commissionReport(params: { from?: Date; to?: Date } = {}) {
    const conditions: SQL[] = [
      sql`${sellerOrders.status} NOT IN ('CANCELLED', 'RETURNED')`,
      sql`${sellerOrders.settlementStatus} <> 'LEGACY'`,
    ];
    if (params.from) conditions.push(sql`${sellerOrders.createdAt} >= ${params.from}`);
    if (params.to) conditions.push(sql`${sellerOrders.createdAt} < ${params.to}`);

    const rows = await db
      .select({
        sellerId: sellers.id,
        storeName: sellers.storeName,
        parcels: sql<number>`count(*)::int`,
        grossSales: sql<number>`COALESCE(SUM(${sellerOrders.subtotal}), 0)::int`,
        commission: sql<number>`COALESCE(SUM(${sellerOrders.commissionAmount}), 0)::int`,
        sellerEarnings: sql<number>`COALESCE(SUM(${sellerOrders.sellerEarning}), 0)::int`,
        // Commission the platform has actually "earned": delivered parcels.
        deliveredCommission: sql<number>`COALESCE(SUM(${sellerOrders.commissionAmount}) FILTER (WHERE ${sellerOrders.status} = 'DELIVERED'), 0)::int`,
      })
      .from(sellerOrders)
      .innerJoin(sellers, eq(sellerOrders.sellerId, sellers.id))
      .where(and(...conditions))
      .groupBy(sellers.id, sellers.storeName)
      .orderBy(desc(sql`SUM(${sellerOrders.subtotal})`));

    const totals = rows.reduce(
      (t, r) => ({
        parcels: t.parcels + r.parcels,
        grossSales: t.grossSales + r.grossSales,
        commission: t.commission + r.commission,
        sellerEarnings: t.sellerEarnings + r.sellerEarnings,
        deliveredCommission: t.deliveredCommission + r.deliveredCommission,
      }),
      { parcels: 0, grossSales: 0, commission: 0, sellerEarnings: 0, deliveredCommission: 0 }
    );
    return { sellers: rows, totals };
  }

  static commissionReportToCsv(report: Awaited<ReturnType<typeof PayoutService.commissionReport>>): string {
    return toCsv([
      ['Seller', 'Orders', 'Gross sales', 'Commission (all live orders)', 'Commission (delivered)', 'Seller earnings'],
      ...report.sellers.map((r) => [r.storeName, r.parcels, r.grossSales, r.commission, r.deliveredCommission, r.sellerEarnings]),
      ['TOTAL', report.totals.parcels, report.totals.grossSales, report.totals.commission, report.totals.deliveredCommission, report.totals.sellerEarnings],
    ]);
  }
}
