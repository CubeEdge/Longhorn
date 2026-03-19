-- 检查已存在的 SKU
SELECT 'Existing A941 SKUs' as info;
SELECT sku_code FROM product_skus WHERE sku_code LIKE 'A941%';

SELECT 'All families SKU count' as info;
SELECT pm.product_family, COUNT(*) as count 
FROM product_skus ps 
JOIN product_models pm ON ps.model_id = pm.id 
GROUP BY pm.product_family;
