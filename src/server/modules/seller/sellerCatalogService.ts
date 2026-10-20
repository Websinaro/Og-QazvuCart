import { and, asc, desc, eq, ilike, inArray, or, sql, SQL } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  products,
  productImages,
  productVariants,
  productSpecifications,
  categories,
} from '@/src/db/schema';
import { NotFoundError } from '../orders/fulfilment';

/**
 * Every method here takes the caller's `sellerId` (resolved server-side from
 * the session by requireSeller) and bakes it into every WHERE clause. A
 * product id that belongs to another seller is indistinguishable from one
 * that doesn't exist: both raise NotFoundError -> HTTP 404.
 */

export const LOW_STOCK_THRESHOLD = 5;

export interface SellerProductInput {
  name: string;
  brand: string;
  categoryId: number;
  description: string;
  basePrice: number;
  discountPrice: number;
  stock: number;
  imageUrls?: string[];
  model?: string;
  warranty?: string;
  weight?: string;
  deliveryFee?: number;
  estimatedDays?: number;
  variants?: Array<{ id?: number; variantName: string; sku?: string; priceAdjustment: number; stockCount: number }>;
  specifications?: Array<{ key: string; value: string }>;
}

export type SellerProductUpdate = Partial<SellerProductInput> & { status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' };

function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
  return `${base || 'product'}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export class SellerCatalogService {
  static async list(
    sellerId: number,
    params: { q?: string; status?: string; lowStock?: boolean; page?: number; limit?: number } = {}
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(products.sellerId, sellerId)];
    if (params.status && params.status !== 'ALL') {
      conditions.push(eq(products.status, params.status.toUpperCase()));
    } else {
      // Archived products are hidden unless asked for.
      conditions.push(sql`${products.status} <> 'ARCHIVED'`);
    }
    if (params.q && params.q.trim()) {
      const term = `%${params.q.trim()}%`;
      conditions.push(or(ilike(products.name, term), ilike(products.brand, term))!);
    }
    if (params.lowStock) {
      conditions.push(sql`${products.stock} <= ${LOW_STOCK_THRESHOLD}`);
    }
    const where = and(...conditions);

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(products).where(where);

    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        brand: products.brand,
        categoryId: products.categoryId,
        categoryName: categories.name,
        basePrice: products.basePrice,
        discountPrice: products.discountPrice,
        stock: products.stock,
        status: products.status,
        isFeatured: products.isFeatured,
        isDeal: products.isDeal,
        rating: products.rating,
        reviewCount: products.reviewCount,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        primaryImage: sql<string | null>`(SELECT ${productImages.imageUrl} FROM ${productImages} WHERE ${productImages.productId} = ${products.id} ORDER BY ${productImages.isPrimary} DESC, ${productImages.displayOrder} ASC LIMIT 1)`,
        variantCount: sql<number>`(SELECT count(*)::int FROM ${productVariants} WHERE ${productVariants.productId} = ${products.id})`,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(where)
      .orderBy(desc(products.id))
      .limit(limit)
      .offset(offset);

    return {
      products: rows.map((r) => ({
        ...r,
        rating: Number(r.rating || 0),
        lowStock: r.stock <= LOW_STOCK_THRESHOLD,
        primaryImage: r.primaryImage || 'https://picsum.photos/seed/prod/600/600',
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 1 },
    };
  }

  static async get(sellerId: number, productId: number) {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)))
      .limit(1);
    if (!product) throw new NotFoundError('Product not found');

    const [images, variants, specs] = await Promise.all([
      db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.displayOrder)),
      db.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(asc(productVariants.id)),
      db.select().from(productSpecifications).where(eq(productSpecifications.productId, productId)).orderBy(asc(productSpecifications.displayOrder)),
    ]);

    return {
      ...product,
      rating: Number(product.rating || 0),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      imageUrls: images.map((i) => i.imageUrl),
      variants: variants.map((v) => ({
        id: v.id,
        variantName: v.variantName,
        sku: v.sku,
        priceAdjustment: v.priceAdjustment,
        stockCount: v.stockCount,
      })),
      specifications: specs.map((s) => ({ key: s.specKey, value: s.specValue })),
    };
  }

  private static async assertCategory(categoryId: number) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.isActive, true)))
      .limit(1);
    if (!cat) throw new Error('That category does not exist. Refresh the page and pick one from the list.');
  }

  static async create(sellerId: number, input: SellerProductInput) {
    await this.assertCategory(input.categoryId);

    return db.transaction(async (tx) => {
      // Note: sellerId comes from the session, never from the request body,
      // and isFeatured / isDeal are admin-controlled (left at defaults here).
      const [product] = await tx
        .insert(products)
        .values({
          sellerId,
          categoryId: input.categoryId,
          name: input.name,
          slug: makeSlug(input.name),
          description: input.description,
          basePrice: input.basePrice,
          discountPrice: input.discountPrice,
          stock: input.stock,
          brand: input.brand,
          model: input.model ?? null,
          warranty: input.warranty ?? '1 Year Manufacturer Warranty',
          weight: input.weight ?? null,
          deliveryFee: input.deliveryFee ?? 40,
          estimatedDays: input.estimatedDays ?? 3,
        })
        .returning({ id: products.id });

      if (input.imageUrls && input.imageUrls.length > 0) {
        await tx.insert(productImages).values(
          input.imageUrls.map((url, i) => ({ productId: product.id, imageUrl: url, isPrimary: i === 0, displayOrder: i + 1 }))
        );
      }
      if (input.variants && input.variants.length > 0) {
        await tx.insert(productVariants).values(
          input.variants.map((v) => ({
            productId: product.id,
            variantName: v.variantName,
            sku: v.sku ?? null,
            priceAdjustment: v.priceAdjustment,
            stockCount: v.stockCount,
          }))
        );
      }
      if (input.specifications && input.specifications.length > 0) {
        await tx.insert(productSpecifications).values(
          input.specifications.map((s, i) => ({ productId: product.id, specKey: s.key, specValue: s.value, displayOrder: i + 1 }))
        );
      }
      return { id: product.id };
    });
  }

  static async update(sellerId: number, productId: number, input: SellerProductUpdate) {
    if (input.categoryId !== undefined) await this.assertCategory(input.categoryId);

    await db.transaction(async (tx) => {
      // Ownership check + row lock in one statement.
      const [current] = await tx
        .select({ id: products.id, basePrice: products.basePrice, discountPrice: products.discountPrice })
        .from(products)
        .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)))
        .for('update');
      if (!current) throw new NotFoundError('Product not found');

      // Price sanity must hold against the stored value when only one side is sent.
      const nextBase = input.basePrice ?? current.basePrice;
      const nextDiscount = input.discountPrice ?? current.discountPrice;
      if (nextDiscount > nextBase) throw new Error('Selling price cannot be higher than the original price.');

      const updates: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.brand !== undefined) updates.brand = input.brand;
      if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
      if (input.description !== undefined) updates.description = input.description;
      if (input.basePrice !== undefined) updates.basePrice = input.basePrice;
      if (input.discountPrice !== undefined) updates.discountPrice = input.discountPrice;
      if (input.stock !== undefined) updates.stock = input.stock;
      if (input.model !== undefined) updates.model = input.model || null;
      if (input.warranty !== undefined) updates.warranty = input.warranty || null;
      if (input.weight !== undefined) updates.weight = input.weight || null;
      if (input.deliveryFee !== undefined) updates.deliveryFee = input.deliveryFee;
      if (input.estimatedDays !== undefined) updates.estimatedDays = input.estimatedDays;
      if (input.status !== undefined) updates.status = input.status;

      await tx.update(products).set(updates).where(and(eq(products.id, productId), eq(products.sellerId, sellerId)));

      if (input.imageUrls !== undefined) {
        await tx.delete(productImages).where(eq(productImages.productId, productId));
        if (input.imageUrls.length > 0) {
          await tx.insert(productImages).values(
            input.imageUrls.map((url, i) => ({ productId, imageUrl: url, isPrimary: i === 0, displayOrder: i + 1 }))
          );
        }
      }

      if (input.specifications !== undefined) {
        await tx.delete(productSpecifications).where(eq(productSpecifications.productId, productId));
        if (input.specifications.length > 0) {
          await tx.insert(productSpecifications).values(
            input.specifications.map((s, i) => ({ productId, specKey: s.key, specValue: s.value, displayOrder: i + 1 }))
          );
        }
      }

      if (input.variants !== undefined) {
        for (const v of input.variants) {
          if (v.id) {
            // A variant id only counts if it belongs to THIS product (which is this seller's).
            const updated = await tx
              .update(productVariants)
              .set({ variantName: v.variantName, sku: v.sku ?? null, priceAdjustment: v.priceAdjustment, stockCount: v.stockCount })
              .where(and(eq(productVariants.id, v.id), eq(productVariants.productId, productId)))
              .returning({ id: productVariants.id });
            if (updated.length === 0) throw new NotFoundError('Variant not found');
          } else {
            await tx.insert(productVariants).values({
              productId,
              variantName: v.variantName,
              sku: v.sku ?? null,
              priceAdjustment: v.priceAdjustment,
              stockCount: v.stockCount,
            });
          }
        }
      }
    });

    return this.get(sellerId, productId);
  }

  /** Soft delete: products referenced by past orders can never be hard-deleted. */
  static async archive(sellerId: number, productId: number) {
    const updated = await db
      .update(products)
      .set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)))
      .returning({ id: products.id });
    if (updated.length === 0) throw new NotFoundError('Product not found');
    return { success: true };
  }

  // -------------------------------------------------------------------
  // Inventory
  // -------------------------------------------------------------------

  /** Stock overview with per-variant counts for every non-archived product. */
  static async inventory(sellerId: number, params: { lowStockOnly?: boolean } = {}) {
    const conditions: SQL[] = [eq(products.sellerId, sellerId), sql`${products.status} <> 'ARCHIVED'`];
    if (params.lowStockOnly) conditions.push(sql`${products.stock} <= ${LOW_STOCK_THRESHOLD}`);

    const rows = await db
      .select({ id: products.id, name: products.name, status: products.status, stock: products.stock })
      .from(products)
      .where(and(...conditions))
      .orderBy(asc(products.stock), asc(products.id))
      .limit(500);

    const ids = rows.map((r) => r.id);
    const variants = ids.length
      ? await db
          .select({ id: productVariants.id, productId: productVariants.productId, variantName: productVariants.variantName, stockCount: productVariants.stockCount })
          .from(productVariants)
          .where(inArray(productVariants.productId, ids))
      : [];

    return rows.map((r) => ({
      ...r,
      lowStock: r.stock <= LOW_STOCK_THRESHOLD,
      variants: variants.filter((v) => v.productId === r.id).map(({ productId: _p, ...v }) => v),
    }));
  }

  /**
   * Bulk stock update. All-or-nothing: if ANY product or variant in the batch
   * isn't this seller's, nothing is written and the request is rejected.
   */
  static async bulkUpdateStock(
    sellerId: number,
    updates: Array<{ productId: number; stock?: number; variants?: Array<{ variantId: number; stockCount: number }> }>
  ) {
    const productIds = [...new Set(updates.map((u) => u.productId))];

    await db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: products.id })
        .from(products)
        .where(and(inArray(products.id, productIds), eq(products.sellerId, sellerId)))
        .for('update');
      if (owned.length !== productIds.length) throw new NotFoundError('One or more products were not found');

      for (const u of updates) {
        if (u.stock !== undefined) {
          await tx
            .update(products)
            .set({ stock: u.stock, updatedAt: new Date() })
            .where(and(eq(products.id, u.productId), eq(products.sellerId, sellerId)));
        }
        for (const v of u.variants || []) {
          const changed = await tx
            .update(productVariants)
            .set({ stockCount: v.stockCount })
            .where(and(eq(productVariants.id, v.variantId), eq(productVariants.productId, u.productId)))
            .returning({ id: productVariants.id });
          if (changed.length === 0) throw new NotFoundError('One or more variants were not found');
        }
      }
    });

    return { updated: updates.length };
  }
}
