import { and, eq, sql } from 'drizzle-orm';
import type { PgTransaction, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { db } from '@/src/db';
import * as schema from '@/src/db/schema';
import {
  orders,
  orderItems,
  orderTimeline,
  products,
  productVariants,
  productImages,
  cartItems,
  carts,
} from '@/src/db/schema';
import { AddressService } from '../addresses/addressService';
import { CartService } from '../cart/cartService';
import { getDeliveryEstimate } from '@/src/lib/date';
import { assertValidTransition, isValidOrderStatus } from '@/src/lib/orderStateMachine';

export interface CreateOrderParams {
  addressId?: number;
  shippingAddressSnapshot?: Record<string, unknown>;
  paymentMethod?: 'UPI' | 'CARD' | 'NETBANKING' | 'COD';
  directBuyItem?: {
    productId: number;
    variantId?: number | null;
    quantity: number;
  };
}

interface PreparedItem {
  productId: number;
  variantId: number | null;
  productName: string;
  productImage: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  estimatedDays: number;
  deliveryFee: number;
}

class OutOfStockError extends Error {}

// Both the pooled `db` instance and a `db.transaction((tx) => ...)` handle
// share the same query-builder surface (select/insert/update/delete), so
// helpers that may run either inside or outside a transaction accept this
// union rather than being locked to one concrete type.
type DbClient = typeof db | PgTransaction<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export class OrderService {
  /**
   * Places an order inside a single PostgreSQL transaction:
   *   validate cart/products/variants -> price -> reserve inventory
   *   atomically -> create order + items + timeline -> clear cart -> COMMIT.
   * Any failure (including "out of stock" discovered at reservation time)
   * rolls the entire transaction back, so no partial order or stock
   * decrement is ever persisted.
   */
  static async createOrder(userId: number, params: CreateOrderParams) {
    return db.transaction(async (tx) => {
      // 1. Resolve shipping address snapshot -------------------------------
      let addressSnapshot: Record<string, unknown> | undefined = params.shippingAddressSnapshot;
      if (!addressSnapshot && params.addressId) {
        const addr = await AddressService.getAddressById(userId, params.addressId);
        if (addr) {
          addressSnapshot = {
            fullName: addr.fullName,
            phoneNumber: addr.phoneNumber,
            houseBuilding: addr.houseBuilding,
            streetArea: addr.streetArea,
            city: addr.city,
            state: addr.state,
            postalCode: addr.postalCode,
            country: addr.country,
          };
        }
      }

      if (!addressSnapshot) {
        const addressList = await AddressService.getAddresses(userId);
        const defaultAddr = addressList.find((a) => a.isDefault) || addressList[0];
        if (defaultAddr) {
          addressSnapshot = {
            fullName: defaultAddr.fullName,
            phoneNumber: defaultAddr.phoneNumber,
            houseBuilding: defaultAddr.houseBuilding,
            streetArea: defaultAddr.streetArea,
            city: defaultAddr.city,
            state: defaultAddr.state,
            postalCode: defaultAddr.postalCode,
            country: defaultAddr.country,
          };
        } else {
          throw new Error('A delivery address is required to place an order.');
        }
      }

      // 2. Validate products / variants and price the order ----------------
      const itemsToOrder: PreparedItem[] = [];

      if (params.directBuyItem) {
        const { productId, variantId, quantity } = params.directBuyItem;

        const [prod] = await tx
          .select({
            id: products.id,
            name: products.name,
            basePrice: products.basePrice,
            discountPrice: products.discountPrice,
            stock: products.stock,
            deliveryFee: products.deliveryFee,
            estimatedDays: products.estimatedDays,
            status: products.status,
          })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);

        if (!prod || prod.status !== 'ACTIVE') throw new Error('Product not found or unavailable');

        const [primaryImage] = await tx
          .select({ imageUrl: productImages.imageUrl })
          .from(productImages)
          .where(eq(productImages.productId, prod.id))
          .orderBy(sql`${productImages.isPrimary} DESC`)
          .limit(1);

        let unitPrice = prod.discountPrice;
        let variantName: string | null = null;

        // Never trust productId/variantId independently: the variant must
        // belong to exactly this product.
        if (variantId) {
          const [v] = await tx
            .select({ variantName: productVariants.variantName, priceAdjustment: productVariants.priceAdjustment })
            .from(productVariants)
            .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
            .limit(1);
          if (!v) throw new Error('Selected variant does not belong to this product');
          variantName = v.variantName;
          unitPrice += v.priceAdjustment;
        }

        itemsToOrder.push({
          productId: prod.id,
          variantId: variantId || null,
          productName: prod.name,
          productImage: primaryImage?.imageUrl || 'https://picsum.photos/seed/prod/600/600',
          variantName,
          unitPrice,
          quantity,
          totalPrice: unitPrice * quantity,
          estimatedDays: prod.estimatedDays,
          deliveryFee: prod.deliveryFee,
        });
      } else {
        const cart = await CartService.getCart(userId);
        if (cart.items.length === 0) {
          throw new Error('Your cart is empty. Add products before checking out.');
        }

        for (const item of cart.items) {
          if (!item.inStock) {
            throw new Error(`Item ${item.productName} is out of stock.`);
          }

          // Re-validate variant ownership even for cart items, in case the
          // product's variant lineup changed between add-to-cart and checkout.
          if (item.variantId) {
            const [v] = await tx
              .select({ id: productVariants.id })
              .from(productVariants)
              .where(and(eq(productVariants.id, item.variantId), eq(productVariants.productId, item.productId)))
              .limit(1);
            if (!v) throw new Error(`A variant in your cart is no longer valid for ${item.productName}.`);
          }

          itemsToOrder.push({
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            productImage: item.productImage,
            variantName: item.variantName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            totalPrice: item.itemTotal,
            estimatedDays: item.estimatedDays,
            deliveryFee: item.deliveryFee,
          });
        }
      }

      // 3. Reserve inventory atomically -------------------------------------
      // Each reservation is a single `UPDATE ... WHERE stock >= qty RETURNING`.
      // If zero rows come back, stock was insufficient at the moment of
      // reservation (even if it looked fine a moment earlier), and we throw
      // to roll back the whole transaction - never a silent partial order.
      for (const item of itemsToOrder) {
        if (item.variantId) {
          const updated = await tx
            .update(productVariants)
            .set({ stockCount: sql`${productVariants.stockCount} - ${item.quantity}` })
            .where(and(eq(productVariants.id, item.variantId), sql`${productVariants.stockCount} >= ${item.quantity}`))
            .returning({ id: productVariants.id, stockCount: productVariants.stockCount });

          if (updated.length === 0) {
            throw new OutOfStockError(`${item.productName} (${item.variantName || 'selected variant'}) just went out of stock.`);
          }
        } else {
          const updated = await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${item.quantity}` })
            .where(and(eq(products.id, item.productId), sql`${products.stock} >= ${item.quantity}`))
            .returning({ id: products.id, stock: products.stock });

          if (updated.length === 0) {
            throw new OutOfStockError(`${item.productName} just went out of stock.`);
          }
        }
      }

      // 4. Totals & delivery estimate ----------------------------------------
      const subtotal = itemsToOrder.reduce((acc, item) => acc + item.totalPrice, 0);
      const maxEstimatedDays = Math.max(...itemsToOrder.map((i) => i.estimatedDays), 2);
      const deliveryFee = subtotal >= 999 ? 0 : Math.max(...itemsToOrder.map((i) => i.deliveryFee), 40);
      const total = subtotal + deliveryFee;
      const deliveryEstimate = getDeliveryEstimate(maxEstimatedDays, deliveryFee);

      const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
      const paymentMethod = params.paymentMethod || 'CARD';

      // COD needs no payment gateway, so it can be confirmed immediately.
      // Every other method must go through Razorpay: the order starts in
      // PENDING_PAYMENT / paymentStatus CREATED and is only ever flipped to
      // CONFIRMED/PAID by a server-verified Razorpay signature or webhook
      // (see PaymentService.verifyPayment / handleWebhook) — never by the
      // frontend simply reporting success.
      const isCod = paymentMethod === 'COD';
      const initialStatus = isCod ? 'CONFIRMED' : 'PENDING_PAYMENT';
      const initialPaymentStatus = isCod ? 'PENDING' : 'CREATED';
      // Stock was already reserved (decremented) above at creation time, so
      // an abandoned PENDING_PAYMENT reservation must expire and be
      // released back to stock — see OrderService.releaseExpiredReservations.
      const reservationExpiresAt = isCod ? null : new Date(Date.now() + 15 * 60 * 1000);

      // 5. Create order --------------------------------------------------------
      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId,
          status: initialStatus,
          subtotal,
          discount: 0,
          deliveryFee,
          total,
          shippingAddressSnapshot: addressSnapshot,
          paymentMethod,
          paymentStatus: initialPaymentStatus,
          estimatedDeliveryDate: deliveryEstimate.dateString,
          paymentReservationExpiresAt: reservationExpiresAt,
        })
        .returning({ id: orders.id });

      const orderId = order.id;

      // 6. Order items -----------------------------------------------------
      await tx.insert(orderItems).values(
        itemsToOrder.map((item) => ({
          orderId,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          productImage: item.productImage,
          variantName: item.variantName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
        }))
      );

      // 7. Initial timeline --------------------------------------------------
      const timelineEvents = isCod
        ? [
            { orderId, status: 'PLACED', title: 'Order Placed', description: 'Your order was successfully submitted.', completed: true },
            { orderId, status: 'CONFIRMED', title: 'Order Confirmed', description: 'Cash on Delivery order confirmed and sent to seller for packing.', completed: true },
          ]
        : [
            { orderId, status: 'PLACED', title: 'Order Placed', description: 'Awaiting payment confirmation.', completed: true },
          ];
      await tx.insert(orderTimeline).values(timelineEvents);

      // 8. Clear cart (only for cart-based checkout) --------------------------
      if (!params.directBuyItem) {
        const [cart] = await tx.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
        if (cart) {
          await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
        }
      }

      return this.getOrderByIdWithTx(tx, userId, orderId);
    });
  }

  /**
   * Called only by PaymentService after a Razorpay signature has been
   * verified server-side (either the browser-return verify endpoint or the
   * webhook — both funnel through here so the transition logic lives in
   * exactly one place). Idempotent: if the order is already CONFIRMED/PAID
   * this is a safe no-op, so a replayed webhook can never double-apply
   * side effects.
   */
  static async markOrderPaid(orderId: number) {
    return db.transaction(async (tx) => {
      const [order] = await tx.select({ id: orders.id, status: orders.status, paymentStatus: orders.paymentStatus }).from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) throw new Error('Order not found');

      if (order.paymentStatus === 'PAID') {
        // Already processed by an earlier webhook/verify call.
        return { alreadyProcessed: true };
      }

      await tx
        .update(orders)
        .set({ status: 'CONFIRMED', paymentStatus: 'PAID', paymentReservationExpiresAt: null, updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      await tx.insert(orderTimeline).values({
        orderId,
        status: 'CONFIRMED',
        title: 'Payment Confirmed',
        description: 'Payment verified with Razorpay. Order sent to seller for packing.',
        completed: true,
      });

      return { alreadyProcessed: false };
    });
  }

  /**
   * Called when Razorpay reports a failed/cancelled payment. Releases the
   * stock reservation taken at order-creation time and marks the order
   * CANCELLED so it doesn't sit around forever as PENDING_PAYMENT.
   */
  static async markOrderPaymentFailed(orderId: number, reason?: string) {
    return db.transaction(async (tx) => {
      const [order] = await tx.select({ id: orders.id, status: orders.status, paymentStatus: orders.paymentStatus }).from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) throw new Error('Order not found');

      if (order.status === 'CANCELLED' || order.paymentStatus === 'PAID') {
        return { alreadyProcessed: true };
      }

      await tx
        .update(orders)
        .set({ status: 'CANCELLED', paymentStatus: 'FAILED', paymentReservationExpiresAt: null, updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      const items = await tx
        .select({ productId: orderItems.productId, variantId: orderItems.variantId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      for (const item of items) {
        await tx.update(products).set({ stock: sql`${products.stock} + ${item.quantity}` }).where(eq(products.id, item.productId));
        if (item.variantId) {
          await tx
            .update(productVariants)
            .set({ stockCount: sql`${productVariants.stockCount} + ${item.quantity}` })
            .where(eq(productVariants.id, item.variantId));
        }
      }

      await tx.insert(orderTimeline).values({
        orderId,
        status: 'CANCELLED',
        title: 'Payment Failed',
        description: reason ? `Payment failed: ${reason}` : 'Payment failed or was cancelled.',
        completed: true,
      });

      return { alreadyProcessed: false };
    });
  }

  /**
   * Housekeeping: PENDING_PAYMENT orders whose reservation window has
   * elapsed with no successful payment get their stock released and are
   * marked CANCELLED, the same as an explicit failure. This codebase has
   * no background worker/cron process, so nothing calls this
   * automatically today — wire it to a scheduled task (e.g. a Render Cron
   * Job hitting an authenticated internal route) if abandoned-checkout
   * cleanup matters for your deployment.
   */
  static async releaseExpiredReservations() {
    const expired = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.status, 'PENDING_PAYMENT'), sql`${orders.paymentReservationExpiresAt} < NOW()`));

    for (const o of expired) {
      await this.markOrderPaymentFailed(o.id, 'Payment reservation expired');
    }

    return { released: expired.length };
  }

  /** Ownership-checked fetch used by the payment routes before creating/verifying a Razorpay order. */
  static async getOrderForPayment(userId: number, orderId: number) {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
      .limit(1);
    return order || null;
  }

  static async getUserOrders(userId: number, statusFilter?: string) {
    const conditions = [eq(orders.userId, userId)];
    if (statusFilter && statusFilter !== 'ALL' && isValidOrderStatus(statusFilter.toUpperCase())) {
      conditions.push(eq(orders.status, statusFilter.toUpperCase()));
    }

    const rows = await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(sql`${orders.id} DESC`);

    const result = [];
    for (const o of rows) {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
      const itemCount = items.length;
      const first = items[0];

      result.push({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        subtotal: o.subtotal,
        discount: o.discount,
        deliveryFee: o.deliveryFee,
        total: o.total,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        estimatedDeliveryDate: o.estimatedDeliveryDate,
        createdAt: o.createdAt.toISOString(),
        itemCount,
        summaryName: itemCount > 1 ? `${first?.productName} + ${itemCount - 1} more item(s)` : first?.productName,
        primaryImage: first?.productImage || 'https://picsum.photos/seed/prod/600/600',
      });
    }

    return result;
  }

  static async getOrderById(userId: number, orderId: number | string) {
    return this.getOrderByIdWithTx(db, userId, orderId);
  }

  private static async getOrderByIdWithTx(txOrDb: DbClient, userId: number, orderId: number | string) {
    const isNum = !isNaN(Number(orderId));

    const [order] = await txOrDb
      .select()
      .from(orders)
      .where(
        isNum
          ? and(eq(orders.userId, userId), sql`(${orders.id} = ${Number(orderId)} OR ${orders.orderNumber} = ${String(orderId)})`)
          : and(eq(orders.userId, userId), eq(orders.orderNumber, String(orderId)))
      )
      .limit(1);

    if (!order) return null;

    const items = await txOrDb
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        variantId: orderItems.variantId,
        productName: orderItems.productName,
        productImage: orderItems.productImage,
        variantName: orderItems.variantName,
        unitPrice: orderItems.unitPrice,
        quantity: orderItems.quantity,
        totalPrice: orderItems.totalPrice,
        productSlug: products.slug,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, order.id));

    const timeline = await txOrDb
      .select()
      .from(orderTimeline)
      .where(eq(orderTimeline.orderId, order.id))
      .orderBy(sql`${orderTimeline.id} ASC`);

    const allStages = [
      { key: 'PLACED', title: 'Order Placed', desc: 'Order confirmed and verified' },
      { key: 'CONFIRMED', title: 'Payment Confirmed', desc: order.paymentMethod === 'COD' ? 'Cash on Delivery confirmed' : 'Payment received successfully' },
      { key: 'PACKED', title: 'Packed', desc: 'Seller packed the parcel' },
      { key: 'SHIPPED', title: 'Shipped', desc: 'Handed over to delivery carrier' },
      { key: 'OUT_FOR_DELIVERY', title: 'Out for Delivery', desc: 'Courier out for delivery today' },
      { key: 'DELIVERED', title: 'Delivered', desc: 'Successfully delivered' },
    ];
    const timelineMap = new Map(timeline.map((t) => [t.status, t]));

    const fullStepper = allStages.map((stage, idx) => {
      const existing = timelineMap.get(stage.key);
      return {
        step: idx + 1,
        status: stage.key,
        title: stage.title,
        description: existing ? existing.description : stage.desc,
        completed: Boolean(existing),
        occurredAt: existing ? existing.occurredAt.toISOString() : null,
      };
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status: order.status,
      subtotal: order.subtotal,
      discount: order.discount,
      deliveryFee: order.deliveryFee,
      total: order.total,
      shippingAddress: order.shippingAddressSnapshot,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      createdAt: order.createdAt.toISOString(),
      items: items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productSlug: i.productSlug,
        productName: i.productName,
        productImage: i.productImage,
        variantName: i.variantName,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        totalPrice: i.totalPrice,
      })),
      timeline: fullStepper,
    };
  }

  /** Customer-initiated cancellation. Only valid pre-dispatch, per the order state machine. */
  static async cancelOrder(userId: number, orderId: number) {
    return db.transaction(async (tx) => {
      const [order] = await tx
        .select({ id: orders.id, status: orders.status })
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
        .limit(1);

      if (!order) throw new Error('Order not found');

      assertValidTransition(order.status, 'CANCELLED');

      await tx.update(orders).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(orders.id, orderId));

      const items = await tx
        .select({ productId: orderItems.productId, variantId: orderItems.variantId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      for (const item of items) {
        await tx.update(products).set({ stock: sql`${products.stock} + ${item.quantity}` }).where(eq(products.id, item.productId));
        if (item.variantId) {
          await tx
            .update(productVariants)
            .set({ stockCount: sql`${productVariants.stockCount} + ${item.quantity}` })
            .where(eq(productVariants.id, item.variantId));
        }
      }

      await tx.insert(orderTimeline).values({
        orderId,
        status: 'CANCELLED',
        title: 'Order Cancelled',
        description: 'Customer requested cancellation before dispatch.',
        completed: true,
      });

      return this.getOrderByIdWithTx(tx, userId, orderId);
    });
  }

  /** Admin-only status transition, validated against the order state machine. */
  static async adminUpdateStatus(orderId: number, nextStatus: string) {
    return db.transaction(async (tx) => {
      const [order] = await tx.select({ id: orders.id, status: orders.status }).from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) throw new Error('Order not found');

      assertValidTransition(order.status, nextStatus);

      const updates: Partial<typeof orders.$inferInsert> = { status: nextStatus, updatedAt: new Date() };
      if (nextStatus === 'DELIVERED') updates.paymentStatus = 'PAID';

      await tx.update(orders).set(updates).where(eq(orders.id, orderId));

      const stageTitles: Record<string, string> = {
        PACKED: 'Packed',
        SHIPPED: 'Shipped',
        OUT_FOR_DELIVERY: 'Out for Delivery',
        DELIVERED: 'Delivered',
        RETURNED: 'Returned',
        CANCELLED: 'Cancelled',
      };

      await tx.insert(orderTimeline).values({
        orderId,
        status: nextStatus,
        title: stageTitles[nextStatus] || nextStatus,
        description: `Order status updated to ${nextStatus}.`,
        completed: true,
      });

      return true;
    });
  }
}
