-- SKU 导入脚本

-- 导入 A 族群 SKU
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-001-01', 'MAVO Edge 8K 机身', 'MAVO Edge 8K', '9-010-001-01', '6153055274262', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C181';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-002-01', 'MAVO Edge 6K 机身（深空灰）', 'MAVO Edge 6K (Deep Gray)', '9-010-002-01', '6153053845860', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C162';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-002-02', 'MAVO Edge 6K 机身（原色）', 'MAVO Edge 6K (Cyber Edition)', '9-010-002-02', '6153054814827', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C162';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-002-03', 'MAVO Edge 6K 机身（黑色）', 'MAVO Edge 6K (Black)', '9-010-002-03', '6153051683679', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C162';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-003-01', 'MAVO mark2 LF 机身', 'MAVO mark2 LF', '9-010-003-01', '6153051326330', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C146';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-003-02', 'MAVO mark2 LF（KineMOUNT）', 'MAVO mark2 LF(KineMOUNT)', '9-010-003-02', '6153051780781', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C146';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-003-03', 'MAVO mark2 LF （E卡口）', 'MAVO mark2 LF (E Mount)', '9-010-003-03', '6153057858811', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C146';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-003-04', 'MAVO mark2 LF （PL卡口）', 'MAVO mark2 LF (PL Mount)', '9-010-003-04', '6153055144121', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C146';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-004-01', 'MAVO mark2 S35 机身', 'MAVO mark2 S35', '9-010-004-01', '6153052186186', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C135';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-004-02', 'MAVO mark2 S35（KineMOUNT）', 'MAVO mark2 S35 (KineMOUNT)', '9-010-003-02', '6153050197177', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C135';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-004-03', 'MAVO mark2 S35 （E卡口）', 'MAVO mark2 S35 (E Mount)', '9-010-003-03', '6153057019007', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C135';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A010-004-04', 'MAVO mark2 S35 （PL卡口）', 'MAVO mark2 S35 (PL Mount)', '9-010-003-04', '6153051872820', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'C135';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A901-001-01', '电影机核心版套装', 'MAVO Edge Core Pack', 'P-005-001-00', '6153050122148', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'APE1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A901-002-01', '电影机专业版套装', 'MAVO Edge Pro Pack', 'P-005-002-00', '6153054974996', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'APE1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A901-004-01', '电影机敏捷版套装', 'MAVO Edge Agile Pack', 'P-005-003-00', '6153051025011', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'APE1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A120-001-01', 'KineMON-5U2 超亮5寸监视器', 'KineMON-5U2 Ultra-Bright Monitor', '9-110-001-01', '6153056614623', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MON21';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A912-001-01', 'KineMON-5U2 超亮5寸监视器套装', 'KineMON-5U2 Pack', 'P-110-001-00', '6153050831811', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MON21';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A120-002-01', 'KineMON-7U2 超亮7寸监视器', 'KineMON-7U2 Ultra-Bright Monitor', '9-110-002-01', '6153050286222', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MON22';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A912-002-01', 'KineMON-7U2 超亮7寸监视器套装', 'KineMON-7U2 Pack', 'P-110-002-01', '6153056463412', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MON22';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-505-01', 'KineMON 小监楔形块', 'KineMON Wedge Block', '9-584-000-00', '6153050950932', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MON-ACC';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A120-003-01', 'KineEVF2 全高清OLED寻像器', 'KineEVF2 Full-HD OLED Viewfinder', '9-110-003-01', '6153053652611', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'EVF20';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A912-003-01', 'KineEVF2 全高清OLED寻像器套装', 'KineEVF2 Pack', 'P-501-000-01', '6153055334355', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'EVF20';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-001-01', 'Kine 视频线（0.3米）', 'Kine Video Cord (0.3m)', '9-110-501-01', '6153051791732', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'VCM1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-002-01', 'Kine 视频线（0.6米）', 'Kine Video Cord (0.6m)', '9-110-501-02', '6153052656627', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'VCM1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-003-01', 'Kine 视频线（1.2米）', 'Kine Video Cord (1.2m)', '9-110-501-03', '6153057319312', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'VCM1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-004-01', 'Kine 视频线（0.3米 双弯头）', 'Kine Video Cord (0.3m, Dual-L)', '9-110-501-05', '6153052811835', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'VCM1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A230-100-01', 'KineMOUNT', 'KineMOUNT', '9-230-100-01', '6153056165187', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KMA30';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A230-001-01', 'EF 3 转接卡口', 'EF 3 Mounting Adapter', '9-210-001-01', '6153051828865', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'EFC30';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A230-002-01', 'EF 3 转接卡口 带增光减焦', 'EF 3 Mounting Adapter w/ KineEnhancer', '9-210-002-01', '6153053338317', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'EFC31';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A230-003-01', 'EF 3 转接卡口 带电子ND', 'EF 3 Mounting Adapter w/ e-ND', '9-210-003-01', '6153050068064', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'EFC32';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A923-001-01', 'EF 3 转接卡口组合', 'EF Adapter 3 Combo', 'P-200-000-01', '6153049395300', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'EFC30';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A230-004-01', 'PL转接卡口', 'PL Mounting Adapter II', '9-210-004-01', '6153051128101', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PLA30';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A230-005-01', 'PL 转接卡口 带电子ND', 'PL Mounting Adapter II w/ e-ND', '9-210-005-01', '6153053944976', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PLA31';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A923-002-01', 'PL转接卡口组合', 'PL Adapter II Combo', 'P-210-004-01', '6153050289230', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PLA30';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A230-006-01', 'LPL 转接卡口', 'LPL Mounting Adapter', '9-210-015-01', '6153054127163', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'LPL30';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A230-007-01', 'E 转接卡口', 'E Mounting Adapter', '9-210-016-01', '6153052723732', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PSE30';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A240-004-01', '原生PL卡口', 'Active PL Mount', '9-240-004-01', '6153052377393', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PLA40';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A240-007-01', '电子E卡口', 'Active E Mount', '9-240-007-01', '6153052294270', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'ACE40';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A240-006-01', '原生LPL卡口', 'Active LPL Mount', '9-240-006-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'LPL40';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A330-001-01', 'KineMAG Nano 1TB存储卡', 'KineMAG Nano 1TB', '9-310-011-01', '6153057841837', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MAG31';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A330-002-01', 'KineMAG Nano 2TB存储卡', 'KineMAG Nano 2TB', '9-310-013-01', '6153055764756', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MAG32';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A330-003-01', 'KineMAG Nano卡体', 'KineMAG Nano Body', '9-310-012-01', '6153050391322', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MAGB1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A633-501-01', 'KineMAG Nano盒子', 'KineMAG Nano Case', '9-310-510-01', '6153053298222', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'CASM1';

