-- =============================================================================
-- 经销商库存管理与维修工单配件消耗 - 修复版SQL
-- 使用直接INSERT避免子查询列名问题
-- =============================================================================

-- =============================================================================
-- 1. 扩展配件目录
-- =============================================================================

INSERT OR IGNORE INTO parts_catalog (part_number, part_name, part_name_en, description, category, subcategory, applicable_products, cost_price, retail_price, dealer_price, min_stock_level, reorder_quantity, is_active, is_sellable) VALUES
('SNS-8K-FF-001', 'MAVO Edge 8K全画幅传感器', 'MAVO Edge 8K Full Frame Sensor', '8K 45mm全画幅CMOS传感器', 'Sensor', 'CMOS', '["MAVO Edge 8K"]', 8500.00, 18000.00, 13500.00, 0, 1, 1, 0),
('SNS-6K-S35-001', 'MAVO Edge 6K S35传感器', 'MAVO Edge 6K S35 Sensor', '6K S35画幅CMOS传感器', 'Sensor', 'CMOS', '["MAVO Edge 6K"]', 6500.00, 14000.00, 10500.00, 0, 1, 1, 0),
('MBD-EDGE-001', 'MAVO Edge核心主板', 'MAVO Edge Mainboard', 'MAVO Edge 8K/6K通用核心主板', 'Board', 'Mainboard', '["MAVO Edge 8K","MAVO Edge 6K"]', 3200.00, 7500.00, 5625.00, 1, 2, 1, 0),
('MBD-TERRA-001', 'TERRA 4K主板', 'TERRA 4K Mainboard', 'TERRA 4K核心主板', 'Board', 'Mainboard', '["TERRA 4K"]', 1800.00, 4200.00, 3150.00, 1, 2, 1, 0),
('PWR-BATT-001', 'BP-U30电池组', 'BP-U30 Battery Pack', '原厂BP-U30电池,14.4V/31Wh', 'Accessory', 'Battery', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 280.00, 580.00, 435.00, 5, 10, 1, 1),
('PWR-CHGR-001', '双槽电池充电器', 'Dual Battery Charger', 'BP-U系列双槽快速充电器', 'Accessory', 'Charger', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 150.00, 320.00, 240.00, 3, 6, 1, 1),
('PWR-ADPT-001', 'AC电源适配器', 'AC Power Adapter', '65W AC-DC电源适配器', 'Accessory', 'Power', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 120.00, 280.00, 210.00, 3, 6, 1, 1),
('MNT-EF-001', 'Canon EF转接环', 'Canon EF Mount Adapter', 'EF镜头电子转接环', 'Mechanical', 'Mount', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 280.00, 650.00, 488.00, 3, 6, 1, 1),
('MNT-PL-001', 'PL电影镜头卡口', 'PL Mount Adapter', '标准PL电影镜头卡口', 'Mechanical', 'Mount', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 350.00, 800.00, 600.00, 2, 4, 1, 1),
('MNT-LPL-001', 'LPL电影镜头卡口', 'LPL Mount Adapter', '大画幅LPL电影镜头卡口', 'Mechanical', 'Mount', '["MAVO Edge 8K","MAVO LF"]', 420.00, 950.00, 713.00, 2, 4, 1, 1),
('MED-CFE-001', 'CFexpress 512GB', 'CFexpress Card 512GB', '高速CFexpress Type B存储卡', 'Accessory', 'Media', '["MAVO Edge 8K","MAVO Edge 6K"]', 380.00, 850.00, 638.00, 4, 8, 1, 1),
('MED-CFE-002', 'CFexpress 1TB', 'CFexpress Card 1TB', '高速CFexpress Type B存储卡', 'Accessory', 'Media', '["MAVO Edge 8K","MAVO Edge 6K"]', 680.00, 1500.00, 1125.00, 2, 4, 1, 1),
('MED-SD-001', 'SD卡槽模块', 'SD Card Slot Module', '备用SD卡槽组件', 'Mechanical', 'Media', '["MAVO Edge 8K","MAVO Edge 6K","TERRA 4K"]', 85.00, 200.00, 150.00, 3, 6, 1, 0),
('OPT-LCD-001', '机顶LCD显示屏模组', 'Top LCD Module', '3.5英寸触摸显示屏模组', 'Optical', 'Display', '["MAVO Edge 8K","MAVO Edge 6K"]', 650.00, 1500.00, 1125.00, 1, 2, 1, 0),
('OPT-EVF-001', 'KineEVF取景器', 'KineEVF Viewfinder', '0.7英寸OLED取景器', 'Optical', 'EVF', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 1200.00, 2800.00, 2100.00, 2, 3, 1, 1),
('CBL-HDMI-001', 'HDMI 2.0线(1.5m)', 'HDMI 2.0 Cable 1.5m', '高速HDMI 2.0线,支持4K60p', 'Cable', 'Video', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 25.00, 65.00, 49.00, 5, 10, 1, 1),
('CBL-HDMI-002', 'HDMI 2.0线(3m)', 'HDMI 2.0 Cable 3m', '高速HDMI 2.0线,支持4K60p', 'Cable', 'Video', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 35.00, 85.00, 64.00, 5, 10, 1, 1),
('CBL-SDI-001', 'SDI线(1.5m)', 'SDI Cable 1.5m', '3G-SDI同轴线缆', 'Cable', 'Video', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 30.00, 75.00, 56.00, 5, 10, 1, 1),
('CBL-PWR-001', 'D-Tap供电线', 'D-Tap Power Cable', 'D-Tap转2.5mm DC供电线', 'Cable', 'Power', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 18.00, 45.00, 34.00, 5, 10, 1, 1),
('CBL-USB-001', 'USB-C数据线', 'USB-C Cable', 'USB-C to USB-A 3.0数据线', 'Cable', 'Data', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 15.00, 38.00, 29.00, 5, 10, 1, 1),
('ACC-CASE-001', '便携保护箱', 'Carrying Case', '定制防水防震便携箱', 'Accessory', 'Protection', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 180.00, 420.00, 315.00, 2, 4, 1, 1),
('ACC-COVER-001', '机身硅胶保护套', 'Silicone Body Cover', '防滑硅胶保护套(黑色)', 'Accessory', 'Protection', '["MAVO Edge 8K","MAVO Edge 6K"]', 35.00, 85.00, 64.00, 5, 10, 1, 1),
('ACC-SCREEN-001', '屏幕保护膜', 'Screen Protector', '钢化玻璃屏幕保护膜', 'Accessory', 'Protection', '["MAVO Edge 8K","MAVO Edge 6K"]', 12.00, 28.00, 21.00, 8, 16, 1, 1),
('MAVO-ND-MOTOR', 'MAVO ND滤镜电机', 'MAVO ND Filter Motor', 'ND滤镜驱动电机组件', 'Mechanical', 'Motor', '["MAVO Edge 8K","MAVO Edge 6K"]', 450.00, 1100.00, 825.00, 1, 2, 1, 0);

