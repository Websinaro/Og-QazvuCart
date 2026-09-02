import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { reviews, orders, orderItems, products, users, productImages } from '@/src/db/schema';

export class ReviewService {
  /**
   * A user may review a product only if they have at least one order,
   * belonging to them, containing that product, whose status is exactly
   * DELIVERED. PROCESSING/CONFIRMED/etc. orders do NOT grant eligibility.
   */
  static async getEligibility(userId: number, productId: number) {
    const [eligibleOrder] = await db
      .select({ orderId: orders.id })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(eq(orders.userId, userId), eq(orders.status, 'DELIVERED'), eq(orderItems.productId, productId)))
      .limit(1);

    const [existingReview] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.productId, productId), eq(reviews.userId, userId)))
      .limit(1);

    return {
      canReview: Boolean(eligibleOrder) && !existingReview,
      hasPurchased: Boolean(eligibleOrder),
      hasReviewed: Boolean(existingReview),
      eligibleOrderId: eligibleOrder?.orderId || null,
    };
  }

  static async createReview(userId: number, productId: number, data: { rating: number; title: string; comment: string }) {
    const eligibility = await this.getEligibility(userId, productId);

    if (!eligibility.hasPurchased) {
      throw new Error('You can only review products from orders that have been delivered to you.');
    }
    if (eligibility.hasReviewed) {
      // Enforced again at the DB layer via the reviews_product_user_idx
      // unique constraint - this check just gives a clean error message.
      throw new Error('You have already reviewed this product.');
    }

    return db.transaction(async (tx) => {
      const [review] = await tx
        .insert(reviews)
        .values({
          productId,
          userId,
          orderId: eligibility.eligibleOrderId,
          rating: data.rating,
          title: data.title.trim(),
          comment: data.comment.trim(),
          isVerifiedPurchase: true,
        })
        .returning();

      // Recompute the product's aggregate rating from real review rows only.
      const [agg] = await tx
        .select({
          avgRating: sql<number>`ROUND(AVG(${reviews.rating})::numeric, 2)`,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(eq(reviews.productId, productId));

      await tx
        .update(products)
        .set({ rating: String(agg.avgRating || 0), reviewCount: agg.count, updatedAt: new Date() })
        .where(eq(products.id, productId));

      return review;
    });
  }

  static async getProductReviews(productId: number) {
    return db
      .select({
        id: reviews.id,
        userId: reviews.userId,
        userName: users.username,
        rating: reviews.rating,
        title: reviews.title,
        comment: reviews.comment,
        isVerifiedPurchase: reviews.isVerifiedPurchase,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.productId, productId));
  }

  /** Products the user has a DELIVERED order for but hasn't reviewed yet. */
  static async getPendingReviews(userId: number) {
    const deliveredProducts = await db
      .selectDistinct({
        productId: orderItems.productId,
        productName: orderItems.productName,
        productImage: orderItems.productImage,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        deliveredAt: orders.updatedAt,
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(eq(orders.userId, userId), eq(orders.status, 'DELIVERED')));

    const alreadyReviewed = await db.select({ productId: reviews.productId }).from(reviews).where(eq(reviews.userId, userId));
    const reviewedSet = new Set(alreadyReviewed.map((r) => r.productId));

    const seen = new Set<number>();
    const pending = [];
    for (const item of deliveredProducts) {
      if (reviewedSet.has(item.productId) || seen.has(item.productId)) continue;
      seen.add(item.productId);
      pending.push({
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        orderId: item.orderId,
        orderNumber: item.orderNumber,
        deliveredAt: item.deliveredAt.toISOString(),
      });
    }
    return pending;
  }

  static async getUserReviews(userId: number) {
    const rows = await db
      .select({
        id: reviews.id,
        productId: reviews.productId,
        productName: products.name,
        productSlug: products.slug,
        rating: reviews.rating,
        title: reviews.title,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(products, eq(reviews.productId, products.id))
      .where(eq(reviews.userId, userId));

    return Promise.all(
      rows.map(async (r) => {
        const [primaryImage] = await db
          .select({ imageUrl: productImages.imageUrl })
          .from(productImages)
          .where(eq(productImages.productId, r.productId))
          .orderBy(sql`${productImages.isPrimary} DESC`)
          .limit(1);
        return { ...r, createdAt: r.createdAt.toISOString(), productImage: primaryImage?.imageUrl || null };
      })
    );
  }
}
