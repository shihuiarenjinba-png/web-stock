-- Prevent one member from consuming multiple pending launch slots for the same product.
CREATE UNIQUE INDEX IF NOT EXISTS idx_capacity_member_product_unique
ON capacity_reservations(member_id,product_key);
