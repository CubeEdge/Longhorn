-- Migration: Add product_models table for product line management
-- Created: 2026-03-08

-- Product Models table - defines product lines (MAVO Edge 8K, Eagle, etc.)
CREATE TABLE IF NOT EXISTS product_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT NOT NULL UNIQUE,           -- Display name: "MAVO Edge 8K"
    internal_name TEXT,                         -- Internal code: "edge8k"
    product_family TEXT NOT NULL,               -- A, B, C, D
    product_type TEXT DEFAULT 'CAMERA',         -- CAMERA, VIEWFINDER, LENS, etc.
    description TEXT,                           -- Product description
    is_active BOOLEAN DEFAULT 1,                -- Whether this model is active
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_models_family ON product_models(product_family);
CREATE INDEX IF NOT EXISTS idx_product_models_active ON product_models(is_active);

-- Insert default product models based on existing products
INSERT OR IGNORE INTO product_models (model_name, internal_name, product_family, product_type, description, is_active) VALUES
('MAVO Edge 8K', 'edge8k', 'A', 'CAMERA', '旗舰8K电影机', 1),
('MAVO Edge 6K', 'edge6k', 'A', 'CAMERA', '专业6K电影机', 1),
('MAVO LF', 'mavolf', 'A', 'CAMERA', '全画幅电影机', 1),
('MAVO S35', 'mavos35', 'A', 'CAMERA', 'S35画幅电影机', 1),
('TERRA 4K', 'terra4k', 'B', 'CAMERA', '历史机型 - 4K电影机', 0),
('Eagle e-Viewfinder', 'eagle', 'C', 'VIEWFINDER', '电子寻像器', 1),
('KineMAG', 'kinemag', 'D', 'STORAGE', '存储介质', 1),
('KineKIT', 'kinekit', 'D', 'ACCESSORY', '通用配件套装', 1);
