-- Link authenticated members to Stripe checkout/subscriptions.
ALTER TABLE checkout_acceptances ADD COLUMN member_id TEXT REFERENCES members(id);
CREATE INDEX IF NOT EXISTS idx_checkout_acceptances_member ON checkout_acceptances(member_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_acceptance_unique ON legal_acceptances(member_id,document_type,document_version);
