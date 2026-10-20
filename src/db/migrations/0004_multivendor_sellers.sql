-- 0004_multivendor_sellers.sql
-- Multi-vendor marketplace: seller onboarding/approval, per-seller
-- fulfilment (sub-orders), commission snapshots, earnings, payouts and
-- settlement.  Runs inside the migration runner's transaction.
--
-- All money columns are whole rupees (INTEGER), consistent with the rest of
-- the schema.  Commission rates are stored in basis points (1% = 100 bps).

-- ---------------------------------------------------------------------
-- Platform settings (key/value).  Commission default, payout hold, etc.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value) VALUES
  ('default_commission_bps', '1000'),  -- 10%
  ('payout_hold_days', '7'),           -- return window before earnings are payable
  ('min_payout_amount', '500')         -- rupees
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- Categories: optional commission override (basis points).
-- ---------------------------------------------------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS commission_bps INTEGER
  CHECK (commission_bps IS NULL OR (commission_bps BETWEEN 0 AND 10000));

-- ---------------------------------------------------------------------
-- Sellers: approval workflow, profile, commission override, payout account.
-- ---------------------------------------------------------------------
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
-- Every seller that existed before the approval workflow was, by definition,
-- already live on the storefront, so grandfather them in as APPROVED.
UPDATE sellers SET status = 'APPROVED' WHERE status = 'PENDING' AND is_verified = TRUE;

ALTER TABLE sellers DROP CONSTRAINT IF EXISTS sellers_status_check;
ALTER TABLE sellers ADD CONSTRAINT sellers_status_check
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'));

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS support_email VARCHAR(255);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS support_phone VARCHAR(20);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_address TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS tax_id VARCHAR(30);

-- NULL = use category / platform default.
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS commission_bps INTEGER
  CHECK (commission_bps IS NULL OR (commission_bps BETWEEN 0 AND 10000));

-- Payout destination.  The account number is encrypted at the application
-- layer (AES-256-GCM, see src/lib/fieldCrypto.ts); only the last 4 digits are
-- kept in clear text for display.
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payout_account_holder VARCHAR(150);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payout_bank_name VARCHAR(150);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payout_ifsc VARCHAR(20);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payout_account_enc TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payout_account_last4 VARCHAR(4);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payout_upi_id VARCHAR(100);

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE sellers SET approved_at = created_at WHERE status = 'APPROVED' AND approved_at IS NULL;

-- New sellers are unverified until an admin approves them.
ALTER TABLE sellers ALTER COLUMN is_verified SET DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS sellers_status_idx ON sellers(status);

