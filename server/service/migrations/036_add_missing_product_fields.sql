-- Migration: Add missing warranty and sales fields to products table
-- Consolidation of missing fields found in 015_extend_products_installed_base.sql
-- Created: 2026-03-10

-- 1. IoT and Activation
ALTER TABLE products ADD COLUMN is_iot_device BOOLEAN DEFAULT 0;
ALTER TABLE products ADD COLUMN is_activated BOOLEAN DEFAULT 0;
ALTER TABLE products ADD COLUMN activation_date DATE;
ALTER TABLE products ADD COLUMN last_connected_at DATETIME;
ALTER TABLE products ADD COLUMN ip_address TEXT;

-- 2. Sales Trace
ALTER TABLE products ADD COLUMN sales_channel TEXT DEFAULT 'DIRECT';
ALTER TABLE products ADD COLUMN original_order_id TEXT;
ALTER TABLE products ADD COLUMN sold_to_dealer_id INTEGER REFERENCES accounts(id);
ALTER TABLE products ADD COLUMN ship_to_dealer_date DATE;

-- 3. Additional Ownership/Sales Fields
ALTER TABLE products ADD COLUMN registration_date DATE;
ALTER TABLE products ADD COLUMN sales_invoice_date DATE;
ALTER TABLE products ADD COLUMN sales_invoice_proof TEXT;

-- 4. Warranty Calculation Fields
ALTER TABLE products ADD COLUMN warranty_source TEXT DEFAULT 'DIRECT_SHIPMENT';
ALTER TABLE products ADD COLUMN warranty_start_date DATE;
ALTER TABLE products ADD COLUMN warranty_months INTEGER DEFAULT 24;
ALTER TABLE products ADD COLUMN warranty_end_date DATE;
ALTER TABLE products ADD COLUMN warranty_status TEXT DEFAULT 'ACTIVE';

-- 5. Physical/Product Type
ALTER TABLE products ADD COLUMN product_sku TEXT;
ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'CAMERA';

-- Refined Indexing
CREATE INDEX IF NOT EXISTS idx_products_ser_num ON products(serial_number);
CREATE INDEX IF NOT EXISTS idx_products_own_id ON products(current_owner_id);
CREATE INDEX IF NOT EXISTS idx_products_dealer_id ON products(sold_to_dealer_id);
CREATE INDEX IF NOT EXISTS idx_products_war_status ON products(warranty_status);
