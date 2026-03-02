-- Migration: Extend products table to match PRD Installed Base specification
-- Created: 2026-03-01
-- PRD Reference: Service PRD_P2.md lines 209-265

-- ==========================================
-- 1. 物理身份扩展 (Physical Identity)
-- ==========================================
ALTER TABLE products ADD COLUMN product_sku TEXT;
ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'CAMERA';

-- ==========================================
-- 2. 联网状态 (IoT Status)
-- ==========================================
ALTER TABLE products ADD COLUMN is_iot_device BOOLEAN DEFAULT 0;
ALTER TABLE products ADD COLUMN is_activated BOOLEAN DEFAULT 0;
ALTER TABLE products ADD COLUMN activation_date DATE;
ALTER TABLE products ADD COLUMN last_connected_at DATETIME;
ALTER TABLE products ADD COLUMN ip_address TEXT;

-- ==========================================
-- 3. 销售溯源 (Sales Trace)
-- ==========================================
ALTER TABLE products ADD COLUMN sales_channel TEXT DEFAULT 'DIRECT';
ALTER TABLE products ADD COLUMN original_order_id TEXT;
ALTER TABLE products ADD COLUMN sold_to_dealer_id INTEGER REFERENCES accounts(id);
ALTER TABLE products ADD COLUMN ship_to_dealer_date DATE;

-- ==========================================
-- 4. 终端归属 (Ownership)
-- ==========================================
ALTER TABLE products ADD COLUMN current_owner_id INTEGER REFERENCES accounts(id);
ALTER TABLE products ADD COLUMN registration_date DATE;
ALTER TABLE products ADD COLUMN sales_invoice_date DATE;
ALTER TABLE products ADD COLUMN sales_invoice_proof TEXT;

-- ==========================================
-- 5. 保修计算结果 (Warranty)
-- ==========================================
ALTER TABLE products ADD COLUMN warranty_source TEXT DEFAULT 'DIRECT_SHIPMENT';
-- Enum: IOT_ACTIVATION, INVOICE_PROOF, DIRECT_SHIPMENT, DEALER_FALLBACK
ALTER TABLE products ADD COLUMN warranty_start_date DATE;
ALTER TABLE products ADD COLUMN warranty_months INTEGER DEFAULT 24;
ALTER TABLE products ADD COLUMN warranty_end_date DATE;
ALTER TABLE products ADD COLUMN warranty_status TEXT DEFAULT 'ACTIVE';
-- Enum: ACTIVE, EXPIRED, PENDING

-- ==========================================
-- 6. 创建索引优化查询
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_products_serial_number ON products(serial_number);
CREATE INDEX IF NOT EXISTS idx_products_current_owner ON products(current_owner_id);
CREATE INDEX IF NOT EXISTS idx_products_sold_to_dealer ON products(sold_to_dealer_id);
CREATE INDEX IF NOT EXISTS idx_products_warranty_status ON products(warranty_status);