-- 导入 B 族群 SKU
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A020-001-01', 'MC5030 4K讯道摄像机', 'MC5030 4K Live System Camera', '9-020-001-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MC5030';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A020-002-01', 'MC6030 4K讯道摄像机', 'MC6030 4K Live System Camera', '9-020-002-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MC6030';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A020-003-01', 'MC8030 8K讯道摄像机', 'MC8030 8K Live System Camera', '9-020-003-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MC8030';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A020-101-01', 'CCU5000 4K摄像机控制单元', 'CCU5000 4K Camera Control Unit', '9-020-101-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'CCU5000';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A020-102-01', 'CCU6000 4K摄像机控制单元', 'CCU6000 4K Camera Control Unit', '9-020-102-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'CCU6000';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A020-103-01', 'CCU8000 4K摄像机控制单元', 'CCU8000 4K Camera Control Unit', '9-020-103-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'CCU8000';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A602-002-01', 'RCP300 控制面板', 'RCP300 Control Panel', '9-602-002-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'RCP300';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A120-202-01', 'KineMON-7E 7寸高亮LCD寻像器', 'KineMON-7E 7” Ultra Bright Viewfinder', '9-120-202-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MON23';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A030-001-01', 'M503 4K多用途摄像机', 'M503 4K Multi-purpose Camera', '9-030-001-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'M503';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A030-002-01', 'M603 4K多用途摄像机', 'M603 4K Multi-purpose Camera', '9-030-002-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'M603';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A030-002-02', 'M603KP 4K多用途摄像机', 'M603KP 4K Multi-purpose Camera', '9-030-002-02', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'M603KP';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A030-003-01', 'M606 4K多用途摄像机', 'M606 4K Multi-purpose Camera', '9-030-003-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'M606';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A030-003-02', 'M606KP 4K多用途摄像机', 'M606KP 4K Multi-purpose Camera', '9-030-003-02', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'M606KP';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A030-004-01', 'M803 8K多用途摄像机', 'M803 8K Multi-purpose Camera', '9-030-004-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'M803';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A520-001-01', '扩展SDI 12G授权', 'EXT SDI 12G License', '', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'BC-LICENSE';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A520-002-01', '返送SDI 12G授权', 'RET SDI 12G License', '', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'BC-LICENSE';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A520-003-01', '录制 & 高速授权', 'Record & HiSpeed License', '', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'BC-LICENSE';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A520-004-01', '双光传输授权', 'Dual Fiberlink License', '', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'BC-LICENSE';

