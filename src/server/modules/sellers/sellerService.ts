import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { sellers, users, products, categories, productImages } from '@/src/db/schema';

export interface SellerProductQueryParams {
  page?: number;
  limit?: number;
}

export class SellerService {
  /**
   * Public storefront lookup: the seller's profile plus a paginated view
   * of their live (ACTIVE) catalog. Returns null when the store doesn't
   * exist so the route can respond with a clean 404 instead of throwing.
   */
  static async getSellerBySlug(slug: string, params: SellerProductQueryParams = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 12));
    const offset = (page - 1) * limit;

    const [seller] = await db
      .select({
        id: sellers.id,
        storeName: sellers.storeName,
        slug: sellers.slug,
        rating: sellers.rating,
        reviewCount: sellers.reviewCount,
        isVerified: sellers.isVerified,
        createdAt: sellers.createdAt,
        ownerAvatarUrl: users.avatarUrl,
      })
      .from(sellers)
      .innerJoin(users, eq(sellers.userId, users.id))
      .where(eq(sellers.slug, slug))
      .limit(1);

    if (!seller) return null;

    const activeCondition = and(eq(products.sellerId, seller.id), eq(products.status, 'ACTIVE'));

    const [{ count: totalProducts }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(activeCondition);

    const [{ count: totalCategories }] = await db
      .select({ count: sql<number>`count(distinct ${products.categoryId})::int` })
      .from(products)
      .where(activeCondition);

    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        brand: products.brand,
        basePrice: products.basePrice,
        discountPrice: products.discountPrice,
        stock: products.stock,
        rating: products.rating,
        reviewCount: products.reviewCount,
        isDeal: products.isDeal,
        createdAt: products.createdAt,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(activeCondition)
      .orderBy(desc(products.isFeatured), desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    const productList = await Promise.all(
      rows.map(async (r) => {
        const [primaryImage] = await db
          .select({ imageUrl: productImages.imageUrl })
          .from(productImages)
          .where(eq(productImages.productId, r.id))
          .orderBy(sql`${productImages.isPrimary} DESC, ${productImages.displayOrder} ASC`)
          .limit(1);

        const discountPercent =
          r.basePrice > r.discountPrice ? Math.round(((r.basePrice - r.discountPrice) / r.basePrice) * 100) : 0;

        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          brand: r.brand,
          categoryName: r.categoryName || undefined,
          basePrice: r.basePrice,
          discountPrice: r.discountPrice,
          discountPercent,
          rating: Number(r.rating || 0),
          reviewCount: r.reviewCount,
          primaryImage: primaryImage?.imageUrl || 'https://picsum.photos/seed/prod/600/600',
          inStock: r.stock > 0,
          stock: r.stock,
          isDeal: r.isDeal,
        };
      })
    );

    return {
      seller: {
        id: seller.id,
        name: seller.storeName,
        slug: seller.slug,
        rating: Number(seller.rating || 0),
        reviewCount: seller.reviewCount,
        isVerified: seller.isVerified,
        memberSince: seller.createdAt.toISOString(),
        avatarUrl: seller.ownerAvatarUrl || undefined,
        totalProducts,
        totalCategories,
      },
      products: productList,
      pagination: {
        total: totalProducts,
        page,
        limit,
        totalPages: Math.ceil(totalProducts / limit) || 1,
        hasMore: offset + productList.length < totalProducts,
      },
    };
  }
}