-- =============================================================================
-- 2. 经销商库存数据
-- =============================================================================

-- ProAV Berlin (dealer_id=1) - 库存充足
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 25, 3, 5, 50, 8, '2026-01-15', '2026-02-10' FROM parts_catalog WHERE part_number = 'PWR-BATT-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 12, 1, 3, 20, 5, '2026-01-15', '2026-02-08' FROM parts_catalog WHERE part_number = 'PWR-CHGR-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 15, 2, 3, 25, 5, '2026-01-15', '2026-02-05' FROM parts_catalog WHERE part_number = 'PWR-ADPT-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 8, 1, 3, 15, 4, '2026-01-15', '2026-02-12' FROM parts_catalog WHERE part_number = 'MNT-EF-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 6, 0, 2, 12, 3, '2026-01-15', '2026-02-01' FROM parts_catalog WHERE part_number = 'MNT-PL-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 10, 2, 4, 15, 5, '2026-01-15', '2026-02-14' FROM parts_catalog WHERE part_number = 'MED-CFE-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 4, 1, 2, 8, 3, '2026-01-15', '2026-02-10' FROM parts_catalog WHERE part_number = 'MED-CFE-002';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 5, 1, 2, 8, 3, '2026-01-15', '2026-02-08' FROM parts_catalog WHERE part_number = 'OPT-EVF-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 20, 2, 5, 30, 8, '2026-01-15', '2026-02-15' FROM parts_catalog WHERE part_number = 'CBL-HDMI-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 15, 1, 5, 25, 7, '2026-01-15', '2026-02-12' FROM parts_catalog WHERE part_number = 'CBL-HDMI-002';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 12, 1, 5, 20, 6, '2026-01-15', '2026-02-10' FROM parts_catalog WHERE part_number = 'CBL-SDI-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 18, 2, 5, 25, 7, '2026-01-15', '2026-02-14' FROM parts_catalog WHERE part_number = 'CBL-PWR-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 6, 0, 2, 10, 3, '2026-01-15', '2026-02-05' FROM parts_catalog WHERE part_number = 'ACC-CASE-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 15, 1, 5, 25, 7, '2026-01-15', '2026-02-08' FROM parts_catalog WHERE part_number = 'ACC-COVER-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 3, 0, 1, 5, 2, '2026-01-15', '2026-02-01' FROM parts_catalog WHERE part_number = 'MBD-EDGE-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 1, id, 2, 0, 1, 4, 1, '2026-01-15', '2026-01-28' FROM parts_catalog WHERE part_number = 'OPT-LCD-001';

