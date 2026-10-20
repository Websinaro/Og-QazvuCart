import { and, desc, eq, sql, SQL } from 'drizzle-orm';
import { db } from '@/src/db';
import { orders, sellerOrders, sellerPayouts, sellerAdjustments } from '@/src/db/schema';
import { PlatformSettingsService } from '../settings/platformSettingsService';
import { inFulfilmentCondition, payableCondition } from '../payouts/eligibility';

export interface EarningsBuckets {
  totalSales: number;        // gross value of parcels that count (not cancelled/returned, not legacy)
  totalCommission: number;
  netEarnings: number;       // totalSales - totalCommission
  inFulfilment: number;      // earned, order still in progress
  onHold: number;            // delivered, waiting out the return window
  available: number;         // payable right now (before adjustments)
  inPayout: number;          // claimed by a payout awaiting transfer
  paidOut: number;           // included in a paid payout
  pendingAdjustments: number; // signed, applied to the next payout
  availableNet: number;      // available + pendingAdjustments
}

const countsCondition = sql`(${sellerOrders.status} NOT IN ('CANCELLED', 'RETURNED') AND ${sellerOrders.settlementStatus} <> 'LEGACY')`;

/**
 * Money buckets per seller, computed from the parcels. Pass `sellerId` for one
 * seller, or omit for every seller (admin overview).
 */
export async function computeBuckets(sellerId?: number): Promise<Map<number, EarningsBuckets>> {
  const settings = await PlatformSettingsService.get();
  const payable = payableCondition(settings.payoutHoldDays);
  const fulfilment = inFulfilmentCondition();

  const rows = await db
    .select({
      sellerId: sellerOrders.sellerId,
      totalSales: sql<number>`COALESCE(SUM(${sellerOrders.subtotal}) FILTER (WHERE ${countsCondition}), 0)::int`,
      totalCommission: sql<number>`COALESCE(SUM(${sellerOrders.commissionAmount}) FILTER (WHERE ${countsCondition}), 0)::int`,
      inFulfilment: sql<number>`COALESCE(SUM(${sellerOrders.sellerEarning}) FILTER (WHERE ${fulfilment}), 0)::int`,
      available: sql<number>`COALESCE(SUM(${sellerOrders.sellerEarning}) FILTER (WHERE ${payable}), 0)::int`,
      delivered: sql<number>`COALESCE(SUM(${sellerOrders.sellerEarning}) FILTER (WHERE ${sellerOrders.settlementStatus} = 'UNSETTLED' AND ${sellerOrders.status} = 'DELIVERED'), 0)::int`,
      inPayout: sql<number>`COALESCE(SUM(${sellerOrders.sellerEarning}) FILTER (WHERE ${sellerOrders.settlementStatus} = 'IN_PAYOUT'), 0)::int`,
      paidOut: sql<number>`COALESCE(SUM(${sellerOrders.sellerEarning}) FILTER (WHERE ${sellerOrders.settlementStatus} = 'PAID'), 0)::int`,
    })
    .from(sellerOrders)
    .innerJoin(orders, eq(sellerOrders.orderId, orders.id))
    .where(sellerId !== undefined ? eq(sellerOrders.sellerId, sellerId) : undefined)
    .groupBy(sellerOrders.sellerId);

  const adjRows = await db
    .select({ sellerId: sellerAdjustments.sellerId, total: sql<number>`COALESCE(SUM(${sellerAdjustments.amount}), 0)::int` })
    .from(sellerAdjustments)
    .where(
      and(
        sql`${sellerAdjustments.payoutId} IS NULL`,
        sellerId !== undefined ? eq(sellerAdjustments.sellerId, sellerId) : undefined
      )
    )
    .groupBy(sellerAdjustments.sellerId);
  const adjBySeller = new Map(adjRows.map((a) => [a.sellerId, a.total]));

  const result = new Map<number, EarningsBuckets>();
  const build = (id: number, r?: (typeof rows)[number]) => {
    const adj = adjBySeller.get(id) ?? 0;
    const available = r?.available ?? 0;
    result.set(id, {
      totalSales: r?.totalSales ?? 0,
      totalCommission: r?.totalCommission ?? 0,
      netEarnings: (r?.totalSales ?? 0) - (r?.totalCommission ?? 0),
      inFulfilment: r?.inFulfilment ?? 0,
      onHold: Math.max(0, (r?.delivered ?? 0) - available),
      available,
      inPayout: r?.inPayout ?? 0,
      paidOut: r?.paidOut ?? 0,
      pendingAdjustments: adj,
      availableNet: available + adj,
    });
  };
  for (const r of rows) build(r.sellerId, r);
  // Sellers with adjustments but no parcels at all.
  for (const id of adjBySeller.keys()) if (!result.has(id)) build(id);
  if (sellerId !== undefined && !result.has(sellerId)) build(sellerId);
  return result;
}

