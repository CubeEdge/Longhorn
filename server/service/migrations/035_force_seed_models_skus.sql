-- Migration 035: Force Seed Product Models and SKUs
-- Purpose: Populates product_models with missing models found in physical inventory (products table) 
-- and creates basic SKUs to ensure the three-layer architecture works immediately.
-- Date: 2026-03-10

-- 1. Insert models that exist in 'products' but not in 'product_models'
INSERT OR IGNORE INTO product_models (model_name, product_family, product_type, description)
SELECT DISTINCT model_name, 
    CASE 
        WHEN model_name LIKE 'MAVO%' THEN 'A'
        WHEN model_name LIKE 'TERRA%' THEN 'B'
        WHEN model_name LIKE 'Eagle%' THEN 'C'
        ELSE 'D'
    END,
    CASE 
        WHEN model_name LIKE 'MAVO%' OR model_name LIKE 'TERRA%' THEN 'CAMERA'
        WHEN model_name LIKE 'Eagle%' THEN 'VIEWFINDER'
        ELSE 'ACCESSORY'
    END,
    'Auto-imported from existing inventory'
FROM products
WHERE model_name NOT IN (SELECT model_name FROM product_models);

-- 2. Create basic SKUs for every model (one per model as a fallback)
INSERT OR IGNORE INTO product_skus (model_id, sku_code, display_name, is_active)
SELECT id, 'SKU-' || REPLACE(model_name, ' ', '-'), model_name || ' Standard', 1
FROM product_models
WHERE id NOT IN (SELECT DISTINCT model_id FROM product_skus);

-- 3. Link existing products to these fallback SKUs
UPDATE products
SET sku_id = (
    SELECT ps.id 
    FROM product_skus ps 
    JOIN product_models pm ON ps.model_id = pm.id 
    WHERE pm.model_name = products.model_name 
    LIMIT 1
)
WHERE sku_id IS NULL;