-- Gafpa Gear (dealer_id=2) - 低库存预警
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 2, id, 4, 1, 5, 30, 7, '2026-01-20', '2026-02-14' FROM parts_catalog WHERE part_number = 'PWR-BATT-001';  -- 低库存!
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 2, id, 2, 0, 3, 15, 4, '2026-01-20', '2026-02-10' FROM parts_catalog WHERE part_number = 'PWR-CHGR-001';   -- 低库存!
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 2, id, 8, 1, 3, 20, 5, '2026-01-20', '2026-02-08' FROM parts_catalog WHERE part_number = 'PWR-ADPT-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 2, id, 3, 0, 3, 12, 4, '2026-01-20', '2026-02-05' FROM parts_catalog WHERE part_number = 'MNT-EF-001';     -- 临界
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 2, id, 1, 0, 2, 10, 3, '2026-01-20', '2026-02-01' FROM parts_catalog WHERE part_number = 'MNT-PL-001';     -- 低库存!
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 2, id, 6, 1, 4, 12, 5, '2026-01-20', '2026-02-12' FROM parts_catalog WHERE part_number = 'MED-CFE-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 2, id, 2, 0, 2, 6, 3, '2026-01-20', '2026-02-08' FROM parts_catalog WHERE part_number = 'OPT-EVF-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 2, id, 8, 1, 5, 20, 7, '2026-01-20', '2026-02-14' FROM parts_catalog WHERE part_number = 'CBL-HDMI-001';    -- 临界
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 2, id, 10, 1, 5, 18, 6, '2026-01-20', '2026-02-10' FROM parts_catalog WHERE part_number = 'CBL-PWR-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 2, id, 3, 0, 2, 8, 3, '2026-01-20', '2026-02-05' FROM parts_catalog WHERE part_number = 'ACC-CASE-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 2, id, 1, 0, 1, 3, 1, '2026-01-20', '2026-01-25' FROM parts_catalog WHERE part_number = 'MBD-EDGE-001';

