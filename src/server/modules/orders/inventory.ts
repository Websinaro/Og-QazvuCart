/**
 * Single owner of inventory reservation / release for orders.
 *
 * Rule: an order line touches exactly ONE counter.
 *   - variant line     -> product_variants.stock_count
 *   - non-variant line -> products.stock
 * `products.stock` is an independently maintained value (sellers edit it
 * directly), not an aggregate of variant stock, so variant lines must never
 * move it. Reserve and release share the same rule, so they cannot drift.
 */
import { and, eq, sql } from 'drizzle-orm';
import { products, productVariants, orderItems } from '@/src/db/schema';
import type { DbClient } from './fulfilment';

export type InventoryLine = {
  productId: number;
  variantId: number | null;
  quantity: number;
};

export class OutOfStockError extends Error {}

export class InventoryService {
  /** Atomically decrements the correct counter; throws OutOfStockError if short. */
  static async reserve(tx: DbClient, line: InventoryLine, label: string) {
    if (line.variantId) {
      const updated = await tx
        .update(productVariants)
        .set({ stockCount: sql`${productVariants.stockCount} - ${line.quantity}` })
        .where(and(eq(productVariants.id, line.variantId), sql`${productVariants.stockCount} >= ${line.quantity}`))
        .returning({ id: productVariants.id });
      if (updated.length === 0) throw new OutOfStockError(`${label} just went out of stock.`);
    } else {
      const updated = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${line.quantity}` })
        .where(and(eq(products.id, line.productId), sql`${products.stock} >= ${line.quantity}`))
        .returning({ id: products.id });
      if (updated.length === 0) throw new OutOfStockError(`${label} just went out of stock.`);
    }
  }

  /** Restores exactly the counter that `reserve` decremented. */
  static async release(tx: DbClient, line: InventoryLine) {
    if (line.variantId) {
      await tx
        .update(productVariants)
        .set({ stockCount: sql`${productVariants.stockCount} + ${line.quantity}` })
        .where(eq(productVariants.id, line.variantId));
    } else {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${line.quantity}` })
        .where(eq(products.id, line.productId));
    }
  }

  static async releaseOrder(tx: DbClient, orderId: number) {
    const items = await tx
      .select({ productId: orderItems.productId, variantId: orderItems.variantId, quantity: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    for (const item of items) await this.release(tx, item);
  }

  static async releaseParcel(tx: DbClient, sellerOrderId: number) {
    const items = await tx
      .select({ productId: orderItems.productId, variantId: orderItems.variantId, quantity: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.sellerOrderId, sellerOrderId));
    for (const item of items) await this.release(tx, item);
  }
             }
