-- One-time email magic links for cross-browser Pro recovery.
-- Raw tokens are never stored. Email is retained only until token expiry/cleanup.
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at TEXT,
  send_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_magic_link_email_created ON magic_link_tokens(email_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_magic_link_expiry ON magic_link_tokens(expires_at);