-- Cinetx (dealer_id=3) - 中等库存
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 15, 2, 5, 25, 7, '2026-01-25', '2026-02-12' FROM parts_catalog WHERE part_number = 'PWR-BATT-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 8, 1, 3, 15, 4, '2026-01-25', '2026-02-08' FROM parts_catalog WHERE part_number = 'PWR-CHGR-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 10, 1, 3, 18, 5, '2026-01-25', '2026-02-05' FROM parts_catalog WHERE part_number = 'PWR-ADPT-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 5, 1, 3, 12, 4, '2026-01-25', '2026-02-10' FROM parts_catalog WHERE part_number = 'MNT-EF-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 4, 0, 2, 10, 3, '2026-01-25', '2026-02-03' FROM parts_catalog WHERE part_number = 'MNT-PL-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 8, 2, 4, 15, 5, '2026-01-25', '2026-02-14' FROM parts_catalog WHERE part_number = 'MED-CFE-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 4, 1, 2, 8, 3, '2026-01-25', '2026-02-10' FROM parts_catalog WHERE part_number = 'OPT-EVF-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 12, 1, 5, 20, 7, '2026-01-25', '2026-02-12' FROM parts_catalog WHERE part_number = 'CBL-HDMI-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 8, 1, 5, 15, 6, '2026-01-25', '2026-02-08' FROM parts_catalog WHERE part_number = 'CBL-SDI-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 4, 0, 2, 8, 3, '2026-01-25', '2026-02-05' FROM parts_catalog WHERE part_number = 'ACC-CASE-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 2, 0, 1, 4, 2, '2026-01-25', '2026-02-01' FROM parts_catalog WHERE part_number = 'MBD-EDGE-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 3, id, 2, 0, 1, 3, 1, '2026-01-25', '2026-01-30' FROM parts_catalog WHERE part_number = 'OPT-LCD-001';

-- CineTools (dealer_id=4) - 有在途补货
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 4, id, 12, 2, 5, 20, 7, '2026-01-18', '2026-02-14' FROM parts_catalog WHERE part_number = 'PWR-BATT-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 4, id, 5, 1, 3, 12, 4, '2026-01-18', '2026-02-10' FROM parts_catalog WHERE part_number = 'PWR-CHGR-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 4, id, 8, 1, 3, 15, 5, '2026-01-18', '2026-02-08' FROM parts_catalog WHERE part_number = 'PWR-ADPT-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 4, id, 4, 0, 3, 10, 4, '2026-01-18', '2026-02-05' FROM parts_catalog WHERE part_number = 'MNT-EF-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 4, id, 3, 0, 2, 8, 3, '2026-01-18', '2026-02-02' FROM parts_catalog WHERE part_number = 'MNT-PL-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 4, id, 6, 1, 4, 12, 5, '2026-01-18', '2026-02-12' FROM parts_catalog WHERE part_number = 'MED-CFE-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 4, id, 3, 1, 2, 6, 3, '2026-01-18', '2026-02-10' FROM parts_catalog WHERE part_number = 'OPT-EVF-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 4, id, 10, 1, 5, 18, 7, '2026-01-18', '2026-02-14' FROM parts_catalog WHERE part_number = 'CBL-HDMI-001';
INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 4, id, 3, 0, 2, 6, 3, '2026-01-18', '2026-02-05' FROM parts_catalog WHERE part_number = 'ACC-CASE-001';

-- =============================================================================
-- 3. 补货订单
-- =============================================================================

INSERT OR IGNORE INTO restock_order_sequences (date_key, last_sequence) VALUES ('20260201', 5);
INSERT OR IGNORE INTO restock_order_sequences (date_key, last_sequence) VALUES ('20260210', 3);

