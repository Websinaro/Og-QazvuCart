import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { carts, cartItems, products, productVariants, productImages } from '@/src/db/schema';
import { getDeliveryEstimate } from '@/src/lib/date';

export interface CartItemResponse {
  id: number;
  productId: number;
  variantId: number | null;
  productName: string;
  productSlug: string;
  productImage: string;
  brand: string;
  variantName: string | null;
  basePrice: number;
  unitPrice: number;
  discountPercent: number;
  quantity: number;
  itemTotal: number;
  stockAvailable: number;
  inStock: boolean;
  deliveryFee: number;
  estimatedDays: number;
  deliveryInfo: ReturnType<typeof getDeliveryEstimate>;
}

export interface CartSummary {
  items: CartItemResponse[];
  totalItems: number;
  subtotal: number;
  totalOriginalPrice: number;
  totalDiscount: number;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  freeDeliveryRemaining: number;
  grandTotal: number;
}

const FREE_THRESHOLD = 999;

export class CartService {
  static async getOrCreateUserCartId(userId: number): Promise<number> {
    const [existing] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
    if (existing) return existing.id;

    // Two concurrent first-add-to-cart requests could both miss the SELECT
    // above; fall back to re-reading on a unique-violation instead of
    // erroring the request.
    try {
      const [created] = await db.insert(carts).values({ userId }).returning({ id: carts.id });
      return created.id;
    } catch {
      const [retry] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
      if (retry) return retry.id;
      throw new Error('Failed to initialize cart');
    }
  }