export class SellerEarningsService {
  static async getSummary(sellerId: number) {
    const [buckets, settings] = await Promise.all([computeBuckets(sellerId), PlatformSettingsService.get()]);
    return {
      ...(buckets.get(sellerId) as EarningsBuckets),
      payoutHoldDays: settings.payoutHoldDays,
      minPayoutAmount: settings.minPayoutAmount,
    };
  }

  /** Per-parcel earnings ledger: what was sold, what was kept as commission, and its settlement state. */
  static async listEarnings(sellerId: number, params: { settlement?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;
    const settings = await PlatformSettingsService.get();

    const conditions: SQL[] = [eq(sellerOrders.sellerId, sellerId)];
    if (params.settlement && params.settlement !== 'ALL') {
      conditions.push(eq(sellerOrders.settlementStatus, params.settlement.toUpperCase()));
    }
    const where = and(...conditions);

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(sellerOrders).where(where);

    const rows = await db
      .select({
        id: sellerOrders.id,
        orderNumber: orders.orderNumber,
        orderDate: orders.createdAt,
        status: sellerOrders.status,
        subtotal: sellerOrders.subtotal,
        commissionAmount: sellerOrders.commissionAmount,
        sellerEarning: sellerOrders.sellerEarning,
        settlementStatus: sellerOrders.settlementStatus,
        deliveredAt: sellerOrders.deliveredAt,
        payoutId: sellerOrders.payoutId,
        payoutNumber: sellerPayouts.payoutNumber,
        isPayable: sql<boolean>`${payableCondition(settings.payoutHoldDays)}`,
      })
      .from(sellerOrders)
      .innerJoin(orders, eq(sellerOrders.orderId, orders.id))
      .leftJoin(sellerPayouts, eq(sellerOrders.payoutId, sellerPayouts.id))
      .where(where)
      .orderBy(desc(sellerOrders.id))
      .limit(limit)
      .offset(offset);

    return {
      earnings: rows.map((r) => ({
        ...r,
        orderDate: r.orderDate.toISOString(),
        deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
        // When a delivered, unsettled parcel becomes payable.
        payableAt:
          r.deliveredAt && r.settlementStatus === 'UNSETTLED' && r.status === 'DELIVERED'
            ? new Date(r.deliveredAt.getTime() + settings.payoutHoldDays * 86_400_000).toISOString()
            : null,
      })),
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 1 },
    };
  }

  static async listPayouts(sellerId: number) {
    const rows = await db
      .select({
        id: sellerPayouts.id,
        payoutNumber: sellerPayouts.payoutNumber,
        status: sellerPayouts.status,
        orderCount: sellerPayouts.orderCount,
        grossAmount: sellerPayouts.grossAmount,
        commissionAmount: sellerPayouts.commissionAmount,
        adjustmentsAmount: sellerPayouts.adjustmentsAmount,
        netAmount: sellerPayouts.netAmount,
        method: sellerPayouts.method,
        reference: sellerPayouts.reference,
        createdAt: sellerPayouts.createdAt,
        paidAt: sellerPayouts.paidAt,
      })
      .from(sellerPayouts)
      .where(eq(sellerPayouts.sellerId, sellerId))
      .orderBy(desc(sellerPayouts.id))
      .limit(200);

    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    }));
  }
}