-- 补货订单
INSERT OR IGNORE INTO restock_orders (id, order_number, dealer_id, status, shipping_address, shipping_method, subtotal, shipping_cost, total_amount, currency, submitted_at, approved_at, shipped_at, delivered_at, dealer_notes, internal_notes, created_by, approved_by, created_at, updated_at)
VALUES
(1, 'RO-20260201-001', 2, 'Delivered', 'Gafpa Gear B.V., Van Nelleweg 1, 3044 BC Rotterdam, Netherlands', 'DHL Express', 9420.00, 150.00, 9570.00, 'USD', '2026-02-01 10:00:00', '2026-02-02 14:30:00', '2026-02-03 09:00:00', '2026-02-05 16:00:00', '急需补充电池库存,客户订单积压', '审批通过,优先处理', 4, 1, '2026-02-01 10:00:00', '2026-02-05 16:00:00'),
(2, 'RO-20260210-001', 2, 'Shipped', 'Gafpa Gear B.V., Van Nelleweg 1, 3044 BC Rotterdam, Netherlands', 'DHL Express', 26515.00, 150.00, 26665.00, 'USD', '2026-02-10 09:00:00', '2026-02-10 16:00:00', '2026-02-11 10:00:00', NULL, '补充PL卡口和充电器库存', NULL, 4, 1, '2026-02-10 09:00:00', '2026-02-11 10:00:00'),
(3, 'RO-20260212-001', 4, 'Approved', 'CineTools SARL, 15 Rue de la Paix, 75002 Paris, France', 'FedEx International', 15100.00, 120.00, 15220.00, 'USD', '2026-02-12 11:00:00', '2026-02-12 15:30:00', NULL, NULL, '常规补货,请安排发货', '库存正常,标准处理', 6, 1, '2026-02-12 11:00:00', '2026-02-12 15:30:00'),
(4, 'RO-20260215-001', 1, 'Draft', 'ProAV Berlin GmbH, Karl-Marx-Allee 100, 10243 Berlin, Germany', NULL, 0.00, 0.00, 0.00, 'USD', NULL, NULL, NULL, NULL, '准备补充维修配件库存', NULL, 3, NULL, '2026-02-15 09:00:00', '2026-02-15 09:00:00'),
(5, 'RO-20260214-001', 3, 'Submitted', 'Cinetx Ltd, Unit 5, Tech Park, London E1 6AN, UK', 'DHL Express', 27000.00, 180.00, 27180.00, 'USD', '2026-02-14 10:00:00', NULL, NULL, NULL, '急需补充主板和显示屏库存,有多个维修单 pending', '请优先审批', 5, NULL, '2026-02-14 10:00:00', '2026-02-14 10:00:00');

-- 补货订单明细
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 1, id, 20, 20, 20, 435.00, 8700.00, '紧急补货' FROM parts_catalog WHERE part_number = 'PWR-BATT-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 1, id, 3, 3, 3, 240.00, 720.00, NULL FROM parts_catalog WHERE part_number = 'PWR-CHGR-001';

INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 2, id, 8, 8, 8, 600.00, 4800.00, '补货' FROM parts_catalog WHERE part_number = 'MNT-PL-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 2, id, 10, 10, 10, 240.00, 2400.00, '补货' FROM parts_catalog WHERE part_number = 'PWR-CHGR-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 2, id, 5, 5, 5, 488.00, 2440.00, '补货' FROM parts_catalog WHERE part_number = 'MNT-EF-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 2, id, 3, 3, 3, 5625.00, 16875.00, '维修配件' FROM parts_catalog WHERE part_number = 'MBD-EDGE-001';

INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 3, id, 10, 10, NULL, 435.00, 4350.00, NULL FROM parts_catalog WHERE part_number = 'PWR-BATT-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 3, id, 5, 5, NULL, 638.00, 3190.00, NULL FROM parts_catalog WHERE part_number = 'MED-CFE-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 3, id, 3, 3, NULL, 2100.00, 6300.00, NULL FROM parts_catalog WHERE part_number = 'OPT-EVF-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 3, id, 4, 4, NULL, 315.00, 1260.00, NULL FROM parts_catalog WHERE part_number = 'ACC-CASE-001';

INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 4, id, 3, NULL, NULL, 5625.00, 16875.00, '维修配件补货' FROM parts_catalog WHERE part_number = 'MBD-EDGE-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 4, id, 3, NULL, NULL, 1125.00, 3375.00, '维修配件补货' FROM parts_catalog WHERE part_number = 'OPT-LCD-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 4, id, 1, NULL, NULL, 13500.00, 13500.00, '传感器备件' FROM parts_catalog WHERE part_number = 'SNS-8K-FF-001';

INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 5, id, 2, NULL, NULL, 5625.00, 11250.00, '维修急需' FROM parts_catalog WHERE part_number = 'MBD-EDGE-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 5, id, 2, NULL, NULL, 1125.00, 2250.00, '维修急需' FROM parts_catalog WHERE part_number = 'OPT-LCD-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 5, id, 1, NULL, NULL, 10500.00, 10500.00, '传感器备件' FROM parts_catalog WHERE part_number = 'SNS-6K-S35-001';
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 5, id, 5, NULL, NULL, 600.00, 3000.00, '销售补货' FROM parts_catalog WHERE part_number = 'MNT-PL-001';

-- =============================================================================
-- 4. 形式发票 (PI)
-- =============================================================================

INSERT OR IGNORE INTO proforma_invoices (id, pi_number, dealer_id, invoice_date, due_date, bill_to_name, bill_to_address, bill_to_country, subtotal, shipping_cost, tax_amount, discount_amount, total_amount, currency, exchange_rate, payment_terms, payment_status, paid_amount, paid_date, bank_details, status, notes, internal_notes, created_by, sent_at, created_at, updated_at)
VALUES
(1, 'PI-20260202-001', 2, '2026-02-02', '2026-03-04', 'Gafpa Gear B.V.', 'Van Nelleweg 1, 3044 BC Rotterdam', 'Netherlands', 9420.00, 150.00, 0.00, 0.00, 9570.00, 'USD', 1.0, 'Net30', 'Paid', 9570.00, '2026-02-04', '{"bank_name": "ING Bank", "account": "NL91INGB0001234567", "swift": "INGBNL2A"}', 'Confirmed', '补货订单RO-20260201-001的形式发票', NULL, 1, '2026-02-02 10:00:00', '2026-02-02 09:00:00', '2026-02-04 16:00:00'),
(2, 'PI-20260210-001', 2, '2026-02-10', '2026-03-12', 'Gafpa Gear B.V.', 'Van Nelleweg 1, 3044 BC Rotterdam', 'Netherlands', 26515.00, 150.00, 0.00, 0.00, 26665.00, 'USD', 1.0, 'Net30', 'Pending', 0.00, NULL, '{"bank_name": "ING Bank", "account": "NL91INGB0001234567", "swift": "INGBNL2A"}', 'Sent', '补货订单RO-20260210-001的形式发票', '已发货,等待付款确认', 1, '2026-02-10 17:00:00', '2026-02-10 16:30:00', '2026-02-11 10:00:00'),
(3, 'PI-20260212-001', 4, '2026-02-12', '2026-03-14', 'CineTools SARL', '15 Rue de la Paix, 75002 Paris', 'France', 15100.00, 120.00, 0.00, 0.00, 15220.00, 'USD', 1.0, 'Net30', 'Pending', 0.00, NULL, '{"bank_name": "BNP Paribas", "account": "FR1420041010050500013M02606", "swift": "BNPAFRPP"}', 'Draft', '补货订单RO-20260212-001的形式发票', '待发货后发送', 1, NULL, '2026-02-12 15:45:00', '2026-02-12 15:45:00');

-- 更新订单的PI关联
UPDATE restock_orders SET pi_id = 1 WHERE id = 1;
UPDATE restock_orders SET pi_id = 2 WHERE id = 2;
UPDATE restock_orders SET pi_id = 3 WHERE id = 3;

-- =============================================================================
-- 5. 扩展经销商维修工单
-- =============================================================================

