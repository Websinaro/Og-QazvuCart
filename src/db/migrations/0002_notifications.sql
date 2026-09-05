-- 0002_notifications.sql
-- Additive only: no drops, no destructive changes to existing data.
--
-- Adds the in-app notification center (spec item 15), an admin broadcast
-- log so sends can be reviewed/audited, and device_tokens for Firebase
-- Cloud Messaging web push.

CREATE TABLE IF NOT EXISTS device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_token_idx ON device_tokens(token);
CREATE INDEX IF NOT EXISTS device_tokens_user_id_idx ON device_tokens(user_id);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id SERIAL PRIMARY KEY,
  sent_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  link VARCHAR(500),
  target VARCHAR(20) NOT NULL DEFAULT 'ALL'
    CHECK (target IN ('ALL', 'CUSTOMERS', 'SELLERS')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  push_delivered_count INTEGER NOT NULL DEFAULT 0,
  push_failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_notification_id INTEGER REFERENCES admin_notifications(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'ADMIN'
    CHECK (type IN ('ADMIN', 'ORDER', 'WISHLIST', 'SYSTEM')),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  link VARCHAR(500),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id, created_at DESC);
-- Fast "unread count for this user" lookups — the query the bell icon runs
-- on every page load, so a dedicated partial index is worth it.
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id) WHERE is_read = FALSE;
