-- 验证 A、B、E 三个族群的导入结果
SELECT '=== Product Models ===' as section;
SELECT product_family, COUNT(*) as count FROM product_models WHERE product_family IN ('A', 'B', 'E') GROUP BY product_family;

SELECT '=== Product SKUs ===' as section;
SELECT pm.product_family, COUNT(*) as count 
FROM product_skus ps 
JOIN product_models pm ON ps.model_id = pm.id 
WHERE pm.product_family IN ('A', 'B', 'E') 
GROUP BY pm.product_family;

SELECT '=== Sample A Models ===' as section;
SELECT model_code, name_zh, product_type FROM product_models WHERE product_family = 'A' LIMIT 5;

SELECT '=== Sample B Models ===' as section;
SELECT model_code, name_zh, product_type FROM product_models WHERE product_family = 'B' LIMIT 5;

SELECT '=== Sample E Models ===' as section;
SELECT model_code, name_zh, brand, product_type FROM product_models WHERE product_family = 'E' LIMIT 5;

SELECT '=== Total Summary ===' as section;
SELECT 
    (SELECT COUNT(*) FROM product_models WHERE product_family IN ('A', 'B', 'E')) as total_models,
    (SELECT COUNT(*) FROM product_skus ps JOIN product_models pm ON ps.model_id = pm.id WHERE pm.product_family IN ('A', 'B', 'E')) as total_skus;
