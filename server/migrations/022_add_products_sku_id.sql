-- Migration: Add sku_id and related columns to products table
-- Date: 2026-03-13
-- Description: Add missing columns for product SKU linkage

-- Add sku_id column for linking to product_skus table
ALTER TABLE products ADD COLUMN sku_id INTEGER REFERENCES product_skus(id);

-- Create index for SKU lookups
CREATE INDEX IF NOT EXISTS idx_products_sku_id ON products(sku_id);
