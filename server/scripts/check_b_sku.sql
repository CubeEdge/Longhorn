-- 检查 B 族群 SKU
SELECT 'B family SKUs' as info, COUNT(*) as count 
FROM product_skus ps 
JOIN product_models pm ON ps.model_id = pm.id 
WHERE pm.product_family = 'B';

SELECT 'E family SKUs' as info, COUNT(*) as count 
FROM product_skus ps 
JOIN product_models pm ON ps.model_id = pm.id 
WHERE pm.product_family = 'E';

-- 检查 B 族群型号
SELECT 'B family models' as info, COUNT(*) as count FROM product_models WHERE product_family = 'B';

-- 检查是否有 SKU 关联问题
SELECT ps.sku_code, ps.model_id, pm.model_code, pm.product_family
FROM product_skus ps
LEFT JOIN product_models pm ON ps.model_id = pm.id
WHERE pm.model_code IS NULL;
