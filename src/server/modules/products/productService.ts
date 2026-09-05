import { and, asc, desc, eq, gte, lte, like, or, sql, SQL, inArray, notInArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/src/db';
import {
  products,
  categories,
  sellers,
  productImages,
  productVariants,
  productSpecifications,
  reviews,
  questions,
  answers,
  users,
  orders,
  orderItems,
} from '@/src/db/schema';
import { getDeliveryEstimate } from '@/src/lib/date';

export interface ProductQueryParams {
  q?: string;
  category?: string;
  categories?: number[];
  ids?: number[];
  excludeIds?: number[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minDiscount?: number;
  inStock?: boolean;
  isDeal?: boolean;
  isFeatured?: boolean;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc' | 'newest' | 'discount_desc';
  page?: number;
  limit?: number;
}

function discountPercentExpr() {
  return sql<number>`CASE WHEN ${products.basePrice} > 0 THEN ROUND(((${products.basePrice} - ${products.discountPrice})::numeric / ${products.basePrice}) * 100) ELSE 0 END`;
}

export class ProductService {
  static async getProducts(params: ProductQueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 12));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(products.status, 'ACTIVE')];

    if (params.q && params.q.trim().length > 0) {
      const term = `%${params.q.trim()}%`;
      conditions.push(
        or(
          like(products.name, term),
          like(products.description, term),
          like(products.brand, term),
          like(categories.name, term)
        )!
      );
    }

    if (params.category && params.category !== 'all') {
      const asNumber = Number(params.category);
      conditions.push(
        or(eq(categories.slug, params.category), !isNaN(asNumber) ? eq(categories.id, asNumber) : sql`false`)!
      );
    }

    if (params.categories && params.categories.length > 0) {
      conditions.push(inArray(products.categoryId, params.categories));
    }

    if (params.ids && params.ids.length > 0) {
      conditions.push(inArray(products.id, params.ids));
    }

    if (params.excludeIds && params.excludeIds.length > 0) {
      conditions.push(notInArray(products.id, params.excludeIds));
    }

    if (params.minPrice !== undefined && !isNaN(params.minPrice)) {
      conditions.push(gte(products.discountPrice, params.minPrice));
    }
    if (params.maxPrice !== undefined && !isNaN(params.maxPrice)) {
      conditions.push(lte(products.discountPrice, params.maxPrice));
    }
    if (params.minRating !== undefined && !isNaN(params.minRating)) {
      conditions.push(gte(products.rating, String(params.minRating)));
    }
    if (params.minDiscount !== undefined && !isNaN(params.minDiscount)) {
      conditions.push(gte(discountPercentExpr(), params.minDiscount));
    }
    if (params.inStock) {
      conditions.push(sql`${products.stock} > 0`);
    }
    if (params.isDeal) {
      conditions.push(eq(products.isDeal, true));
    }
    if (params.isFeatured) {
      conditions.push(eq(products.isFeatured, true));
    }

    const whereClause = and(...conditions);

    let orderBy;
    switch (params.sort) {
      case 'price_asc':
        orderBy = [asc(products.discountPrice)];
        break;
      case 'price_desc':
        orderBy = [desc(products.discountPrice)];
        break;
      case 'rating_desc':
        orderBy = [desc(products.rating), desc(products.reviewCount)];
        break;
      case 'discount_desc':
        orderBy = [desc(discountPercentExpr())];
        break;
      case 'newest':
        orderBy = [desc(products.createdAt)];
        break;
      case 'relevance':
      default:
        // When hydrating a specific set of ids (e.g. "recently viewed") and
        // the caller didn't ask for a different sort, preserve the order
        // the ids were given in rather than falling back to relevance —
        // that order usually encodes recency/relevance the caller already
        // computed (most-recently-viewed first, etc).
        if (params.ids && params.ids.length > 0) {
          orderBy = [
            sql`array_position(ARRAY[${sql.join(
              params.ids.map((id) => sql`${id}`),
              sql`, `
            )}]::int[], ${products.id})`,
          ];
        } else {
          orderBy = [desc(products.isFeatured), desc(products.rating), desc(products.id)];
        }
        break;
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(whereClause);

    const rows = await db
      .select({
        id: products.id,
        sellerId: products.sellerId,
        categoryId: products.categoryId,
        name: products.name,
        slug: products.slug,
        description: products.description,
        basePrice: products.basePrice,
        discountPrice: products.discountPrice,
        stock: products.stock,
        status: products.status,
        brand: products.brand,
        model: products.model,
        warranty: products.warranty,
        weight: products.weight,
        deliveryFee: products.deliveryFee,
        estimatedDays: products.estimatedDays,
        isFeatured: products.isFeatured,
        isDeal: products.isDeal,
        rating: products.rating,
        reviewCount: products.reviewCount,
        createdAt: products.createdAt,
        categoryName: categories.name,
        categorySlug: categories.slug,
        sellerName: sellers.storeName,
        sellerRating: sellers.rating,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(sellers, eq(products.sellerId, sellers.id))
      .where(whereClause)
      .orderBy(...orderBy)
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
          sellerId: r.sellerId,
          categoryId: r.categoryId,
          categoryName: r.categoryName,
          categorySlug: r.categorySlug,
          sellerName: r.sellerName,
          sellerRating: Number(r.sellerRating || 0),
          name: r.name,
          slug: r.slug,
          description: r.description,
          basePrice: r.basePrice,
          discountPrice: r.discountPrice,
          discountPercent,
          stock: r.stock,
          inStock: r.stock > 0,
          status: r.status,
          brand: r.brand,
          model: r.model,
          warranty: r.warranty,
          weight: r.weight,
          deliveryFee: r.deliveryFee,
          estimatedDays: r.estimatedDays,
          deliveryInfo: getDeliveryEstimate(r.estimatedDays, r.deliveryFee),
          isFeatured: r.isFeatured,
          isDeal: r.isDeal,
          rating: Number(r.rating || 0),
          reviewCount: r.reviewCount,
          primaryImage: primaryImage?.imageUrl || 'https://picsum.photos/seed/prod/600/600',
          createdAt: r.createdAt.toISOString(),
        };
      })
    );

    return {
      products: productList,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
        hasMore: offset + productList.length < count,
      },
    };
  }

  /**
   * Real trending, not fake urgency: ranks products by units sold in the
   * trailing `days` window using actual order_items rows. Cold-starts
   * gracefully — if there isn't enough order history yet (new store, quiet
   * period), the remainder is backfilled with featured/top-rated products
   * so the section is never empty, without pretending those are "trending".
   */
  static async getTrending(limit = 8, days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const salesRows = await db
      .select({
        productId: orderItems.productId,
        totalQty: sql<number>`SUM(${orderItems.quantity})::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(gte(orders.createdAt, cutoff), notInArray(orders.status, ['CANCELLED', 'RETURNED'])))
      .groupBy(orderItems.productId)
      .orderBy(desc(sql`SUM(${orderItems.quantity})`))
      .limit(limit);

    let trendingIds = salesRows.map((r) => r.productId);
    const isFromRealSales = new Set(trendingIds);

    if (trendingIds.length < limit) {
      const fallback = await this.getProducts({
        excludeIds: trendingIds.length > 0 ? trendingIds : undefined,
        isFeatured: undefined,
        sort: 'rating_desc',
        limit: limit - trendingIds.length,
        inStock: true,
      });
      trendingIds = [...trendingIds, ...fallback.products.map((p) => p.id)];
    }

    if (trendingIds.length === 0) return { products: [] as Awaited<ReturnType<typeof this.getProducts>>['products'] };

    const { products: hydrated } = await this.getProducts({ ids: trendingIds, inStock: true, limit });

    return {
      products: hydrated.map((p) => ({ ...p, isTrending: isFromRealSales.has(p.id) })),
    };
  }

  static async getProductBySlug(slug: string) {
    const [r] = await db
      .select({
        id: products.id,
        sellerId: products.sellerId,
        categoryId: products.categoryId,
        name: products.name,
        slug: products.slug,
        description: products.description,
        basePrice: products.basePrice,
        discountPrice: products.discountPrice,
        stock: products.stock,
        status: products.status,
        brand: products.brand,
        model: products.model,
        warranty: products.warranty,
        weight: products.weight,
        deliveryFee: products.deliveryFee,
        estimatedDays: products.estimatedDays,
        isFeatured: products.isFeatured,
        isDeal: products.isDeal,
        rating: products.rating,
        reviewCount: products.reviewCount,
        createdAt: products.createdAt,
        categoryName: categories.name,
        categorySlug: categories.slug,
        sellerName: sellers.storeName,
        sellerSlug: sellers.slug,
        sellerRating: sellers.rating,
        sellerReviews: sellers.reviewCount,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(sellers, eq(products.sellerId, sellers.id))
      .where(eq(products.slug, slug))
      .limit(1);

    if (!r) return null;

    const productId = r.id;

    const images = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(sql`${productImages.isPrimary} DESC, ${productImages.displayOrder} ASC`);

    const variants = await db.select().from(productVariants).where(eq(productVariants.productId, productId));

    const specifications = await db
      .select()
      .from(productSpecifications)
      .where(eq(productSpecifications.productId, productId))
      .orderBy(asc(productSpecifications.displayOrder));

    // Rating breakdown built exclusively from real review rows. No mock /
    // fallback distribution is generated when a product has no reviews yet.
    const reviewStats = await db
      .select({ rating: reviews.rating, count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(eq(reviews.productId, productId))
      .groupBy(reviews.rating);

    const ratingBreakdown: Record<number, { count: number; percentage: number }> = {
      5: { count: 0, percentage: 0 },
      4: { count: 0, percentage: 0 },
      3: { count: 0, percentage: 0 },
      2: { count: 0, percentage: 0 },
      1: { count: 0, percentage: 0 },
    };

    let actualCount = 0;
    for (const stat of reviewStats) {
      actualCount += stat.count;
      if (ratingBreakdown[stat.rating]) ratingBreakdown[stat.rating].count = stat.count;
    }
    if (actualCount > 0) {
      for (let s = 1; s <= 5; s++) {
        ratingBreakdown[s].percentage = Math.round((ratingBreakdown[s].count / actualCount) * 100);
      }
    }
    // If actualCount === 0, every bucket stays { count: 0, percentage: 0 } -
    // the UI shows "No reviews yet" rather than an invented distribution.

    const discountPercent = r.basePrice > r.discountPrice ? Math.round(((r.basePrice - r.discountPrice) / r.basePrice) * 100) : 0;
    const primaryImage =
      images.find((img) => img.isPrimary)?.imageUrl ||
      images[0]?.imageUrl ||
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80';

    const reviewRows = await db
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
      .where(eq(reviews.productId, productId))
      .orderBy(desc(reviews.createdAt));

    const answerUsers = alias(users, 'answer_users');
    const questionRows = await db
      .select({
        id: questions.id,
        userId: questions.userId,
        userName: users.username,
        questionText: questions.questionText,
        createdAt: questions.createdAt,
        answerText: answers.answerText,
        isSellerAnswer: answers.isSellerAnswer,
        answererName: answerUsers.username,
      })
      .from(questions)
      .innerJoin(users, eq(questions.userId, users.id))
      .leftJoin(answers, eq(answers.questionId, questions.id))
      .leftJoin(answerUsers, eq(answers.userId, answerUsers.id))
      .where(eq(questions.productId, productId))
      .orderBy(desc(questions.createdAt));

    const specsMap: Record<string, string> = {};
    for (const spec of specifications) specsMap[spec.specKey] = spec.specValue;

    return {
      id: r.id,
      sellerId: r.sellerId,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      categorySlug: r.categorySlug,
      seller: {
        name: r.sellerName,
        slug: r.sellerSlug,
        rating: Number(r.sellerRating || 0),
        reviewCount: r.sellerReviews,
      },
      name: r.name,
      slug: r.slug,
      description: r.description,
      basePrice: r.basePrice,
      discountPrice: r.discountPrice,
      discountPercent,
      stock: r.stock,
      inStock: r.stock > 0,
      status: r.status,
      brand: r.brand,
      model: r.model,
      warranty: r.warranty,
      weight: r.weight,
      deliveryFee: r.deliveryFee,
      estimatedDays: r.estimatedDays,
      deliveryInfo: getDeliveryEstimate(r.estimatedDays, r.deliveryFee),
      isFeatured: r.isFeatured,
      isDeal: r.isDeal,
      rating: Number(r.rating || 0),
      reviewCount: r.reviewCount,
      primaryImage,
      images: images.map((img) => ({ id: img.id, imageUrl: img.imageUrl, altText: img.altText, isPrimary: img.isPrimary })),
      variants: variants.map((v) => ({
        id: v.id,
        variantName: v.variantName,
        sku: v.sku,
        priceAdjustment: v.priceAdjustment,
        stockCount: v.stockCount,
        attributes: v.attributesJson || {},
      })),
      specifications: specifications.map((s) => ({ id: s.id, key: s.specKey, value: s.specValue })),
      specs: specsMap,
      reviews: reviewRows.map((rev) => ({
        id: rev.id,
        userId: rev.userId,
        userName: rev.userName || 'Customer',
        rating: rev.rating,
        title: rev.title,
        comment: rev.comment,
        verifiedPurchase: rev.isVerifiedPurchase,
        createdAt: rev.createdAt.toISOString(),
      })),
      questions: questionRows.map((q) => ({
        id: q.id,
        userId: q.userId,
        userName: q.userName || 'Shopper',
        question: q.questionText,
        answer: q.answerText || undefined,
        answeredBy: q.answerText ? (q.isSellerAnswer ? 'Verified Seller' : q.answererName || 'Shopper') : undefined,
        createdAt: q.createdAt.toISOString(),
      })),
      ratingBreakdown,
      hasReviews: actualCount > 0,
      createdAt: r.createdAt.toISOString(),
    };
  }

  static async getFeatured(limit = 8) {
    return this.getProducts({ isFeatured: true, limit });
  }

  static async getDeals(limit = 8) {
    return this.getProducts({ isDeal: true, limit });
  }
}
