-- Structured pickup address (Delhivery needs city/state/pin) + warehouse registration flag.
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS pickup_city VARCHAR(100);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS pickup_state VARCHAR(100);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS pickup_pincode VARCHAR(6);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS delhivery_warehouse VARCHAR(100);
