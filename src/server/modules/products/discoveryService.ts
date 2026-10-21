import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { carts, productSpecifications } from '@/src/db/schema';
import { hasTrigram } from '@/src/lib/trigram';
import { ProductService } from './productService';
import { NotificationService } from '../notifications/notificationService';

const rowsOf = (x: any) => (x.rows ?? x) as Record<string, any>[];
const LIVE_PRODUCT = sql`p.status = 'ACTIVE' AND s.status = 'APPROVED'`;

export class DiscoveryService {
  /** Autocomplete: product names, brands and categories; tolerates typos when pg_trgm is installed. */
  static async suggestions(q: string) {
    const term = q.trim().slice(0, 60);
    if (term.length < 2) return { products: [], brands: [], categories: [] };
    const like = `%${term.replace(/[%_]/g, '')}%`;
    const fuzzy = await hasTrigram();
    const match = (col: any) => (fuzzy ? sql`(${col} ILIKE ${like} OR word_similarity(${term}, ${col}) > 0.4)` : sql`${col} ILIKE ${like}`);
    const rank = fuzzy ? sql`word_similarity(${term}, p.name) DESC,` : sql``;

    const [prods, brands, cats] = await Promise.all([
      db.execute(sql`SELECT p.name, p.slug FROM products p JOIN sellers s ON s.id = p.seller_id
        WHERE ${LIVE_PRODUCT} AND ${match(sql`p.name`)} ORDER BY ${rank} p.rating DESC LIMIT 6`),
      db.execute(sql`SELECT DISTINCT p.brand FROM products p JOIN sellers s ON s.id = p.seller_id
        WHERE ${LIVE_PRODUCT} AND ${match(sql`p.brand`)} LIMIT 3`),
      db.execute(sql`SELECT c.name, c.slug FROM categories c WHERE c.name ILIKE ${like} LIMIT 3`),
    ]);
    return { products: rowsOf(prods), brands: rowsOf(brands).map((b) => b.brand), categories: rowsOf(cats) };
  }

  static async brandFacets(category?: string) {
    const cat = category && category !== 'all' ? sql`AND c.slug = ${category}` : sql``;
    const r = await db.execute(sql`SELECT p.brand, COUNT(*)::int AS count FROM products p
      JOIN sellers s ON s.id = p.seller_id JOIN categories c ON c.id = p.category_id
      WHERE ${LIVE_PRODUCT} ${cat} GROUP BY p.brand ORDER BY count DESC, p.brand LIMIT 40`);
    return rowsOf(r);
  }

  /** Items most often bought in the same paid order; tops up with same-category favourites. */
  static async frequentlyBoughtTogether(productId: number, limit = 3) {
    const r = await db.execute(sql`SELECT oi2.product_id AS id, COUNT(*)::int AS c
      FROM order_items oi1
      JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.product_id <> oi1.product_id
      JOIN orders o ON o.id = oi1.order_id AND o.payment_status = 'PAID' AND o.status NOT IN ('CANCELLED','RETURNED')
      WHERE oi1.product_id = ${productId} GROUP BY oi2.product_id ORDER BY c DESC LIMIT ${limit * 2}`);
    let ids = rowsOf(r).map((x) => Number(x.id));
    const pick = async (extraIds: number[]) =>
      (await ProductService.getProducts({ ids: extraIds, inStock: true, limit: 50 })).products;
    let result = ids.length ? await pick(ids) : [];
    result = result.filter((p: any) => p.id !== productId).slice(0, limit);
    if (result.length < limit) {
      const same = await db.execute(sql`SELECT p2.id FROM products p JOIN products p2 ON p2.category_id = p.category_id AND p2.id <> p.id
        JOIN sellers s ON s.id = p2.seller_id WHERE p.id = ${productId} AND p2.status = 'ACTIVE' AND s.status = 'APPROVED' AND p2.stock > 0
        ORDER BY p2.rating DESC, p2.review_count DESC LIMIT ${limit * 2}`);
      const have = new Set(result.map((p: any) => p.id));
      const extra = rowsOf(same).map((x) => Number(x.id)).filter((id) => !have.has(id));
      if (extra.length) result = [...result, ...(await pick(extra)).filter((p: any) => !have.has(p.id))].slice(0, limit);
    }
    return result;
  }

  static async compare(ids: number[]) {
    const list = ids.slice(0, 4);
    if (!list.length) return [];
    const { products } = await ProductService.getProducts({ ids: list, limit: 4 });
    const specs = await db.select().from(productSpecifications).where(sql`${productSpecifications.productId} IN (${sql.join(list.map((i) => sql`${i}`), sql`, `)})`);
    return products.map((p: any) => ({
      ...p,
      specs: Object.fromEntries(specs.filter((s) => s.productId === p.id).map((s) => [s.specKey, s.specValue])),
    }));
  }

  /** Nudges carts idle for 24h-7d once per change; skipped if the shopper has since ordered. */
  static async sendCartReminders() {
    const r = await db.execute(sql`SELECT c.id, c.user_id, COUNT(ci.id)::int AS n,
        (ARRAY_AGG(p.name ORDER BY ci.updated_at DESC))[1] AS first_name
      FROM carts c JOIN cart_items ci ON ci.cart_id = c.id JOIN products p ON p.id = ci.product_id AND p.status = 'ACTIVE' AND p.stock > 0
      GROUP BY c.id, c.user_id
      HAVING MAX(ci.updated_at) < NOW() - INTERVAL '24 hours' AND MAX(ci.updated_at) > NOW() - INTERVAL '7 days'
        AND (c.reminder_sent_at IS NULL OR c.reminder_sent_at < MAX(ci.updated_at))
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = c.user_id AND o.created_at > MAX(ci.updated_at))
      LIMIT 200`);
    let sent = 0;
    for (const c of rowsOf(r)) {
      await NotificationService.notifyUser(c.user_id, {
        type: 'CART',
        title: 'You left something in your cart',
        body: `${c.first_name}${c.n > 1 ? ` and ${c.n - 1} more item(s) are` : ' is'} waiting for you. Complete your order before it sells out.`,
        link: '/cart',
      });
      await db.update(carts).set({ reminderSentAt: new Date() }).where(and(eq(carts.id, c.id)));
      sent++;
    }
    return { checked: rowsOf(r).length, sent };
  }
}
