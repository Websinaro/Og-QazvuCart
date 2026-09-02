import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { wishlists, products, productImages } from '@/src/db/schema';
import { sql } from 'drizzle-orm';

export class WishlistService {
  static async getWishlist(userId: number) {
    const rows = await db
      .select({
        wishlistId: wishlists.id,
        productId: products.id,
        name: products.name,
        slug: products.slug,
        brand: products.brand,
        basePrice: products.basePrice,
        discountPrice: products.discountPrice,
        stock: products.stock,
        rating: products.rating,
        reviewCount: products.reviewCount,
        addedAt: wishlists.createdAt,
      })
      .from(wishlists)
      .innerJoin(products, eq(wishlists.productId, products.id))
      .where(eq(wishlists.userId, userId))
      .orderBy(desc(wishlists.id));

    const items = await Promise.all(
      rows.map(async (r) => {
        const [primaryImage] = await db
          .select({ imageUrl: productImages.imageUrl })
          .from(productImages)
          .where(eq(productImages.productId, r.productId))
          .orderBy(sql`${productImages.isPrimary} DESC, ${productImages.displayOrder} ASC`)
          .limit(1);

        const discountPercent = r.basePrice > r.discountPrice ? Math.round(((r.basePrice - r.discountPrice) / r.basePrice) * 100) : 0;

        return {
          wishlistId: r.wishlistId,
          productId: r.productId,
          name: r.name,
          slug: r.slug,
          brand: r.brand,
          basePrice: r.basePrice,
          discountPrice: r.discountPrice,
          discountPercent,
          inStock: r.stock > 0,
          rating: Number(r.rating || 0),
          reviewCount: r.reviewCount,
          image: primaryImage?.imageUrl || 'https://picsum.photos/seed/prod/600/600',
          addedAt: r.addedAt.toISOString(),
        };
      })
    );

    return items;
  }

  static async addToWishlist(userId: number, productId: number) {
    const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
    if (!product) throw new Error('Product not found');

    const [existing] = await db
      .select({ id: wishlists.id })
      .from(wishlists)
      .where(and(eq(wishlists.userId, userId), eq(wishlists.productId, productId)))
      .limit(1);

    if (!existing) {
      await db.insert(wishlists).values({ userId, productId });
    }

    return this.getWishlist(userId);
  }

  static async removeFromWishlist(userId: number, productId: number) {
    await db.delete(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.productId, productId)));
    return this.getWishlist(userId);
  }

  static async isInWishlist(userId: number, productId: number) {
    const [existing] = await db
      .select({ id: wishlists.id })
      .from(wishlists)
      .where(and(eq(wishlists.userId, userId), eq(wishlists.productId, productId)))
      .limit(1);
    return Boolean(existing);
  }
}
