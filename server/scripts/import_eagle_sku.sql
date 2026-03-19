-- 导入 Eagle 产品 SKU 数据
-- 从 eagle_sku.csv 导入到 product_skus 表

-- KVF10 的 SKU (6个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K110-001-01', 'Kinefinity猎影SDI电子寻像器（黑色）', 'Kinefinity EAGLE SDI e-Viewfinder (Black)', '9-130-001-01', '6153057960937', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KVF10';

INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K110-001-02', 'Kinefinity猎影SDI电子寻像器（原色）', 'Kinefinity EAGLE SDI e-Viewfinder (Cyber)', '9-130-001-02', '6153057960938', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KVF10';

INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K911-001-01', 'Kinefinity猎影SDI电子寻像器 核心套装（黑色）', 'Kinefinity EAGLE SDI e-Viewfinder Core KIT (Black)', 'P-130-001-01', '6153057960935', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KVF10';

INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K911-001-02', 'Kinefinity猎影SDI电子寻像器 核心套装（原色）', 'Kinefinity EAGLE SDI e-Viewfinder Core KIT (Cyber)', 'P-130-001-02', '6153057960936', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KVF10';

INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K911-004-01', 'Kinefinity猎影SDI电子寻像器 专业套装（黑色）', 'Kinefinity EAGLE SDI e-Viewfinder Pro KIT (Black)', 'P-130-001-03', '757200089727', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KVF10';

INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K911-004-02', 'Kinefinity猎影SDI电子寻像器 专业套装（原色）', 'Kinefinity EAGLE SDI e-Viewfinder Pro KIT (Cyber)', 'P-130-001-04', '757200089735', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KVF10';

-- KVF11 的 SKU (3个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K110-002-01', 'Kinefinity猎影HDMI电子寻像器', 'Kinefinity EAGLE HDMI e-Viewfinder', '9-130-002-01', '757200089532', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KVF11';

INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K911-002-01', 'Kinefinity猎影HDMI电子寻像器 核心套装', 'Kinefinity EAGLE HDMI e-Viewfinder Core KIT', 'P-130-002-01', '757200089549', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KVF11';

INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K911-003-01', 'Kinefinity猎影HDMI电子寻像器 专业套装', 'Kinefinity EAGLE HDMI e-Viewfinder Pro KIT', 'P-130-002-02', '757200089556', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KVF11';

-- KCB1 的 SKU (2个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-001-01', 'SDI寻像器复合线缆（B型口, 40cm）', 'SDI e-Viewfinder Cord (D-Tap, 40cm)', '9-611-001-01', '6153057960939', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KCB1';

INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-001-02', 'SDI寻像器复合线缆（B型口, 70cm）', 'SDI e-Viewfinder Cord (D-Tap, 70cm)', '9-611-001-02', '6153057960941', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KCB1';

-- KCR1 的 SKU (2个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-002-01', 'SDI寻像器复合线缆（RS口, 40cm）', 'SDI e-Viewfinder Cord (RS, 40cm)', '9-611-002-01', '6153057960942', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KCR1';

INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-002-02', 'SDI寻像器复合线缆（RS口, 70cm）', 'SDI e-Viewfinder Cord (RS, 70cm)', '9-611-002-02', '6153057960943', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KCR1';

-- KCL1 的 SKU (1个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-011-01', 'SDI寻像器复合线缆（0B2P, 50cm）', 'SDI e-Viewfinder Cord (0B2P, 50cm)', '9-611-011-01', '757200089739', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KCL1';

-- KCH1 的 SKU (2个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-003-01', 'HDMI寻像器复合线缆（Type-C, 25cm）', 'HDMI e-Viewfinder Cord (Type-C, 25cm)', '9-611-003-01', '757200089563', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KCH1';

INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-003-02', 'HDMI寻像器复合线缆（Type-C, 50cm）', 'HDMI e-Viewfinder Cord (Type-C, 50cm)', '9-611-003-02', '757200089570', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KCH1';

-- KCH2 的 SKU (1个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-004-01', 'HDMI寻像器复合线缆（B型口, 50cm）', 'HDMI e-Viewfinder Cord (D-Tap, 50cm)', '9-611-004-01', '757200089587', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KCH2';

-- KCH3 的 SKU (1个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-012-01', 'HDMI寻像器复合线缆（0B2P, 50cm）', 'HDMI e-Viewfinder Cord (0B2P, 50cm)', '9-611-012-01', '757200089741', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KCH3';

-- KRV3 的 SKU (1个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-006-01', '寻像器牙盘（1/4"-20）', 'E-Viewfinder Rosette (1/4"-20)', '9-611-006-01', '757200089718', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KRV3';

-- KRV4 的 SKU (1个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-007-01', '寻像器牙盘（M6）', 'E-Viewfinder Rosette (M6)', '9-611-007-01', '757200089720', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KRV4';

-- KRV6 的 SKU (1个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-510-01', '寻像器硅胶眼罩', 'E-Viewfinder Eye Cup', '9-612-510-01', '757200089722', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KRV6';

-- KRV9 的 SKU (1个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-009-01', '支架转接件', 'Kinefinity Bracket Adapter', '9-611-009-01', '757200089726', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KRV9';

-- KRV10 的 SKU (1个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-010-01', '寻像器转接件（1/4"-20）', 'E-Viewfinder Extension Adapter (1/4"-20)', '9-611-010-01', '757200089756', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KRV10';

-- KRV11 的 SKU (1个)
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-013-01', '支架转接件（Sony-1/4"）', 'Kinefinity Bracket Adapter (Sony-1/4")', '9-611-013-01', NULL, 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KRV11';

-- 验证导入结果
SELECT 'Imported product_skus count' as result, COUNT(*) as count FROM product_skus WHERE model_id IN (SELECT id FROM product_models WHERE product_family = 'C');
