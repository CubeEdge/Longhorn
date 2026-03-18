-- 039_add_product_metadata_fields.sql
-- 增加产品物理属性、危险品标识、UPC 和序列号前缀字段
-- 重命名 material_id_prefix 为 material_id (物料 ID / SaaS ID)

-- 1. 更新 product_models 表：重命名 material_id_prefix 为 material_id
-- 注意：SQLite 不支持直接 RENAME COLUMN (低版本)，我们采用标准的兼容做法
ALTER TABLE product_models RENAME COLUMN material_id_prefix TO material_id;

-- 2. 更新 product_skus 表：增加物理属性及外部标识字段
ALTER TABLE product_skus ADD COLUMN weight_kg DECIMAL(10,2);
ALTER TABLE product_skus ADD COLUMN volume_cum DECIMAL(10,6);
ALTER TABLE product_skus ADD COLUMN length_cm DECIMAL(10,2);
ALTER TABLE product_skus ADD COLUMN width_cm DECIMAL(10,2);
ALTER TABLE product_skus ADD COLUMN depth_cm DECIMAL(10,2);
ALTER TABLE product_skus ADD COLUMN is_dangerous_goods BOOLEAN DEFAULT 0;
ALTER TABLE product_skus ADD COLUMN upc VARCHAR(50);
ALTER TABLE product_skus ADD COLUMN sn_prefix VARCHAR(50);
