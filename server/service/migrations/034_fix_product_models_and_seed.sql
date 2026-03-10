-- Migration 034: Create and Seed Product Models
-- Purpose: Ensure product_models exists in longhorn.db and seed it with standard data.
-- Date: 2026-03-10

-- 1. Create Product Models table if missing
CREATE TABLE IF NOT EXISTS product_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT UNIQUE NOT NULL,
    name_en TEXT,
    brand TEXT DEFAULT 'Kinefinity',
    internal_name TEXT,
    internal_prefix TEXT,
    product_family TEXT,
    product_type TEXT DEFAULT 'CAMERA',
    description TEXT,
    hero_image TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Seed Product Models (from database.sqlite and standard Kinefinity list)
INSERT OR IGNORE INTO product_models (id, model_name, internal_name, product_family, product_type, description, is_active) VALUES
(1, 'MAVO Edge 8K', 'edge8k', 'A', 'CAMERA', '旗舰8K电影机', 1),
(2, 'MAVO Edge 6K', 'edge6k', 'A', 'CAMERA', '专业6K电影机', 1),
(3, 'MAVO LF', 'mavolf', 'A', 'CAMERA', '全画幅电影机', 1),
(4, 'MAVO S35', 'mavos35', 'A', 'CAMERA', 'S35画幅电影机', 1),
(5, 'TERRA 4K', 'terra4k', 'B', 'CAMERA', '历史机型 - 4K电影机', 0),
(6, 'Eagle e-Viewfinder', 'eagle', 'C', 'VIEWFINDER', '电子寻像器', 1),
(7, 'KineMAG', 'kinemag', 'D', 'STORAGE', '存储介质', 1),
(8, 'KineKIT', 'kinekit', 'D', 'ACCESSORY', '通用配件套装', 1);

-- 3. Update existing SKU model links (just in case)
UPDATE product_skus
SET model_id = (SELECT id FROM product_models WHERE model_name = (SELECT model_name FROM products WHERE products.product_sku = product_skus.sku_code LIMIT 1))
WHERE model_id IS NULL OR model_id = 0;

-- 4. Re-run SKU seeding from products if necessary
INSERT OR IGNORE INTO product_skus (model_id, sku_code, display_name, is_active)
SELECT DISTINCT pm.id, p.product_sku, pm.model_name || ' (' || p.product_sku || ')', 1
FROM products p
JOIN product_models pm ON p.model_name = pm.model_name
WHERE p.product_sku IS NOT NULL;

-- 5. Finalize product-sku linkages
UPDATE products
SET sku_id = (SELECT id FROM product_skus WHERE sku_code = products.product_sku)
WHERE sku_id IS NULL AND product_sku IS NOT NULL;
