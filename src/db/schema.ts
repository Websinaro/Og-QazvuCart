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
  // Commission override for this category in basis points (1% = 100). NULL =
  // fall back to the platform default. A seller-level override beats this.
  commissionBps: integer('commission_bps'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const SELLER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type SellerStatus = (typeof SELLER_STATUSES)[number];

export const sellers = pgTable('sellers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  storeName: varchar('store_name', { length: 150 }).notNull(),
  slug: varchar('slug', { length: 150 }).notNull().unique(),
  rating: numeric('rating', { precision: 3, scale: 2 }).default('4.8').notNull(),
  reviewCount: integer('review_count').default(0).notNull(),
  // Mirrors `status === 'APPROVED'`; kept for the public storefront badge.
  isVerified: boolean('is_verified').default(false).notNull(),
  // Approval workflow. Only APPROVED sellers appear on the storefront.
  status: varchar('status', { length: 20 }).default('PENDING').notNull(),
  description: text('description'),
  supportEmail: varchar('support_email', { length: 255 }),
  supportPhone: varchar('support_phone', { length: 20 }),
  businessAddress: text('business_address'),
  pickupCity: varchar('pickup_city', { length: 100 }),
  pickupState: varchar('pickup_state', { length: 100 }),
  pickupPincode: varchar('pickup_pincode', { length: 6 }),
  // Name of the pickup location registered with Delhivery (set on first shipment).
  delhiveryWarehouse: varchar('delhivery_warehouse', { length: 100 }),
  taxId: varchar('tax_id', { length: 30 }),
  // Per-seller commission override in basis points. NULL = category/platform default.
  commissionBps: integer('commission_bps'),
  // Payout destination (account number is AES-GCM encrypted at app level).
  payoutAccountHolder: varchar('payout_account_holder', { length: 150 }),
  payoutBankName: varchar('payout_bank_name', { length: 150 }),
  payoutIfsc: varchar('payout_ifsc', { length: 20 }),
  payoutAccountEnc: text('payout_account_enc'),
  payoutAccountLast4: varchar('payout_account_last4', { length: 4 }),
  payoutUpiId: varchar('payout_upi_id', { length: 100 }),
  rejectionReason: text('rejection_reason'),
  suspensionReason: text('suspension_reason'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: integer('approved_by').references(() => users.id, { onDelete: 'set null' }),
  statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('sellers_status_idx').on(table.status),
}));

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
  reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
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
  // Set only when a coupon was actually applied — `discount` above holds
  // the resulting amount either way, but this is what makes the discount
  // traceable to a specific code for support/audit purposes.
  couponCode: varchar('coupon_code', { length: 30 }),
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
  // Seller attribution + commission snapshot taken when the order was placed.
  sellerId: integer('seller_id').notNull().references(() => sellers.id),
  sellerOrderId: integer('seller_order_id').notNull().references(() => sellerOrders.id, { onDelete: 'cascade' }),
  commissionBps: integer('commission_bps').default(0).notNull(),
  commissionAmount: integer('commission_amount').default(0).notNull(),
  sellerEarning: integer('seller_earning').default(0).notNull(),
}, (table) => ({
  orderIdx: index('order_items_order_id_idx').on(table.orderId),
  sellerIdx: index('order_items_seller_idx').on(table.sellerId),
  sellerOrderIdx: index('order_items_seller_order_idx').on(table.sellerOrderId),
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
// MULTI-VENDOR: SUB-ORDERS, PAYOUTS, ADJUSTMENTS, PLATFORM SETTINGS
// =========================================================================

export const SETTLEMENT_STATUSES = ['UNSETTLED', 'IN_PAYOUT', 'PAID', 'VOID', 'LEGACY'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const PAYOUT_STATUSES = ['PROCESSING', 'PAID', 'FAILED'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const platformSettings = pgTable('platform_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sellerPayouts = pgTable('seller_payouts', {
  id: serial('id').primaryKey(),
  payoutNumber: varchar('payout_number', { length: 30 }).notNull().unique(),
  sellerId: integer('seller_id').notNull().references(() => sellers.id),
  status: varchar('status', { length: 20 }).default('PROCESSING').notNull(),
  orderCount: integer('order_count').default(0).notNull(),
  grossAmount: integer('gross_amount').default(0).notNull(),
  commissionAmount: integer('commission_amount').default(0).notNull(),
  adjustmentsAmount: integer('adjustments_amount').default(0).notNull(),
  netAmount: integer('net_amount').default(0).notNull(),
  cutoffAt: timestamp('cutoff_at', { withTimezone: true }).defaultNow().notNull(),
  destinationSnapshot: jsonb('destination_snapshot'),
  method: varchar('method', { length: 30 }),
  reference: varchar('reference', { length: 120 }),
  notes: text('notes'),
  failureReason: text('failure_reason'),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sellerIdx: index('seller_payouts_seller_idx').on(table.sellerId, table.createdAt),
  statusIdx: index('seller_payouts_status_idx').on(table.status),
}));

// One row per (order, seller): the unit a seller fulfils and is paid for.
export const sellerOrders = pgTable('seller_orders', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  sellerId: integer('seller_id').notNull().references(() => sellers.id),
  status: varchar('status', { length: 30 }).default('PENDING_PAYMENT').notNull(),
  subtotal: integer('subtotal').notNull(),
  commissionAmount: integer('commission_amount').default(0).notNull(),
  sellerEarning: integer('seller_earning').notNull(),
  carrier: varchar('carrier', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  settlementStatus: varchar('settlement_status', { length: 20 }).default('UNSETTLED').notNull(),
  payoutId: integer('payout_id').references(() => sellerPayouts.id, { onDelete: 'set null' }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  returnedAt: timestamp('returned_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderSellerUniq: uniqueIndex('seller_orders_order_seller_uniq').on(table.orderId, table.sellerId),
  sellerStatusIdx: index('seller_orders_seller_status_idx').on(table.sellerId, table.status),
  orderIdx: index('seller_orders_order_idx').on(table.orderId),
  settlementIdx: index('seller_orders_settlement_idx').on(table.sellerId, table.settlementStatus),
  payoutIdx: index('seller_orders_payout_idx').on(table.payoutId),
}));

export const sellerAdjustments = pgTable('seller_adjustments', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id').notNull().references(() => sellers.id),
  sellerOrderId: integer('seller_order_id').references(() => sellerOrders.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 20 }).notNull(),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  payoutId: integer('payout_id').references(() => sellerPayouts.id, { onDelete: 'set null' }),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sellerIdx: index('seller_adjustments_seller_idx').on(table.sellerId, table.payoutId),
}));

