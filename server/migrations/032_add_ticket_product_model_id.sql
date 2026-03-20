-- Migration: Add product_model_id to tickets table
-- Purpose: Store the product model ID for accurate compatible parts lookup
-- Date: 2026-03-20

-- Add product_model_id column to tickets table
ALTER TABLE tickets ADD COLUMN product_model_id INTEGER;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tickets_product_model_id ON tickets(product_model_id);

-- Add foreign key constraint (SQLite supports this in table creation, 
-- but for ALTER TABLE we just add the column and rely on application logic)

-- Backfill existing tickets with product_model_id based on product_id
-- This joins through products -> product_skus -> product_models
UPDATE tickets 
SET product_model_id = (
    SELECT ps.model_id 
    FROM products p 
    JOIN product_skus ps ON p.sku_id = ps.id 
    WHERE p.id = tickets.product_id
)
WHERE product_id IS NOT NULL 
AND product_model_id IS NULL;

-- Verify the migration
SELECT 
    COUNT(*) as total_tickets,
    COUNT(product_model_id) as tickets_with_model_id,
    COUNT(*) - COUNT(product_model_id) as tickets_without_model_id
FROM tickets;