-- ---------------------------------------------------------------------
-- Payouts (a settlement batch paid to one seller).
-- Created before seller_orders because seller_orders references it.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_payouts (
  id SERIAL PRIMARY KEY,
  payout_number VARCHAR(30) NOT NULL UNIQUE,
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING', 'PAID', 'FAILED')),
  order_count INTEGER NOT NULL DEFAULT 0,
  gross_amount INTEGER NOT NULL DEFAULT 0,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  adjustments_amount INTEGER NOT NULL DEFAULT 0,   -- signed
  net_amount INTEGER NOT NULL DEFAULT 0,
  cutoff_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),     -- earnings eligible up to here
  destination_snapshot JSONB,                       -- masked payout account at creation time
  method VARCHAR(30),
  reference VARCHAR(120),
  notes TEXT,
  failure_reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seller_payouts_seller_idx ON seller_payouts(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS seller_payouts_status_idx ON seller_payouts(status);

-- ---------------------------------------------------------------------
-- Seller sub-orders: one row per (order, seller).  The customer still sees
-- ONE order; each seller fulfils and gets paid for only their own parcel.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_orders (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (
    status IN ('PENDING_PAYMENT', 'PROCESSING', 'CONFIRMED', 'PACKED', 'SHIPPED',
               'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED')
  ),
  subtotal INTEGER NOT NULL,                        -- sum of this seller's items
  commission_amount INTEGER NOT NULL DEFAULT 0,
  seller_earning INTEGER NOT NULL,                  -- subtotal - commission_amount
  carrier VARCHAR(100),
  tracking_number VARCHAR(100),
  -- UNSETTLED : not yet paid (may or may not be payable yet)
  -- IN_PAYOUT : claimed by a payout awaiting transfer
  -- PAID      : included in a PAID payout
  -- VOID      : cancelled / returned before being paid, nothing owed
  -- LEGACY    : pre-marketplace-accounting order, excluded from payouts
  settlement_status VARCHAR(20) NOT NULL DEFAULT 'UNSETTLED'
    CHECK (settlement_status IN ('UNSETTLED', 'IN_PAYOUT', 'PAID', 'VOID', 'LEGACY')),
  payout_id INTEGER REFERENCES seller_payouts(id) ON DELETE SET NULL,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT seller_orders_order_seller_uniq UNIQUE (order_id, seller_id)
);

CREATE INDEX IF NOT EXISTS seller_orders_seller_status_idx ON seller_orders(seller_id, status);
CREATE INDEX IF NOT EXISTS seller_orders_order_idx ON seller_orders(order_id);
CREATE INDEX IF NOT EXISTS seller_orders_settlement_idx ON seller_orders(seller_id, settlement_status);
CREATE INDEX IF NOT EXISTS seller_orders_payout_idx ON seller_orders(payout_id);

-- ---------------------------------------------------------------------
-- Adjustments: signed corrections applied to the next payout
-- (return clawbacks after a payout was already made, manual credits/debits).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_adjustments (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  seller_order_id INTEGER REFERENCES seller_orders(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('RETURN_CLAWBACK', 'MANUAL')),
  amount INTEGER NOT NULL CHECK (amount <> 0),      -- negative = deduct from seller
  reason TEXT NOT NULL,
  payout_id INTEGER REFERENCES seller_payouts(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seller_adjustments_seller_idx ON seller_adjustments(seller_id, payout_id);

-- ---------------------------------------------------------------------
-- Order items: seller attribution + commission snapshot taken at order time
-- (so later rate changes never rewrite history).
-- ---------------------------------------------------------------------
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seller_order_id INTEGER REFERENCES seller_orders(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_bps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seller_earning INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------
-- Backfill: give every pre-existing order its per-seller sub-order(s).
-- Historic orders were placed before commission accounting existed, so they
-- carry 0% commission and are marked LEGACY (never auto-paid out).  If your
-- business still owes sellers for any of them, credit it explicitly with a
-- MANUAL adjustment from the admin payouts screen.
-- ---------------------------------------------------------------------
INSERT INTO seller_orders
  (order_id, seller_id, status, subtotal, commission_amount, seller_earning,
   settlement_status, delivered_at, created_at, updated_at)
SELECT
  oi.order_id,
  p.seller_id,
  o.status,
  SUM(oi.total_price)::INTEGER,
  0,
  SUM(oi.total_price)::INTEGER,
  'LEGACY',
  CASE WHEN o.status = 'DELIVERED' THEN o.updated_at END,
  o.created_at,
  o.updated_at
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders o ON o.id = oi.order_id
GROUP BY oi.order_id, p.seller_id, o.status, o.created_at, o.updated_at
ON CONFLICT (order_id, seller_id) DO NOTHING;

UPDATE order_items oi
SET seller_id = p.seller_id,
    seller_order_id = so.id,
    seller_earning = oi.total_price
FROM products p, seller_orders so
WHERE p.id = oi.product_id
  AND so.order_id = oi.order_id
  AND so.seller_id = p.seller_id
  AND oi.seller_id IS NULL;

ALTER TABLE order_items ALTER COLUMN seller_id SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN seller_order_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS order_items_seller_idx ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS order_items_seller_order_idx ON order_items(seller_order_id);