INSERT OR IGNORE INTO dealer_repair_sequences (year_month, last_sequence) VALUES ('2602', 12);

INSERT OR IGNORE INTO dealer_repairs (ticket_number, dealer_id, product_id, serial_number, customer_name, customer_contact, issue_category, issue_subcategory, problem_description, repair_content, status, created_at, updated_at)
VALUES
('SVC-D-2602-0004', 1, (SELECT id FROM products WHERE serial_number = '8624-A001'), '8624-A001', 'Studio Hamburg', 'tech@studio-hamburg.de', 'Mainboard', 'Power Failure', '机器无法开机,电源指示灯不亮。客户反映在拍摄现场突然断电后无法重启。经检测为主板电源管理芯片烧毁。', '更换核心主板,重新安装固件KineOS 7.2.3,进行完整功能测试。更换电源适配器避免再次损坏。', 'Completed', '2026-02-01 09:00:00', '2026-02-03 16:00:00'),
('SVC-D-2602-0005', 2, (SELECT id FROM products WHERE serial_number = '6623-F072'), '6623-F072', 'Amsterdam Film Academy', 'equipment@afa.nl', 'LCD', 'Display Damage', '机顶LCD显示屏出现亮线和黑块,触摸功能失效。疑似受到外力撞击导致屏幕损坏。', '更换LCD显示屏模组,校准触摸层,测试所有显示模式和触摸功能。', 'Completed', '2026-01-28 10:00:00', '2026-01-30 15:30:00'),
('SVC-D-2602-0006', 2, (SELECT id FROM products WHERE serial_number = '6624-B088'), '6624-B088', 'Rotterdam Rental', 'service@rotterdam-rental.nl', 'Battery', 'Corrosion', '电池仓触点氧化腐蚀,导致电池接触不良,经常断电。客户使用环境潮湿导致。', '清洁电池仓触点,涂抹防氧化剂,更换两节原厂电池(旧电池已漏液损坏)。', 'Completed', '2026-02-10 11:00:00', '2026-02-12 14:00:00'),
('SVC-D-2602-0007', 3, (SELECT id FROM products WHERE serial_number = '4522-C012'), '4522-C012', 'London Camera Exchange', 'repair@lce.co.uk', 'MountSystem', 'Loose Mount', 'PL卡口锁紧机构松动,镜头安装后有明显晃动,影响对焦精度。长期使用频繁更换镜头导致磨损。', '更换PL卡口模块,重新校准法兰距,测试多款PL镜头兼容性。', 'Completed', '2026-02-05 13:00:00', '2026-02-07 11:00:00'),
('SVC-D-2602-0008', 3, (SELECT id FROM products WHERE serial_number = '1523-D045'), '1523-D045', 'Bristol Productions', 'gear@bristol-prod.co.uk', 'Sensor', 'Dust Spots', '拍摄纯色背景时发现画面中有固定黑点,疑似传感器进灰。', '传感器清洁(无配件更换),使用专业清洁棒和试剂,拍摄测试卡确认无灰尘。', 'Completed', '2026-01-30 09:30:00', '2026-01-30 16:00:00'),
('SVC-D-2602-0009', 1, (SELECT id FROM products WHERE serial_number = 'EVF-2301'), 'EVF-2301', 'Munich Broadcast', 'tech@munich-broadcast.de', 'WaterDamage', 'Multiple Failures', '机器意外进水,导致主板短路、LCD显示屏损坏、电池无法充电。紧急断电后送修。', '全面拆解清洁,更换主板、LCD显示屏、电池。进行48小时老化测试,确认功能完全恢复。', 'Completed', '2026-02-08 08:00:00', '2026-02-12 18:00:00'),
('SVC-D-2602-0010', 4, (SELECT id FROM products WHERE serial_number = '6624-B088'), '6624-B088-002', 'Paris Studio', 'contact@paris-studio.fr', 'Firmware', 'Boot Failure', '固件升级过程中断电,导致系统无法启动,显示错误代码E-202。', '进入恢复模式,重新刷写固件KineOS 7.2.0,恢复出厂设置,重新配置用户预设。', 'Completed', '2026-02-14 10:00:00', '2026-02-14 15:00:00'),
('SVC-D-2602-0011', 1, (SELECT id FROM products WHERE serial_number = '8624-A001'), '8624-A001-002', 'Berlin Film School', 'equipment@bfs.de', 'NDFilter', 'Motor Failure', '内置ND滤镜切换时卡顿,有时无法响应指令。电机异响。', NULL, 'InProgress', '2026-02-12 09:00:00', '2026-02-12 17:00:00'),
('SVC-D-2602-0012', 2, (SELECT id FROM products WHERE serial_number = '6623-F072'), '6623-F072-002', 'Dutch Film Fund', 'tech@filmfund.nl', 'MediaSlot', 'Card Error', 'CFexpress卡槽频繁报错,无法识别存储卡,已排除卡和固件问题。', NULL, 'Pending', '2026-02-15 08:00:00', '2026-02-15 08:00:00');

