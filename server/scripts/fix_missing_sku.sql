-- 修复缺失的 KVF11 HDMI 核心套装 SKU
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K911-002-01', 'Kinefinity猎影HDMI电子寻像器 核心套装', 'Kinefinity EAGLE HDMI e-Viewfinder Core KIT', 'P-130-002-01', '757200089549', 1, datetime('now'), datetime('now') 
FROM product_models 
WHERE model_code = 'KVF11';

-- 验证修复结果
SELECT 'After fix - SKU count for KVF11' as info, COUNT(*) as count 
FROM product_skus ps 
JOIN product_models pm ON ps.model_id = pm.id 
WHERE pm.model_code = 'KVF11';

-- 显示 KVF11 的所有 SKU
SELECT ps.sku_code, ps.display_name, ps.upc 
FROM product_skus ps 
JOIN product_models pm ON ps.model_id = pm.id 
WHERE pm.model_code = 'KVF11';
