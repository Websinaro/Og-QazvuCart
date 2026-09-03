-- 0001_payments_and_address_type.sql
-- Additive only: no drops, no destructive changes to existing data.

-- ---------------------------------------------------------------------
-- Address: add the canonical `type` field (spec item 5).
-- ---------------------------------------------------------------------
ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'HOME'
    CHECK (type IN ('HOME', 'WORK', 'OTHER'));

-- ---------------------------------------------------------------------
-- Categories: admin management fields (spec item 31).
-- ---------------------------------------------------------------------
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- One row per payment *attempt* against an order. An order can have more
-- than one row if a payment attempt fails and the customer retries.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL DEFAULT 'RAZORPAY',
  provider_order_id VARCHAR(100),
  provider_payment_id VARCHAR(100),
  provider_signature VARCHAR(255),
  amount INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')),
  method VARCHAR(20),
  failure_code VARCHAR(50),
  failure_reason TEXT,
  idempotency_key VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments(order_id);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);

-- A given Razorpay order/payment id must map to exactly one row here so a
-- replayed webhook can never create a duplicate payment record.
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_order_id_idx
  ON payments(provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_id_idx
  ON payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_idx
  ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------
-- Orders: introduce an explicit PENDING_PAYMENT status so an order can
-- exist before payment is confirmed (required for the Razorpay flow:
-- create internal order -> create Razorpay order -> customer pays ->
-- webhook/verification flips the order to CONFIRMED). Previous flow
-- created orders as already-CONFIRMED/PAID, which is what let the
-- frontend "fake" a successful payment.
-- ---------------------------------------------------------------------
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'PENDING_PAYMENT', 'PROCESSING', 'CONFIRMED', 'PACKED', 'SHIPPED',
    'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED'
  ));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('CREATED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'));

-- Stock is reserved at order-creation time in this codebase's existing
-- checkout flow (see OrderService.createOrder), so reservation needs an
-- expiry for the PENDING_PAYMENT window: if payment never completes, the
-- reservation must be releasable. Nullable — only set for
-- PENDING_PAYMENT orders awaiting a gateway.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reservation_expires_at TIMESTAMPTZ;
