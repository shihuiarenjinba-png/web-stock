-- Record the exact legal version accepted before Stripe Checkout.
CREATE TABLE IF NOT EXISTS checkout_acceptances (
  stripe_checkout_session_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  legal_version TEXT NOT NULL,
  accepted_at INTEGER NOT NULL,
  livemode INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_checkout_acceptances_customer ON checkout_acceptances(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_checkout_acceptances_subscription ON checkout_acceptances(stripe_subscription_id);
