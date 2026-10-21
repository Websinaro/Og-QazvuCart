-- Admin security: distinct grantable permissions + an audit trail.
--
-- admin_permissions: the ADMIN role alone no longer authorises sensitive
-- actions. Nobody holds a permission until it is granted explicitly, e.g.:
--   INSERT INTO admin_permissions (user_id, permission, granted_by)
--   VALUES (<admin user id>, 'seller_payout_details:write', <granting admin id>);
CREATE TABLE IF NOT EXISTS admin_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(60) NOT NULL,
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_permissions_user_perm_uniq UNIQUE (user_id, permission)
);

-- admin_audit_log: who did what to which record, why, and from where.
-- Application code only ever INSERTs. Never put secrets (full account
-- numbers, passwords) in metadata.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(60) NOT NULL,
  target_type VARCHAR(30) NOT NULL,
  target_id INTEGER,
  reason TEXT,
  metadata JSONB,
  ip VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_admin_action_idx ON admin_audit_log(admin_user_id, action, created_at);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON admin_audit_log(target_type, target_id);
