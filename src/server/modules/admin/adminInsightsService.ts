import { sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { toCsv } from '../payouts/payoutService';

export type Granularity = 'day' | 'week' | 'month';
const GRAN: Record<Granularity, { unit: string; points: number }> = {
  day: { unit: 'day', points: 30 },
  week: { unit: 'week', points: 12 },
  month: { unit: 'month', points: 12 },
};
const LIVE = sql`o.payment_status = 'PAID' AND o.status NOT IN ('CANCELLED','RETURNED')`;

export class AdminInsightsService {
  static async getInsights(gran: Granularity = 'day') {
    const g = GRAN[gran] ?? GRAN.day;
    const unit = sql.raw(`'${g.unit}'`);
    const since = sql.raw(`date_trunc('${g.unit}', now()) - interval '${g.points - 1} ${g.unit}'`);

    const [today, week, month, series, topProducts, categories, sellers, returns, lowStock] = await Promise.all([
      db.execute(sql`SELECT COALESCE(SUM(o.total),0)::int revenue, COUNT(*)::int orders FROM orders o WHERE ${LIVE} AND o.created_at >= date_trunc('day', now())`),
      db.execute(sql`SELECT COALESCE(SUM(o.total),0)::int revenue, COUNT(*)::int orders FROM orders o WHERE ${LIVE} AND o.created_at >= date_trunc('week', now())`),
      db.execute(sql`SELECT COALESCE(SUM(o.total),0)::int revenue, COUNT(*)::int orders FROM orders o WHERE ${LIVE} AND o.created_at >= date_trunc('month', now())`),
      db.execute(sql`SELECT to_char(date_trunc(${unit}, o.created_at), 'YYYY-MM-DD') period, COALESCE(SUM(o.total),0)::int revenue, COUNT(*)::int orders
        FROM orders o WHERE ${LIVE} AND o.created_at >= ${since} GROUP BY 1 ORDER BY 1`),
      db.execute(sql`SELECT oi.product_id id, oi.product_name name, SUM(oi.quantity)::int units, SUM(oi.total_price)::int revenue
        FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${LIVE}
        GROUP BY oi.product_id, oi.product_name ORDER BY revenue DESC LIMIT 8`),
      db.execute(sql`SELECT c.name, COALESCE(SUM(oi.total_price),0)::int revenue, COALESCE(SUM(oi.quantity),0)::int units
        FROM categories c JOIN products p ON p.category_id = c.id
        JOIN order_items oi ON oi.product_id = p.id JOIN orders o ON o.id = oi.order_id AND ${LIVE}
        GROUP BY c.id, c.name ORDER BY revenue DESC`),
      db.execute(sql`SELECT s.id, s.store_name "storeName", COUNT(*)::int parcels,
          COALESCE(SUM(so.subtotal),0)::int "grossSales", COALESCE(SUM(so.commission_amount),0)::int commission,
          COALESCE(SUM(so.seller_earning),0)::int earnings,
          ROUND(100.0 * COUNT(*) FILTER (WHERE so.status IN ('CANCELLED','RETURNED')) / NULLIF(COUNT(*),0), 1)::float "problemRate"
        FROM seller_orders so JOIN sellers s ON s.id = so.seller_id
        WHERE so.settlement_status <> 'LEGACY' GROUP BY s.id, s.store_name ORDER BY "grossSales" DESC LIMIT 10`),
      db.execute(sql`SELECT
          COUNT(*) FILTER (WHERE status = 'CANCELLED')::int cancelled,
          COUNT(*) FILTER (WHERE status = 'RETURNED')::int returned,
          COUNT(*)::int total,
          (SELECT COUNT(*)::int FROM refunds WHERE status IN ('PROCESSED','SUCCEEDED','COMPLETED','REFUNDED')) "refundCount",
          (SELECT COALESCE(SUM(amount),0)::int FROM refunds WHERE status IN ('PROCESSED','SUCCEEDED','COMPLETED','REFUNDED')) "refundAmount",
          (SELECT COUNT(*)::int FROM refunds WHERE status IN ('PENDING','FAILED')) "refundPending"
        FROM orders`),
      // Forecast: stock / avg daily units sold over the last 30 days.
      db.execute(sql`SELECT p.id, p.name, p.stock, COALESCE(v.units,0)::int "sold30",
          CASE WHEN COALESCE(v.units,0) = 0 THEN NULL ELSE ROUND(p.stock / (v.units / 30.0))::int END "daysLeft"
        FROM products p LEFT JOIN (
          SELECT oi.product_id, SUM(oi.quantity) units FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE ${LIVE} AND o.created_at >= now() - interval '30 days' GROUP BY 1) v ON v.product_id = p.id
        WHERE p.status = 'ACTIVE' AND (p.stock <= 10 OR (v.units > 0 AND p.stock / (v.units / 30.0) <= 14))
        ORDER BY "daysLeft" ASC NULLS LAST, p.stock ASC LIMIT 10`),
    ]);

    const r = (x: { rows?: unknown[] } | unknown[]) => ((x as { rows?: unknown[] }).rows ?? (x as unknown[])) as Record<string, any>[];
    const ret = r(returns)[0] ?? {};
    return {
      summary: { today: r(today)[0], week: r(week)[0], month: r(month)[0] },
      series: r(series),
      topProducts: r(topProducts),
      categories: r(categories),
      sellers: r(sellers),
      returns: {
        ...ret,
        cancelRate: ret.total ? +((100 * ret.cancelled) / ret.total).toFixed(1) : 0,
        returnRate: ret.total ? +((100 * ret.returned) / ret.total).toFixed(1) : 0,
      },
      lowStock: r(lowStock),
      granularity: gran,
    };
  }

  static async exportCsv(type: string): Promise<string | null> {
    const rows = (x: any) => (x.rows ?? x) as unknown[][];
    if (type === 'orders') {
      const res = await db.execute(sql`SELECT o.order_number, to_char(o.created_at,'YYYY-MM-DD HH24:MI'), u.email, o.status, o.payment_method, o.payment_status, o.subtotal, o.discount, o.delivery_fee, o.total
        FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC`).then((x: any) => (x.rows ?? x) as Record<string, unknown>[]);
      return toCsv([
        ['Order', 'Created', 'Customer email', 'Status', 'Payment method', 'Payment status', 'Subtotal', 'Discount', 'Delivery fee', 'Total'],
        ...res.map((o) => Object.values(o)),
      ]);
    }
    if (type === 'products') {
      const res = await db.execute(sql`SELECT p.id, p.name, p.brand, c.name cat, s.store_name, p.base_price, p.discount_price, p.stock, p.status
        FROM products p JOIN categories c ON c.id = p.category_id JOIN sellers s ON s.id = p.seller_id ORDER BY p.id`).then((x: any) => (x.rows ?? x) as Record<string, unknown>[]);
      return toCsv([
        ['ID', 'Name', 'Brand', 'Category', 'Seller', 'Base price', 'Selling price', 'Stock', 'Status'],
        ...res.map((o) => Object.values(o)),
      ]);
    }
    if (type === 'sales') {
      const res = await db.execute(sql`SELECT o.order_number, to_char(o.created_at,'YYYY-MM-DD'), oi.product_name, s.store_name, oi.quantity, oi.unit_price, oi.total_price, oi.commission_amount, oi.seller_earning
        FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN sellers s ON s.id = oi.seller_id
        WHERE ${LIVE} ORDER BY o.id DESC`).then((x: any) => (x.rows ?? x) as Record<string, unknown>[]);
      return toCsv([
        ['Order', 'Date', 'Product', 'Seller', 'Qty', 'Unit price', 'Line total', 'Commission', 'Seller earning'],
        ...res.map((o) => Object.values(o)),
      ]);
    }
    void rows;
    return null;
  }
}
