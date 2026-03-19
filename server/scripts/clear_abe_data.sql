-- 清空 A、B、E 三个族群的产品型号和 SKU
DELETE FROM product_skus WHERE model_id IN (SELECT id FROM product_models WHERE product_family IN ('A', 'B', 'E'));
DELETE FROM product_models WHERE product_family IN ('A', 'B', 'E');

-- 验证清空结果
SELECT 'Remaining A/B/E Models' as check_item, COUNT(*) as count FROM product_models WHERE product_family IN ('A', 'B', 'E');
SELECT 'Remaining A/B/E SKUs' as check_item, COUNT(*) as count FROM product_skus WHERE model_id IN (SELECT id FROM product_models WHERE product_family IN ('A', 'B', 'E'));