// =========================================================================
// PAYMENTS
// =========================================================================

export const PAYMENT_STATUSES = ['CREATED', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'MISMATCH', 'REFUNDED'] as const;
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
  attemptNo: integer('attempt_no').default(1).notNull(),
  // Paise the gateway actually captured (may differ from `amount` on a mismatch).
  capturedAmount: integer('captured_amount').default(0).notNull(),
  // Sum of PENDING + PROCESSED refunds, in paise.
  refundedAmount: integer('refunded_amount').default(0).notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderAttemptIdx: uniqueIndex('payments_order_attempt_idx').on(table.orderId, table.attemptNo),
  orderIdx: index('payments_order_id_idx').on(table.orderId),
  userIdx: index('payments_user_id_idx').on(table.userId),
  providerOrderIdx: uniqueIndex('payments_provider_order_id_idx').on(table.providerOrderId),
  providerPaymentIdx: uniqueIndex('payments_provider_payment_id_idx').on(table.providerPaymentId),
  idempotencyIdx: uniqueIndex('payments_idempotency_key_idx').on(table.idempotencyKey),
}));

export const paymentEvents = pgTable('payment_events', {
  id: serial('id').primaryKey(),
  eventId: varchar('event_id', { length: 128 }).notNull(),
  eventType: varchar('event_type', { length: 60 }).notNull(),
  payloadSha256: varchar('payload_sha256', { length: 64 }).notNull(),
  status: varchar('status', { length: 12 }).default('PROCESSING').notNull(),
  attempts: integer('attempts').default(1).notNull(),
  outcome: varchar('outcome', { length: 60 }),
  error: text('error'),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  lockedAt: timestamp('locked_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (table) => ({
  eventIdIdx: uniqueIndex('payment_events_event_id_idx').on(table.eventId),
}));

export const REFUND_STATUSES = ['PENDING', 'PROCESSED', 'FAILED'] as const;
export const REFUND_REASONS = ['ORDER_CANCELLED', 'ORDER_RETURNED', 'LATE_PAYMENT', 'DUPLICATE_PAYMENT', 'AMOUNT_MISMATCH', 'ADMIN', 'GATEWAY'] as const;

