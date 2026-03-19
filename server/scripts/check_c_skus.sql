-- 检查 C 族群的 SKU
SELECT sku_code FROM product_skus ps JOIN product_models pm ON ps.model_id = pm.id WHERE pm.product_family = 'C';
