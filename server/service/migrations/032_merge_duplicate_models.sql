-- 032_merge_duplicate_models.sql
-- Merge Terra 4K duplicate model

-- 1. Get the IDs of the two models
-- ID 5 is TERRA 4K
-- ID 16 is Terra 4K

-- 2. Update all existing product instances from 'Terra 4K' to 'TERRA 4K'
UPDATE products SET model_name = 'TERRA 4K' WHERE model_name = 'Terra 4K';

-- 3. Delete the duplicated product model
DELETE FROM product_models WHERE name_zh = 'Terra 4K' OR name_en = 'Terra 4K';
