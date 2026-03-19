-- 验证 Eagle 产品导入结果

-- 1. 查看导入的产品型号
SELECT '=== Product Models (product_family = C) ===' as info;
SELECT model_code, name_zh, sn_prefix, product_type FROM product_models WHERE product_family = 'C';

-- 2. 统计数量
SELECT '=== Counts ===' as info;
SELECT 'product_models' as table_name, COUNT(*) as count FROM product_models WHERE product_family = 'C'
UNION ALL
SELECT 'product_skus', COUNT(*) FROM product_skus WHERE model_id IN (SELECT id FROM product_models WHERE product_family = 'C');

-- 3. 查看 SKU 列表
SELECT '=== SKU List ===' as info;
SELECT pm.model_code, ps.sku_code, ps.display_name, ps.upc 
FROM product_skus ps 
JOIN product_models pm ON ps.model_id = pm.id 
WHERE pm.product_family = 'C';
