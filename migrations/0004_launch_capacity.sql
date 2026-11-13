-- DemandScope launch admission capacity.
-- Paid data processing remains browser-local; this table limits new LIVE subscriptions
-- and preserves 50% operational headroom from the verified 50-concurrent launch probe.
CREATE TABLE IF NOT EXISTS capacity_reservations (
  reservation_id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  product_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_capacity_product ON capacity_reservations(product_key,expires_at);
CREATE INDEX IF NOT EXISTS idx_capacity_member ON capacity_reservations(member_id,product_key);
