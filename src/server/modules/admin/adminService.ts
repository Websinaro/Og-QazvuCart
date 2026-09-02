import { desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  orders,
  orderItems,
  products,
  users,
  categories,
  sellers,
  productImages,
} from '@/src/db/schema';
import { OrderService } from '../orders/orderService';

export class AdminService {
  static async getDashboardStats() {
    const [orderStats] = await db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        totalRevenue: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
      })
      .from(orders)
      .where(sql`${orders.paymentStatus} = 'PAID'`);

    const [userStats] = await db.select({ totalUsers: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'CUSTOMER'));
    const [sellerStats] = await db.select({ activeSellers: sql<number>`count(*)::int` }).from(sellers).where(eq(sellers.isVerified, true));
    const [productStats] = await db.select({ totalProducts: sql<number>`count(*)::int` }).from(products).where(eq(products.status, 'ACTIVE'));

    const [pendingStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(sql`${orders.status} NOT IN ('DELIVERED', 'CANCELLED', 'RETURNED')`);

    const [deliveredStats] = await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, 'DELIVERED'));

    const [lowStockStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(sql`${products.stock} <= 5 AND ${products.status} = 'ACTIVE'`);

    const recentOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerName: users.username,
        customerEmail: users.email,
        totalAmount: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.id))
      .limit(10);

    const salesByCategory = await db
      .select({ categoryName: categories.name, productCount: sql<number>`count(${products.id})::int` })
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .groupBy(categories.id, categories.name)
      .orderBy(categories.displayOrder);

    return {
      totalRevenue: orderStats?.totalRevenue || 0,
      totalOrders: orderStats?.totalOrders || 0,
      totalProducts: productStats?.totalProducts || 0,
      totalUsers: userStats?.totalUsers || 0,
      activeSellers: sellerStats?.activeSellers || 0,
      pendingOrdersCount: pendingStats?.count || 0,
      deliveredOrdersCount: deliveredStats?.count || 0,
      lowStockProductsCount: lowStockStats?.count || 0,
      recentOrders: recentOrders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
      salesByCategory,
    };
  }

  static async getAllOrders() {
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerName: users.username,
        customerEmail: users.email,
        customerPhone: users.phone,
        subtotal: orders.subtotal,
        deliveryFee: orders.deliveryFee,
        totalAmount: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        estimatedDeliveryDate: orders.estimatedDeliveryDate,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.id))
      .limit(200);

    return Promise.all(
      rows.map(async (o) => {
        const items = await db
          .select({
            id: orderItems.id,
            productName: orderItems.productName,
            productImage: orderItems.productImage,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            itemTotal: orderItems.totalPrice,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, o.id));

        return { ...o, createdAt: o.createdAt.toISOString(), items };
      })
    );
  }

  /** Validated through the same state machine used by customer-facing cancellation. */
  static async updateOrderStatus(orderId: number, nextStatus: string) {
    return OrderService.adminUpdateStatus(orderId, nextStatus);
  }

  static async getAllProducts() {
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        brand: products.brand,
        categoryName: categories.name,
        sellerStoreName: sellers.storeName,
        basePrice: products.basePrice,
        discountPrice: products.discountPrice,
        stock: products.stock,
        status: products.status,
        isFeatured: products.isFeatured,
        isDeal: products.isDeal,
        rating: products.rating,
        reviewCount: products.reviewCount,
        createdAt: products.createdAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(sellers, eq(products.sellerId, sellers.id))
      .orderBy(desc(products.id))
      .limit(500);

    return Promise.all(
      rows.map(async (p) => {
        const [primaryImage] = await db
          .select({ imageUrl: productImages.imageUrl })
          .from(productImages)
          .where(eq(productImages.productId, p.id))
          .orderBy(sql`${productImages.isPrimary} DESC, ${productImages.displayOrder} ASC`)
          .limit(1);

        return {
          ...p,
          rating: Number(p.rating || 0),
          createdAt: p.createdAt.toISOString(),
          primaryImage: primaryImage?.imageUrl || 'https://picsum.photos/seed/prod/600/600',
        };
      })
    );
  }

  /**
   * Gets (or lazily creates) a platform-owned seller record attributed to
   * the given admin user, so admins can list products without first going
   * through seller onboarding. This is idempotent: repeated calls for the
   * same admin reuse the same store.
   */
  private static async getOrCreateAdminSeller(adminUserId: number) {
    const [existingByUser] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.userId, adminUserId)).limit(1);
    if (existingByUser) return existingByUser;

    const storeName = 'QazvuCart Official Store';
    const slug = `qazvucart-official-${adminUserId}-${Date.now()}`;

    try {
      const [created] = await db
        .insert(sellers)
        .values({
          userId: adminUserId,
          storeName,
          slug,
          rating: '5.0',
          reviewCount: 0,
          isVerified: true,
        })
        .returning({ id: sellers.id });

      return created;
    } catch {
      // Another concurrent request created the seller first (unique
      // constraint on sellers.userId) - just re-read it.
      const [retry] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.userId, adminUserId)).limit(1);
      if (retry) return retry;
      throw new Error('Failed to provision a store for this admin account');
    }
  }

  static async createProduct(
    adminUserId: number,
    data: {
      name: string;
      brand: string;
      categoryId: number;
      basePrice: number;
      discountPrice: number;
      stock: number;
      description: string;
      imageUrl?: string;
      isDeal?: boolean;
      isFeatured?: boolean;
    }
  ) {
    // Admin-created products don't require a separate seller signup: we
    // attribute them to a platform-owned seller record, auto-creating one
    // tied to this admin the first time it's needed.
    const seller = await this.getOrCreateAdminSeller(adminUserId);

    const slug = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}`;

    const [product] = await db
      .insert(products)
      .values({
        sellerId: seller.id,
        categoryId: data.categoryId,
        name: data.name,
        slug,
        description: data.description,
        basePrice: data.basePrice,
        discountPrice: data.discountPrice,
        stock: data.stock,
        brand: data.brand,
        isDeal: Boolean(data.isDeal),
        isFeatured: Boolean(data.isFeatured),
      })
      .returning({ id: products.id });

    if (data.imageUrl) {
      await db.insert(productImages).values({ productId: product.id, imageUrl: data.imageUrl, isPrimary: true, displayOrder: 1 });
    }

    return product;
  }

  static async updateProduct(productId: number, data: Partial<{ discountPrice: number; stock: number; status: string }>) {
    const updates: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
    if (data.discountPrice !== undefined) updates.discountPrice = data.discountPrice;
    if (data.stock !== undefined) updates.stock = data.stock;
    if (data.status !== undefined) updates.status = data.status;

    await db.update(products).set(updates).where(eq(products.id, productId));
    return { success: true };
  }

  static async getAllUsers() {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isVerified: users.isVerified,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.id))
      .limit(500);

    return rows.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));
  }

  static async updateUserRole(userId: number, role: 'CUSTOMER' | 'SELLER' | 'ADMIN') {
    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
    return { success: true };
  }
}
