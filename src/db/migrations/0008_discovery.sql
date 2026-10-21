-- Typo-tolerant search (trigram similarity).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_brand_trgm_idx ON products USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS order_items_product_order_idx ON order_items(product_id, order_id);

-- Product Q&A moderation: existing questions stay visible; new ones start PENDING (set by the app).
ALTER TABLE questions ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'APPROVED';
CREATE INDEX IF NOT EXISTS questions_status_idx ON questions(status);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('ADMIN','ORDER','WISHLIST','SYSTEM','CART'));

-- Abandoned-cart reminders: remember when we last nudged this cart.
ALTER TABLE carts ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
