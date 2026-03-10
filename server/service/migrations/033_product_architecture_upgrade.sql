-- Migration: Upgrade Product Architecture to Three-Layer Model (Model -> SKU -> Instance)
-- Created: 2026-03-10

-- 1. Create Product SKUs table (Bridge between Model and Instance)
CREATE TABLE IF NOT EXISTS product_skus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,                   -- Link to product_models.id
    sku_code TEXT UNIQUE NOT NULL,               -- A-series SKU (e.g., A010-001-01)
    erp_code TEXT,                               -- 9-series ERP ID (e.g., 9-010-001-01)
    display_name TEXT NOT NULL,                   -- Bundle name (e.g., MAVO Edge 8K Basic Kit)
    display_name_en TEXT,                         -- English name
    spec_label TEXT,                              -- Specification details (e.g., Space Grey / E Mount)
    sku_image TEXT,                               -- Bundle image URL
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(model_id) REFERENCES product_models(id)
);

CREATE INDEX IF NOT EXISTS idx_product_skus_model ON product_skus(model_id);
CREATE INDEX IF NOT EXISTS idx_product_skus_sku ON product_skus(sku_code);

-- 2. Extend Product Models table
-- Add brand, English name, and hero image support
ALTER TABLE product_models ADD COLUMN name_en TEXT;
ALTER TABLE product_models ADD COLUMN brand TEXT DEFAULT 'Kinefinity';
ALTER TABLE product_models ADD COLUMN internal_prefix TEXT; -- ERP 9-series prefix
ALTER TABLE product_models ADD COLUMN hero_image TEXT;

-- 3. Extend Products (Installed Base) table
-- Add SKU link, Grade, and inventory fields
ALTER TABLE products ADD COLUMN sku_id INTEGER;
ALTER TABLE products ADD COLUMN grade TEXT DEFAULT 'A'; -- A (New), B (Certified Refurbished), C (Serviced)
ALTER TABLE products ADD COLUMN specification TEXT;      -- Redundant spec for quick display
ALTER TABLE products ADD COLUMN warehouse TEXT;          -- Physical location
ALTER TABLE products ADD COLUMN entry_channel TEXT;      -- FACTORY, RETURN, TRADE_IN, etc.

-- Update index for performance
CREATE INDEX IF NOT EXISTS idx_products_sku_id ON products(sku_id);
CREATE INDEX IF NOT EXISTS idx_products_grade ON products(grade);

-- 4. Initial Data: Seed SKUs from existing products to maintain compatibility
-- This logic assumes model names in 'products' match 'product_models'
INSERT INTO product_skus (model_id, sku_code, display_name, is_active)
SELECT DISTINCT pm.id, p.product_sku, pm.model_name || ' (' || p.product_sku || ')', 1
FROM products p
JOIN product_models pm ON p.model_name = pm.model_name
WHERE p.product_sku IS NOT NULL;

-- Link existing products to newly created SKUs
UPDATE products
SET sku_id = (SELECT id FROM product_skus WHERE sku_code = products.product_sku)
WHERE sku_id IS NULL AND product_sku IS NOT NULL;
