-- 0005_payment_hardening.sql
-- Idempotent webhook processing, refunds, reconciliation, payment retries.
-- Additive: existing rows are backfilled, nothing is dropped except the
-- (re-created) payments status CHECK.

-- ---------------------------------------------------------------------
-- payments: attempt numbering, captured/refunded bookkeeping, MISMATCH
-- ---------------------------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS attempt_no INTEGER NOT NULL DEFAULT 1;
UPDATE payments p
   SET attempt_no = s.rn
  FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY id) AS rn FROM payments) s
 WHERE p.id = s.id;
-- One row per (order, attempt number). Two concurrent "start a payment"
-- requests race on this index; the loser is told to retry instead of
-- creating a second Razorpay order.
CREATE UNIQUE INDEX IF NOT EXISTS payments_order_attempt_idx ON payments(order_id, attempt_no);

-- What the gateway actually captured (paise). Differs from `amount` (what we
-- asked for) only in the AMOUNT_MISMATCH case. Refund capacity is based on it.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS captured_amount INTEGER NOT NULL DEFAULT 0;
UPDATE payments SET captured_amount = amount WHERE status IN ('PAID', 'REFUNDED') AND captured_amount = 0;
-- Sum of PENDING + PROCESSED refunds (paise): refund money already "spoken for".
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('CREATED', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'MISMATCH', 'REFUNDED'));
-- Last line of defence against over-refunding, whatever the application does.
ALTER TABLE payments ADD CONSTRAINT payments_refund_bounds_check
  CHECK (refunded_amount >= 0 AND refunded_amount <= captured_amount);

-- ---------------------------------------------------------------------
-- payment_events: webhook delivery ledger (idempotency)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(128) NOT NULL,           -- X-Razorpay-Event-Id (or sha256 of the body)
  event_type VARCHAR(60) NOT NULL,
  payload_sha256 CHAR(64) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING', 'PROCESSED', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 1,
  outcome VARCHAR(60),
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_event_id_idx ON payment_events(event_id);
CREATE INDEX IF NOT EXISTS payment_events_status_idx ON payment_events(status) WHERE status <> 'PROCESSED';

-- ---------------------------------------------------------------------
-- refunds
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_payment_id VARCHAR(100),
  provider_refund_id VARCHAR(100),
  amount INTEGER NOT NULL CHECK (amount > 0),   -- paise
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
  reason VARCHAR(30) NOT NULL
    CHECK (reason IN ('ORDER_CANCELLED', 'ORDER_RETURNED', 'LATE_PAYMENT', 'DUPLICATE_PAYMENT', 'AMOUNT_MISMATCH', 'ADMIN', 'GATEWAY')),
  note TEXT,
  source VARCHAR(10) NOT NULL DEFAULT 'SYSTEM'
    CHECK (source IN ('SYSTEM', 'ADMIN', 'GATEWAY')),
  idempotency_key VARCHAR(120) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  failure_reason TEXT,
  initiated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS refunds_idempotency_key_idx ON refunds(idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS refunds_provider_refund_id_idx ON refunds(provider_refund_id) WHERE provider_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS refunds_payment_id_idx ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS refunds_order_id_idx ON refunds(order_id);
CREATE INDEX IF NOT EXISTS refunds_pending_idx ON refunds(created_at) WHERE status = 'PENDING';

-- ---------------------------------------------------------------------
-- reconciliation
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_reconciliation_runs (
  id SERIAL PRIMARY KEY,
  trigger VARCHAR(10) NOT NULL DEFAULT 'MANUAL' CHECK (trigger IN ('MANUAL', 'SCHEDULED')),
  heal BOOLEAN NOT NULL DEFAULT TRUE,
  window_from TIMESTAMPTZ NOT NULL,
  window_to TIMESTAMPTZ NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  gateway_payments_checked INTEGER NOT NULL DEFAULT 0,
  gateway_refunds_checked INTEGER NOT NULL DEFAULT 0,
  local_payments_checked INTEGER NOT NULL DEFAULT 0,
  matched INTEGER NOT NULL DEFAULT 0,
  auto_healed INTEGER NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  triggered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payment_reconciliation_items (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES payment_reconciliation_runs(id) ON DELETE CASCADE,
  kind VARCHAR(50) NOT NULL,
  resolution VARCHAR(12) NOT NULL CHECK (resolution IN ('AUTO_HEALED', 'NEEDS_REVIEW', 'INFO')),
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  provider_order_id VARCHAR(100),
  provider_payment_id VARCHAR(100),
  provider_refund_id VARCHAR(100),
  local_status VARCHAR(20),
  remote_status VARCHAR(20),
  local_amount INTEGER,
  remote_amount INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payment_recon_items_run_idx ON payment_reconciliation_items(run_id);
CREATE INDEX IF NOT EXISTS payment_recon_items_review_idx ON payment_reconciliation_items(resolution) WHERE resolution = 'NEEDS_REVIEW';
