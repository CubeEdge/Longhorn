-- 导入 Eagle 产品型号数据
-- 从 eagle_pm.csv 导入到 product_models 表

-- KVF10 - SDI电子寻像器
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('Kinefinity猎影SDI电子寻像器', 'Kinefinity EAGLE SDI e-Viewfinder', 'KVF10', 'KVF_1', '9-130-001-01', '电子寻像器', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KVF11 - HDMI电子寻像器
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('Kinefinity猎影HDMI电子寻像器', 'Kinefinity EAGLE HDMI e-Viewfinder', 'KVF11', 'KVF_2', '9-130-002-01', '电子寻像器', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KCB1 - SDI线缆(B型口)
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('SDI寻像器复合线缆（B型口）', 'SDI e-Viewfinder Cord (D-Tap)', 'KCB1', NULL, '9-611-001-01', '线缆;电源', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KCR1 - SDI线缆(RS口)
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('SDI寻像器复合线缆（RS口）', 'SDI e-Viewfinder Cord (RS)', 'KCR1', NULL, '9-611-002-01', '线缆;电源', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KCL1 - SDI线缆(0B2P)
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('SDI寻像器复合线缆（0B2P）', 'SDI e-Viewfinder Cord (0B2P)', 'KCL1', NULL, '9-611-011-01', '线缆;电源', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KCH1 - HDMI线缆(Type-C)
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('HDMI寻像器复合线缆（Type-C）', 'HDMI e-Viewfinder Cord (Type-C)', 'KCH1', NULL, '9-611-003-01', '线缆', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KCH2 - HDMI线缆(B型口)
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('HDMI寻像器复合线缆（B型口）', 'HDMI e-Viewfinder Cord (D-Tap)', 'KCH2', NULL, '9-611-004-01', '线缆;电源', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KCH3 - HDMI线缆(0B2P)
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('HDMI寻像器复合线缆（0B2P）', 'HDMI e-Viewfinder Cord (0B2P)', 'KCH3', NULL, '9-611-012-01', '线缆;电源', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KRV3 - 寻像器牙盘(1/4-20)
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('寻像器牙盘（1/4"-20）', 'E-Viewfinder Rosette (1/4"-20)', 'KRV3', NULL, '9-611-006-01', 'Rig', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KRV4 - 寻像器牙盘(M6)
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('寻像器牙盘（M6）', 'E-Viewfinder Rosette (M6)', 'KRV4', NULL, '9-611-007-01', 'Rig', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KRV6 - 寻像器硅胶眼罩
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('寻像器硅胶眼罩', 'E-Viewfinder Eye Cup', 'KRV6', NULL, '9-612-510-01', 'Rig', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KRV9 - 支架转接件
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('支架转接件', 'Kinefinity Bracket Adapter', 'KRV9', NULL, '9-611-009-01', 'Rig', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KRV10 - 寻像器转接件(1/4-20)
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('寻像器转接件（1/4"-20）', 'E-Viewfinder Extension Adapter (1/4"-20)', 'KRV10', NULL, '9-611-010-01', 'Rig', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- KRV11 - 支架转接件(Sony-1/4)
INSERT INTO product_models (name_zh, name_en, model_code, sn_prefix, material_id, product_type, product_family, brand, is_active, created_at, updated_at)
VALUES ('支架转接件（Sony-1/4"）', 'Kinefinity Bracket Adapter (Sony-1/4")', 'KRV11', NULL, '9-611-013-01', 'Rig', 'C', 'Kinefinity', 1, datetime('now'), datetime('now'));

-- 验证导入结果
SELECT 'Imported product_models count' as result, COUNT(*) as count FROM product_models WHERE product_family = 'C';