export const refunds = pgTable('refunds', {
  id: serial('id').primaryKey(),
  paymentId: integer('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  providerPaymentId: varchar('provider_payment_id', { length: 100 }),
  providerRefundId: varchar('provider_refund_id', { length: 100 }),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 10 }).default('INR').notNull(),
  status: varchar('status', { length: 12 }).default('PENDING').notNull(),
  reason: varchar('reason', { length: 30 }).notNull(),
  note: text('note'),
  source: varchar('source', { length: 10 }).default('SYSTEM').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 120 }).notNull(),
  attempts: integer('attempts').default(0).notNull(),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  failureReason: text('failure_reason'),
  initiatedBy: integer('initiated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (table) => ({
  idempotencyIdx: uniqueIndex('refunds_idempotency_key_idx').on(table.idempotencyKey),
  providerRefundIdx: uniqueIndex('refunds_provider_refund_id_idx').on(table.providerRefundId),
  paymentIdx: index('refunds_payment_id_idx').on(table.paymentId),
  orderIdx: index('refunds_order_id_idx').on(table.orderId),
}));

export const paymentReconciliationRuns = pgTable('payment_reconciliation_runs', {
  id: serial('id').primaryKey(),
  trigger: varchar('trigger', { length: 10 }).default('MANUAL').notNull(),
  heal: boolean('heal').default(true).notNull(),
  windowFrom: timestamp('window_from', { withTimezone: true }).notNull(),
  windowTo: timestamp('window_to', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 12 }).default('RUNNING').notNull(),
  gatewayPaymentsChecked: integer('gateway_payments_checked').default(0).notNull(),
  gatewayRefundsChecked: integer('gateway_refunds_checked').default(0).notNull(),
  localPaymentsChecked: integer('local_payments_checked').default(0).notNull(),
  matched: integer('matched').default(0).notNull(),
  autoHealed: integer('auto_healed').default(0).notNull(),
  needsReview: integer('needs_review').default(0).notNull(),
  error: text('error'),
  triggeredBy: integer('triggered_by').references(() => users.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export const paymentReconciliationItems = pgTable('payment_reconciliation_items', {
  id: serial('id').primaryKey(),
  runId: integer('run_id').notNull().references(() => paymentReconciliationRuns.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 50 }).notNull(),
  resolution: varchar('resolution', { length: 12 }).notNull(),
  paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  providerOrderId: varchar('provider_order_id', { length: 100 }),
  providerPaymentId: varchar('provider_payment_id', { length: 100 }),
  providerRefundId: varchar('provider_refund_id', { length: 100 }),
  localStatus: varchar('local_status', { length: 20 }),
  remoteStatus: varchar('remote_status', { length: 20 }),
  localAmount: integer('local_amount'),
  remoteAmount: integer('remote_amount'),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  runIdx: index('payment_recon_items_run_idx').on(table.runId),
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
  // PENDING until an admin approves; only APPROVED questions are public.
  status: varchar('status', { length: 10 }).default('APPROVED').notNull(),
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
// COUPONS
// =========================================================================

export const COUPON_TYPES = ['PERCENT', 'FIXED'] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  type: varchar('type', { length: 10 }).notNull(),
  // PERCENT: 1-100. FIXED: a rupee amount, same integer unit as
  // products.basePrice elsewhere in this schema.
  value: integer('value').notNull(),
  minOrderValue: integer('min_order_value').default(0).notNull(),
  // Caps how much a PERCENT coupon can discount in absolute rupees, so
  // "20% off" can't turn into an unbounded discount on a huge cart.
  // Ignored for FIXED coupons.
  maxDiscountAmount: integer('max_discount_amount'),
  // Total redemptions allowed across ALL users. Null = unlimited.
  usageLimit: integer('usage_limit'),
  // Redemptions allowed per individual user. Defaults to 1 (classic
  // "one use per customer" promo code behavior).
  perUserLimit: integer('per_user_limit').default(1).notNull(),
  usedCount: integer('used_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// One row per successful redemption — this is what makes usage_limit and
// per_user_limit enforceable without a race condition: both checks and
// the increment happen inside the same order-creation transaction (see
// CouponService.redeem), and this table is the audit trail for it.
export const couponRedemptions = pgTable('coupon_redemptions', {
  id: serial('id').primaryKey(),
  couponId: integer('coupon_id').notNull().references(() => coupons.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  discountAmount: integer('discount_amount').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  couponUserIdx: index('coupon_redemptions_coupon_user_idx').on(table.couponId, table.userId),
}));

// =========================================================================
// NOTIFICATIONS (in-app center + admin broadcast + web push via Firebase)
// =========================================================================

export const NOTIFICATION_TARGETS = ['ALL', 'CUSTOMERS', 'SELLERS'] as const;
export type NotificationTarget = (typeof NOTIFICATION_TARGETS)[number];

export const NOTIFICATION_TYPES = ['ADMIN', 'ORDER', 'WISHLIST', 'SYSTEM'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// One row per browser/device a user has granted push permission on. A user
// can have several (phone, laptop, etc) — all get the push. Token is the
// opaque FCM registration token from the client SDK.
export const deviceTokens = pgTable('device_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  platform: varchar('platform', { length: 20 }).default('web').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('device_tokens_user_id_idx').on(table.userId),
}));

// One row per admin broadcast "send" action — the history the admin panel
// lists, independent of how many individual users ended up receiving it.
export const adminNotifications = pgTable('admin_notifications', {
  id: serial('id').primaryKey(),
  sentBy: integer('sent_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  link: varchar('link', { length: 500 }),
  target: varchar('target', { length: 20 }).default('ALL').notNull(),
  recipientCount: integer('recipient_count').default(0).notNull(),
  pushDeliveredCount: integer('push_delivered_count').default(0).notNull(),
  pushFailedCount: integer('push_failed_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// One row per (user, notification) — powers the in-app notification bell.
// `type` distinguishes admin broadcasts from notifications the system
// generates itself (order updates, wishlist price drops, etc) so the same
// table/UI can serve both without a second schema.
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  adminNotificationId: integer('admin_notification_id').references(() => adminNotifications.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 30 }).default('ADMIN').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  link: varchar('link', { length: 500 }),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('notifications_user_id_idx').on(table.userId, table.createdAt),
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

export const sellersRelations = relations(sellers, ({ one, many }) => ({
  user: one(users, { fields: [sellers.userId], references: [users.id] }),
  products: many(products),
  sellerOrders: many(sellerOrders),
  payouts: many(sellerPayouts),
}));

export const sellerOrdersRelations = relations(sellerOrders, ({ one, many }) => ({
  order: one(orders, { fields: [sellerOrders.orderId], references: [orders.id] }),
  seller: one(sellers, { fields: [sellerOrders.sellerId], references: [sellers.id] }),
  items: many(orderItems),
}));

// =========================================================================
// RETURN REQUESTS (customer asks per seller parcel, admin approves -> that parcel's items are refunded)
// =========================================================================
export const returnRequests = pgTable('return_requests', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  // The seller parcel this request is about. NULL only on legacy whole-order requests.
  sellerOrderId: integer('seller_order_id').references(() => sellerOrders.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: varchar('reason', { length: 40 }).notNull(),
  details: text('details'),
  status: varchar('status', { length: 12 }).default('REQUESTED').notNull(),
  adminNote: text('admin_note'),
  resolvedBy: integer('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => ({
  orderIdx: index('return_requests_order_idx').on(table.orderId),
  sellerOrderIdx: index('return_requests_seller_order_idx').on(table.sellerOrderId),
}));

// The order lines (and quantities) a return request covers, with the money
// snapshotted when the request was made so approval never re-prices anything.
export const returnItems = pgTable('return_items', {
  id: serial('id').primaryKey(),
  returnRequestId: integer('return_request_id').notNull().references(() => returnRequests.id, { onDelete: 'cascade' }),
  orderItemId: integer('order_item_id').notNull().references(() => orderItems.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
  lineAmount: integer('line_amount').notNull(),
  refundAmount: integer('refund_amount').notNull(),
  commissionAmount: integer('commission_amount').default(0).notNull(),
  sellerEarning: integer('seller_earning').default(0).notNull(),
}, (table) => ({
  requestItemUniq: uniqueIndex('return_items_request_item_uniq').on(table.returnRequestId, table.orderItemId),
  orderItemIdx: index('return_items_order_item_idx').on(table.orderItemId),
}));