-- =============================================================================
-- 6. 维修工单配件消耗记录
-- =============================================================================

INSERT OR IGNORE INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
SELECT dr.id, p.id, p.part_name, 1, p.dealer_price
FROM dealer_repairs dr, parts_catalog p
WHERE dr.ticket_number = 'SVC-D-2602-0002' AND p.part_number = 'MNT-EF-001';

INSERT OR IGNORE INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
SELECT dr.id, p.id, p.part_name, 1, p.dealer_price
FROM dealer_repairs dr, parts_catalog p
WHERE dr.ticket_number = 'SVC-D-2602-0004' AND p.part_number = 'MBD-EDGE-001';

INSERT OR IGNORE INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
SELECT dr.id, p.id, p.part_name, 1, p.dealer_price
FROM dealer_repairs dr, parts_catalog p
WHERE dr.ticket_number = 'SVC-D-2602-0004' AND p.part_number = 'PWR-ADPT-001';

INSERT OR IGNORE INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
SELECT dr.id, p.id, p.part_name, 1, p.dealer_price
FROM dealer_repairs dr, parts_catalog p
WHERE dr.ticket_number = 'SVC-D-2602-0005' AND p.part_number = 'OPT-LCD-001';

INSERT OR IGNORE INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
SELECT dr.id, p.id, p.part_name, 2, p.dealer_price
FROM dealer_repairs dr, parts_catalog p
WHERE dr.ticket_number = 'SVC-D-2602-0006' AND p.part_number = 'PWR-BATT-001';

INSERT OR IGNORE INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
SELECT dr.id, p.id, p.part_name, 1, p.dealer_price
FROM dealer_repairs dr, parts_catalog p
WHERE dr.ticket_number = 'SVC-D-2602-0007' AND p.part_number = 'MNT-PL-001';

INSERT OR IGNORE INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
SELECT dr.id, p.id, p.part_name, 1, p.dealer_price
FROM dealer_repairs dr, parts_catalog p
WHERE dr.ticket_number = 'SVC-D-2602-0009' AND p.part_number = 'MBD-EDGE-001';

INSERT OR IGNORE INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
SELECT dr.id, p.id, p.part_name, 1, p.dealer_price
FROM dealer_repairs dr, parts_catalog p
WHERE dr.ticket_number = 'SVC-D-2602-0009' AND p.part_number = 'OPT-LCD-001';

INSERT OR IGNORE INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
SELECT dr.id, p.id, p.part_name, 1, p.dealer_price
FROM dealer_repairs dr, parts_catalog p
WHERE dr.ticket_number = 'SVC-D-2602-0009' AND p.part_number = 'PWR-BATT-001';

-- =============================================================================
-- 完成
-- =============================================================================
