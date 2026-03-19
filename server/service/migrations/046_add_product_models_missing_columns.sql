-- Migration 046: Add missing columns to product_models
-- Purpose: Add name_zh and sn_prefix columns required for SN prefix matching
-- Date: 2026-03-18

-- 1. Add name_zh column (Chinese name, copy from model_name initially)
ALTER TABLE product_models ADD COLUMN name_zh TEXT;

-- 2. Add sn_prefix column (Serial Number prefix for matching)
ALTER TABLE product_models ADD COLUMN sn_prefix TEXT;

-- 3. Add model_code column if not exists
ALTER TABLE product_models ADD COLUMN model_code TEXT;

-- 4. Add material_id column if not exists  
ALTER TABLE product_models ADD COLUMN material_id TEXT;

-- 5. Populate name_zh from model_name for existing records
UPDATE product_models SET name_zh = model_name WHERE name_zh IS NULL;

-- 6. Create index on sn_prefix for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_models_sn_prefix ON product_models(sn_prefix);
