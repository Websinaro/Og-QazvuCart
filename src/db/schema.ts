import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =========================================================================
// USERS & AUTH
// =========================================================================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).default('CUSTOMER').notNull(),
  isVerified: boolean('is_verified').default(true).notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Server-side refresh session store. Enables logout / revoke-all-on-password-change
// and lets us issue short-lived access tokens backed by a long-lived, revocable session.
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 64 }),
}, (table) => ({
  userIdx: index('sessions_user_id_idx').on(table.userId),
}));

export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 100 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  houseBuilding: varchar('house_building', { length: 255 }).notNull(),
  streetArea: varchar('street_area', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  country: varchar('country', { length: 100 }).default('India').notNull(),
  type: varchar('type', { length: 10 }).default('HOME').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('addresses_user_id_idx').on(table.userId),
}));

// =========================================================================
// CATALOG
// =========================================================================

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  icon: varchar('icon', { length: 50 }).notNull(),
  imageUrl: text('image_url').notNull(),
  description: text('description'),
  displayOrder: integer('display_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sellers = pgTable('sellers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  storeName: varchar('store_name', { length: 150 }).notNull(),
  slug: varchar('slug', { length: 150 }).notNull().unique(),
  rating: numeric('rating', { precision: 3, scale: 2 }).default('4.8').notNull(),
  reviewCount: integer('review_count').default(0).notNull(),
  isVerified: boolean('is_verified').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull().references(() => categories.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description').notNull(),
  basePrice: integer('base_price').notNull(),
  discountPrice: integer('discount_price').notNull(),
  stock: integer('stock').default(50).notNull(),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  brand: varchar('brand', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }),
  warranty: varchar('warranty', { length: 100 }).default('1 Year Manufacturer Warranty'),
  weight: varchar('weight', { length: 50 }),
  deliveryFee: integer('delivery_fee').default(40).notNull(),
  estimatedDays: integer('estimated_days').default(3).notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  isDeal: boolean('is_deal').default(false).notNull(),
  rating: numeric('rating', { precision: 3, scale: 2 }).default('0').notNull(),
  reviewCount: integer('review_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index('products_category_id_idx').on(table.categoryId),
  sellerIdx: index('products_seller_id_idx').on(table.sellerId),
  statusIdx: index('products_status_idx').on(table.status),
}));

export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  altText: text('alt_text'),
  displayOrder: integer('display_order').default(0).notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
}, (table) => ({
  productIdx: index('product_images_product_id_idx').on(table.productId),
}));

export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantName: varchar('variant_name', { length: 150 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  priceAdjustment: integer('price_adjustment').default(0).notNull(),
  stockCount: integer('stock_count').default(20).notNull(),
  attributesJson: jsonb('attributes_json').default({}),
}, (table) => ({
  productIdx: index('product_variants_product_id_idx').on(table.productId),
}));

export const productSpecifications = pgTable('product_specifications', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  specKey: varchar('spec_key', { length: 150 }).notNull(),
  specValue: text('spec_value').notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
}, (table) => ({
  productIdx: index('product_specifications_product_id_idx').on(table.productId),
}));

// =========================================================================
// CART & WISHLIST
// =========================================================================

export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  cartId: integer('cart_id').notNull().references(() => carts.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  quantity: integer('quantity').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  cartIdx: index('cart_items_cart_id_idx').on(table.cartId),
  // NOTE: a NULL variant_id makes this unique index a no-op for those rows
  // (Postgres treats NULLs as distinct); application logic additionally
  // guards against duplicate no-variant rows in the same cart.
  uniqueItem: uniqueIndex('cart_items_cart_product_variant_idx').on(table.cartId, table.productId, table.variantId),
}));

export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueItem: uniqueIndex('wishlists_user_product_idx').on(table.userId, table.productId),
}));

// =========================================================================
// ORDERS
// =========================================================================

