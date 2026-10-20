import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { products, sellerOrders } from '@/src/db/schema';
import { SellerEarningsService } from './sellerEarningsService';
import { SellerOrderService, SellerQuestionService } from './sellerOrderService';
import { LOW_STOCK_THRESHOLD } from './sellerCatalogService';

const COUNTED = sql`${sellerOrders.status} NOT IN ('CANCELLED', 'RETURNED')`;

export class SellerDashboardService {
  static async get(sellerId: number) {
    const now = Date.now();
    const since14 = new Date(now - 14 * 86_400_000);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [productStats] = await db
      .select({
        active: sql<number>`count(*) FILTER (WHERE ${products.status} = 'ACTIVE')::int`,
        lowStock: sql<number>`count(*) FILTER (WHERE ${products.status} = 'ACTIVE' AND ${products.stock} > 0 AND ${products.stock} <= ${LOW_STOCK_THRESHOLD})::int`,
        outOfStock: sql<number>`count(*) FILTER (WHERE ${products.status} = 'ACTIVE' AND ${products.stock} = 0)::int`,
      })
      .from(products)
      .where(eq(products.sellerId, sellerId));

    const [salesStats] = await db
      .select({
        today: sql<number>`COALESCE(SUM(${sellerOrders.subtotal}) FILTER (WHERE ${sellerOrders.createdAt} >= ${startOfToday}), 0)::int`,
        last7: sql<number>`COALESCE(SUM(${sellerOrders.subtotal}) FILTER (WHERE ${sellerOrders.createdAt} >= ${new Date(now - 7 * 86_400_000)}), 0)::int`,
        last30: sql<number>`COALESCE(SUM(${sellerOrders.subtotal}) FILTER (WHERE ${sellerOrders.createdAt} >= ${new Date(now - 30 * 86_400_000)}), 0)::int`,
      })
      .from(sellerOrders)
      .where(and(eq(sellerOrders.sellerId, sellerId), COUNTED, sql`${sellerOrders.settlementStatus} <> 'LEGACY'`));

    const daily = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${sellerOrders.createdAt}), 'YYYY-MM-DD')`,
        sales: sql<number>`COALESCE(SUM(${sellerOrders.subtotal}), 0)::int`,
        orders: sql<number>`count(*)::int`,
      })
      .from(sellerOrders)
      .where(and(eq(sellerOrders.sellerId, sellerId), COUNTED, gte(sellerOrders.createdAt, since14)))
      .groupBy(sql`date_trunc('day', ${sellerOrders.createdAt})`);
    const byDay = new Map(daily.map((d) => [d.day, d]));
    const series = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now - (13 - i) * 86_400_000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { day: key, sales: byDay.get(key)?.sales ?? 0, orders: byDay.get(key)?.orders ?? 0 };
    });

    const [earnings, recent, unanswered] = await Promise.all([
      SellerEarningsService.getSummary(sellerId),
      SellerOrderService.list(sellerId, { limit: 5 }),
      SellerQuestionService.list(sellerId, { unansweredOnly: true }),
    ]);

    const c = recent.counts;
    return {
      products: productStats,
      sales: salesStats,
      salesSeries: series,
      fulfilment: {
        toPack: c.CONFIRMED || 0,
        toShip: c.PACKED || 0,
        inTransit: (c.SHIPPED || 0) + (c.OUT_FOR_DELIVERY || 0),
        delivered: c.DELIVERED || 0,
        cancelled: c.CANCELLED || 0,
        returned: c.RETURNED || 0,
      },
      earnings,
      unansweredQuestions: unanswered.length,
      recentOrders: recent.orders,
    };
  }
}
