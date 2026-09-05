-- 0003_coupons.sql
-- Additive only: no drops, no destructive changes to existing data.

CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  description VARCHAR(255),
  type VARCHAR(10) NOT NULL CHECK (type IN ('PERCENT', 'FIXED')),
  value INTEGER NOT NULL CHECK (value > 0),
  min_order_value INTEGER NOT NULL DEFAULT 0,
  max_discount_amount INTEGER,
  usage_limit INTEGER,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_user_idx ON coupon_redemptions(coupon_id, user_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(30);