  static async getCart(userId: number): Promise<CartSummary> {
    const cartId = await this.getOrCreateUserCartId(userId);

    const rows = await db
      .select({
        itemId: cartItems.id,
        productId: cartItems.productId,
        variantId: cartItems.variantId,
        quantity: cartItems.quantity,
        productName: products.name,
        productSlug: products.slug,
        brand: products.brand,
        basePrice: products.basePrice,
        discountPrice: products.discountPrice,
        stock: products.stock,
        deliveryFee: products.deliveryFee,
        estimatedDays: products.estimatedDays,
        variantName: productVariants.variantName,
        variantPriceAdj: productVariants.priceAdjustment,
        variantStock: productVariants.stockCount,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .where(eq(cartItems.cartId, cartId))
      .orderBy(sql`${cartItems.id} DESC`);

    let subtotal = 0;
    let totalOriginalPrice = 0;
    let maxDeliveryFee = 0;
    let totalItems = 0;

    const items: CartItemResponse[] = [];

    for (const r of rows) {
      const [primaryImage] = await db
        .select({ imageUrl: productImages.imageUrl })
        .from(productImages)
        .where(eq(productImages.productId, r.productId))
        .orderBy(sql`${productImages.isPrimary} DESC, ${productImages.displayOrder} ASC`)
        .limit(1);

      const priceAdj = r.variantPriceAdj || 0;
      const unitPrice = r.discountPrice + priceAdj;
      const basePrice = r.basePrice + priceAdj;
      const discountPercent = basePrice > unitPrice ? Math.round(((basePrice - unitPrice) / basePrice) * 100) : 0;
      const itemTotal = unitPrice * r.quantity;
      const stockAvailable = r.variantId ? r.variantStock ?? r.stock : r.stock;
      const inStock = stockAvailable >= r.quantity && stockAvailable > 0;

      subtotal += itemTotal;
      totalOriginalPrice += basePrice * r.quantity;
      totalItems += r.quantity;
      if (r.deliveryFee > maxDeliveryFee) maxDeliveryFee = r.deliveryFee;

      items.push({
        id: r.itemId,
        productId: r.productId,
        variantId: r.variantId,
        productName: r.productName,
        productSlug: r.productSlug,
        productImage: primaryImage?.imageUrl || 'https://picsum.photos/seed/prod/600/600',
        brand: r.brand,
        variantName: r.variantName,
        basePrice,
        unitPrice,
        discountPercent,
        quantity: r.quantity,
        itemTotal,
        stockAvailable,
        inStock,
        deliveryFee: r.deliveryFee,
        estimatedDays: r.estimatedDays,
        deliveryInfo: getDeliveryEstimate(r.estimatedDays, r.deliveryFee),
      });
    }

    const finalDeliveryFee = items.length === 0 ? 0 : subtotal >= FREE_THRESHOLD ? 0 : maxDeliveryFee || 40;
    const freeDeliveryRemaining = Math.max(0, FREE_THRESHOLD - subtotal);
    const totalDiscount = Math.max(0, totalOriginalPrice - subtotal);
    const grandTotal = subtotal + finalDeliveryFee;

    return {
      items,
      totalItems,
      subtotal,
      totalOriginalPrice,
      totalDiscount,
      deliveryFee: finalDeliveryFee,
      freeDeliveryThreshold: FREE_THRESHOLD,
      freeDeliveryRemaining,
      grandTotal,
    };
  }

  /** Verifies a variantId actually belongs to productId (never trust the pair independently). */
  private static async assertVariantBelongsToProduct(variantId: number, productId: number) {
    const [variant] = await db
      .select({ id: productVariants.id, stockCount: productVariants.stockCount })
      .from(productVariants)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
      .limit(1);
    if (!variant) throw new Error('Selected product variant does not exist for this product');
    return variant;
  }

  static async addItem(userId: number, productId: number, variantId: number | null | undefined, quantity: number) {
    const [product] = await db
      .select({ id: products.id, stock: products.stock, status: products.status })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product || product.status !== 'ACTIVE') {
      throw new Error('Product is unavailable or out of stock');
    }

    let availableStock = product.stock;
    if (variantId) {
      const variant = await this.assertVariantBelongsToProduct(variantId, productId);
      availableStock = variant.stockCount;
    }

    if (availableStock < quantity) {
      throw new Error(`Only ${availableStock} items currently available in stock`);
    }

    const cartId = await this.getOrCreateUserCartId(userId);

    const [existingItem] = await db
      .select({ id: cartItems.id, quantity: cartItems.quantity })
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cartId),
          eq(cartItems.productId, productId),
          variantId ? eq(cartItems.variantId, variantId) : isNull(cartItems.variantId)
        )
      )
      .limit(1);

    if (existingItem) {
      const newQty = Math.min(20, Math.min(availableStock, existingItem.quantity + quantity));
      await db.update(cartItems).set({ quantity: newQty, updatedAt: new Date() }).where(eq(cartItems.id, existingItem.id));
    } else {
      await db.insert(cartItems).values({ cartId, productId, variantId: variantId || null, quantity });
    }

    return this.getCart(userId);
  }

  static async updateItem(userId: number, itemId: number, quantity: number) {
    const cartId = await this.getOrCreateUserCartId(userId);
    const [item] = await db
      .select({ id: cartItems.id, productId: cartItems.productId, variantId: cartItems.variantId })
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
      .limit(1);

    if (!item) throw new Error('Cart item not found');

    let availableStock = 0;
    if (item.variantId) {
      const variant = await this.assertVariantBelongsToProduct(item.variantId, item.productId);
      availableStock = variant.stockCount;
    } else {
      const [product] = await db.select({ stock: products.stock }).from(products).where(eq(products.id, item.productId)).limit(1);
      availableStock = product?.stock || 0;
    }

    if (quantity > availableStock) {
      throw new Error(`Only ${availableStock} items currently available in stock`);
    }

    await db.update(cartItems).set({ quantity, updatedAt: new Date() }).where(eq(cartItems.id, itemId));
    return this.getCart(userId);
  }

  static async removeItem(userId: number, itemId: number) {
    const cartId = await this.getOrCreateUserCartId(userId);
    await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
    return this.getCart(userId);
  }

  static async clearCart(userId: number) {
    const cartId = await this.getOrCreateUserCartId(userId);
    await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
    return this.getCart(userId);
  }
}