-- 导入 E 族群 SKU
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-501-01', 'KineMON 5 寸遮阳罩', 'KineMON Sunhood 5''''', '9-110-502-01', '6153056599517', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MONSH';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-502-01', 'KineMON 7 寸遮阳罩', 'KineMON Sunhood 7''''', '9-110-502-02', '6153050768773', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MONSH';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-506-01', 'KineEVF 寻像器海绵眼罩', 'KineEVF Eyecushion', '9-110-503-01', '6153050868855', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KEC1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-008-01', 'Kinefinity NATO滑条', 'Kinefinity NATO Rail', '9-611-008-01', '757200089724', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KRV8';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-509-01', '6寸 强力怪手/万向支撑', '6" Strong Arm', '9-563-001-00', '6153050077042', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MONS1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-509-02', '7寸 强力怪手/万向支撑', '7" Strong Arm', '9-563-001-01', '6153056679660', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MONS1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'K611-005-01', 'USB-C线缆（C2C，25cm）', 'USB-C Cable C25 (C2C, 25cm)', '9-611-005-01', '757200089594', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KCC1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A633-001-01', 'USB-C 10Gbps数据线', 'KineMAG USB-C 10Gbps Cable', '9-555-000-00', '6153057960934', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KCC2';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A430-001-01', 'KineBAT 99', 'PD KineBAT 99', '9-430-001-01', '6153054393308', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KBV31';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A943-001-01', 'KineBAT 99 两电一充', 'PD KineBAT 99 x2 + 65W PD Power Adapter x1', 'P-430-001-01', '6153050466471', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KBV31';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A430-002-01', 'KineBAT 200', 'PD KineBAT 200', '9-430-002-01', '6153050858832', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KBV32';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A943-002-01', 'KineBAT 200 两电两充', 'PD KineBAT 200 x2 + 65W PD Power Adapter x2', 'P-430-002-01', '6153055543528', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KBV32';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A410-201-01', 'GripBAT 2S', 'GripBAT 2S', '9-410-201-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'GBF10';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A941-201-01', 'GripBAT 2S x4', 'GripBAT 2S x4', 'P-532-000-00', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'GBF10';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A941-202-01', 'GripBAT 2S 两电一充', 'GripBAT 2S x2 + PD Hybrid Dual Charger Pack x1', 'P-532-000-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'GBF10';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A941-203-01', 'GripBAT 2S 四电一充', 'GripBAT 2S x4 + PD Hybrid Dual Charger Pack x1', 'P-532-000-02', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'GBF10';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A410-201-02', 'GripBAT 2Si', 'GripBAT 2Si', '9-410-201-02', '6153053738742', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'GBF20';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A941-201-02', 'GripBAT 2Si x4', 'GripBAT 2Si x4', 'P-941-201-02', '6153050382382', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'GBF20';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A941-202-02', 'GripBAT 2Si 两电一充', 'GripBAT 2Si x2 + PD Hybrid Dual Charger Pack x1', 'P-941-202-02', '6153055616628', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'GBF20';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A941-203-02', 'GripBAT 2Si 四电一充', 'GripBAT 2Si x4 + PD Hybrid Dual Charger Pack x1', 'P-941-203-02', '6153055789735', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'GBF20';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A410-202-01', 'GripBAT 4S', 'GripBAT 4S', '9-410-202-01', '6153054237275', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'GBU10';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A941-204-01', 'GripBAT 4S 两电一充', 'GripBAT 4S x2 + PD Hybrid Dual Charger Pack x1', 'P-531-100-01', '6153050521521', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'GBU10';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A410-100-01', 'PD混合双路充电器', 'PD Hybrid Dual Charger', '9-410-100-01', '6153050468406', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PHC10';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A941-301-01', 'PD混合双路充电器 + 65W PD电源适配器', 'PD Hybrid Dual Charger Pack', 'P-533-000-00', '6153053172171', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PHC10';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A410-301-01', '65W PD电源适配器', '65W PD Power Adapter', '9-410-301-02', '6153057111138', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PPA13';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A641-001-01', '100W电源线1B', '100W Power Cord 1B', '9-554-000-00', '6153055187173', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PC21';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A641-001-02', '100W电源线0B', '100W Power Cord 0B', '9-554-000-01', '6153055187173', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PC21';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A941-001-01', '100W电源线1B + 65W PD电源适配器', '100W Power Cord 1B + 65W PD Power Adapter', 'P-554-000-00', '6153052783750', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PC21';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A941-001-02', '100W电源线0B + 65W PD电源适配器', '100W Power Cord 0B + 65W PD Power Adapter', 'P-554-000-01', '6153052783750', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'PC21';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A601-901-01', 'MAVO Edge KineKIT 套件', 'Movcam KineKIT-Edge', '9-601-901-01', '6153055394373', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MEP1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A601-911-01', '封闭式上手提', 'Movcam Enclosed Top Handgrip', '9-601-911-01', '6153053150155', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MET1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A601-912-01', 'Edge套件上顶板', 'Movcam Top Plate', '9-601-912-01', '6153056026020', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MET2';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A601-913-01', '侧面NATO导轨', 'Movcam NATO Slider on Top Plate', '9-601-913-01', '6153056022091', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MET3';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A601-914-01', 'Edge套件侧支撑', 'Movcam Side Support', '9-601-914-01', '6153054587578', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MET4';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A601-915-01', 'Edge套件UPS底座', 'Movcam UPS Baseplate', '9-601-915-01', '6153053312348', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MET5';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-503-01', 'KineMON 旋转固定座', 'Movcam KineMON Swivel Mount', '9-612-503-01', '6153055615669', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MET6';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-504-01', 'KineMON 冷靴口固定座', 'KineMON Coldshoe Mount', '9-581-000-00', '6153052652612', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MET7';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A601-916-01', 'Movcam 15mm铝管', 'Al Rod of 15mm diameter, 200mm Length', '9-601-916-01', '6153050875884', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'M151';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A601-918-01', '碳纤维上手提', 'Movcam Carbon Fiber Handgrip', '9-601-918-01', '6153053176100', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MTH1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A601-918-02', '碳纤维上手提 带NATO滑条', 'Movcam Carbon Fiber Top Handgrip (w/ NATO Slider)', '9-601-918-02', '6153051961968', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MTH1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A601-917-01', 'Movcam 轻型燕尾槽底板', 'Movcam Sliding Dovetail Plate', '9-601-917-01', '6153050383303', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'MDP1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A613-507-01', '寻像器迷你支架', 'E-Viewfinder Mini Mount', '9-613-507-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KRV1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A612-508-01', '寻像器支架', 'E-Viewfinder Rod Mount', '9-612-508-01', '', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'KRV2';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'ACC04-P', 'Toprig 供电底板NP-F', 'Accsoon Toprig Battery Plate', '9-594-027-01', '664918772147', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'ACC04-P';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A710-001-02', 'Kine电动改锥', 'Kinefinity Screwdriver', '9-710-001-02', '6153054214207', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'TSD1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A710-101-01', 'MAVO Edge 8K T恤衫 M码', 'Kinefinity T-shirt (MAVO Edge 8K, M)', '9-710-101-01', '6153056425472', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'TSE1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A710-101-02', 'MAVO Edge 8K T恤衫 L码', 'Kinefinity T-shirt (MAVO Edge 8K, L)', '9-710-101-02', '6153051241299', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'TSE1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A710-101-03', 'MAVO Edge 8K T恤衫 XL码', 'Kinefinity T-shirt (MAVO Edge 8K, XL)', '9-710-101-03', '6153050680655', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'TSE1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A710-101-04', 'MAVO Edge 8K T恤衫 XXL码', 'Kinefinity T-shirt (MAVO Edge 8K, XXL)', '9-710-101-04', '6153053081084', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'TSE1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A710-101-05', 'MAVO Edge 8K T恤衫 3XL码', 'Kinefinity T-shirt (MAVO Edge 8K, 3XL)', '9-710-101-05', '6153050016010', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'TSE1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A710-201-01', 'MAVO Edge 8K帆布包', 'Kinefinity Bag (MAVO Edge 8K)', '9-710-201-01', '6153050186195', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'TSE2';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A710-202-01', 'Kine LOGO徽章', 'Kinefinity Badge (Logo)', '9-710-202-01', '6153052153140', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'TLG1';
INSERT INTO product_skus (model_id, sku_code, display_name, display_name_en, material_id, upc, is_active, created_at, updated_at)
SELECT id, 'A710-301-01', 'Kine LOGO贴', 'Logo Tag x5', '9-710-301-01', '6153054731773', 1, datetime('now'), datetime('now') FROM product_models WHERE model_code = 'TLG2';