// Enum-like constant kept in sync with the CHECK constraint added in the
// migration SQL. Using varchar + CHECK (rather than a native Postgres ENUM)
// keeps future additions to the list a simple migration instead of a type
// alteration, while still rejecting invalid values at the database layer.
export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PROCESSING',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 30 }).default('PENDING_PAYMENT').notNull(),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').default(0).notNull(),
  deliveryFee: integer('delivery_fee').default(40).notNull(),
  total: integer('total').notNull(),
  shippingAddressSnapshot: jsonb('shipping_address_snapshot').notNull(),
  paymentMethod: varchar('payment_method', { length: 20 }).default('CARD').notNull(),
  paymentStatus: varchar('payment_status', { length: 20 }).default('CREATED').notNull(),
  estimatedDeliveryDate: varchar('estimated_delivery_date', { length: 100 }).notNull(),
  paymentReservationExpiresAt: timestamp('payment_reservation_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('orders_user_id_idx').on(table.userId),
  statusIdx: index('orders_status_idx').on(table.status),
}));

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id),
  variantId: integer('variant_id'),
  productName: varchar('product_name', { length: 255 }).notNull(),
  productImage: text('product_image').notNull(),
  variantName: varchar('variant_name', { length: 150 }),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  totalPrice: integer('total_price').notNull(),
}, (table) => ({
  orderIdx: index('order_items_order_id_idx').on(table.orderId),
}));

export const orderTimeline = pgTable('order_timeline', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 30 }).notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  description: text('description'),
  completed: boolean('completed').default(true).notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderIdx: index('order_timeline_order_id_idx').on(table.orderId),
}));

// =========================================================================
// PAYMENTS
// =========================================================================

export const PAYMENT_STATUSES = ['CREATED', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 20 }).default('RAZORPAY').notNull(),
  providerOrderId: varchar('provider_order_id', { length: 100 }),
  providerPaymentId: varchar('provider_payment_id', { length: 100 }),
  providerSignature: varchar('provider_signature', { length: 255 }),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 10 }).default('INR').notNull(),
  status: varchar('status', { length: 20 }).default('CREATED').notNull(),
  method: varchar('method', { length: 20 }),
  failureCode: varchar('failure_code', { length: 50 }),
  failureReason: text('failure_reason'),
  idempotencyKey: varchar('idempotency_key', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderIdx: index('payments_order_id_idx').on(table.orderId),
  userIdx: index('payments_user_id_idx').on(table.userId),
  providerOrderIdx: uniqueIndex('payments_provider_order_id_idx').on(table.providerOrderId),
  providerPaymentIdx: uniqueIndex('payments_provider_payment_id_idx').on(table.providerPaymentId),
  idempotencyIdx: uniqueIndex('payments_idempotency_key_idx').on(table.idempotencyKey),
}));

// =========================================================================
// REVIEWS & Q&A
// =========================================================================

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  rating: integer('rating').notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  comment: text('comment').notNull(),
  isVerifiedPurchase: boolean('is_verified_purchase').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // One review per customer per product (business rule from spec item 12),
  // regardless of which eligible order it is attached to.
  uniqueReview: uniqueIndex('reviews_product_user_idx').on(table.productId, table.userId),
}));

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionText: text('question_text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  productIdx: index('questions_product_id_idx').on(table.productId),
}));

export const answers = pgTable('answers', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  answerText: text('answer_text').notNull(),
  isSellerAnswer: boolean('is_seller_answer').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  questionIdx: index('answers_question_id_idx').on(table.questionId),
}));

// =========================================================================
// RELATIONS (used for Drizzle's relational query API where convenient)
// =========================================================================

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  sessions: many(sessions),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  seller: one(sellers, { fields: [products.sellerId], references: [sellers.id] }),
  images: many(productImages),
  variants: many(productVariants),
  specifications: many(productSpecifications),
  reviews: many(reviews),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  timeline: many(orderTimeline),
}));
