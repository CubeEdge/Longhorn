-- 导入 Eagle 产品数据
-- 步骤1: 清空 product_family = 'C' 的数据

-- 先删除关联的 SKU
DELETE FROM product_skus WHERE model_id IN (
    SELECT id FROM product_models WHERE product_family = 'C'
);

-- 再删除型号
DELETE FROM product_models WHERE product_family = 'C';

-- 验证清空结果
SELECT 'product_models after cleanup' as table_name, COUNT(*) as count FROM product_models WHERE product_family = 'C'
UNION ALL
SELECT 'product_skus for C family', COUNT(*) FROM product_skus WHERE model_id IN (SELECT id FROM product_models WHERE product_family = 'C');
