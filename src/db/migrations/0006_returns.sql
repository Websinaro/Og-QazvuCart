CREATE TABLE IF NOT EXISTS return_requests (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(40) NOT NULL,
  details TEXT,
  status VARCHAR(12) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','REJECTED')),
  admin_note TEXT,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS return_requests_order_idx ON return_requests(order_id);
-- One live (requested or approved) return per order.
CREATE UNIQUE INDEX IF NOT EXISTS return_requests_one_live_idx ON return_requests(order_id) WHERE status IN ('REQUESTED','APPROVED');
