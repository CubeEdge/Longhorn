-- Migration: Add status field to products table
-- Date: 2026-03-10
-- Description: Add IB (Installed Base) status field to support ACTIVE/IN_REPAIR/STOLEN/SCRAPPED states

-- Add status column with check constraint
ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'ACTIVE' 
CHECK(status IN ('ACTIVE', 'IN_REPAIR', 'STOLEN', 'SCRAPPED'));

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- Migrate existing data: set all existing products to ACTIVE
UPDATE products SET status = 'ACTIVE' WHERE status IS NULL;

-- Note: is_active field is being replaced by status field
-- ACTIVE = enabled/in-service, other states = various non-active states
