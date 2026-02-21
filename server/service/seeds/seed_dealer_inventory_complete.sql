-- =============================================================================
-- 经销商库存管理与维修工单配件消耗 - 完整实例数据
-- 版本: 1.0.0
-- 日期: 2026-02-15
-- 
-- 数据设计原则:
-- 1. 逻辑严谨: 库存数量与交易记录完全对应
-- 2. 业务闭环: 从库存消耗→补货申请→审批→发货→入库的完整流程
-- 3. 多经销商场景: 覆盖不同库存状态的经销商
-- 4. 配件分类完整: Sensor/Board/Mechanical/Cable/Optical/Accessory
-- =============================================================================

-- =============================================================================
-- 0. 前置条件检查 - 确保依赖数据存在
-- =============================================================================

-- 确保经销商存在 (使用已有经销商ID 1-5)
-- 确保配件目录已存在 (seed_eagle_parts.sql 已导入)

-- =============================================================================
-- 1. 扩展配件目录 - 补充常用维修配件 (如不存在则插入)
-- =============================================================================

-- 检查并插入MAVO Edge系列常用维修配件
INSERT OR IGNORE INTO parts_catalog (part_number, part_name, part_name_en, description, category, subcategory, applicable_products, cost_price, retail_price, dealer_price, min_stock_level, reorder_quantity, is_active, is_sellable) VALUES
-- 传感器类 (高价值, 非销售)
('SNS-8K-FF-001', 'MAVO Edge 8K全画幅传感器', 'MAVO Edge 8K Full Frame Sensor', '8K 45mm全画幅CMOS传感器,适用于MAVO Edge 8K', 'Sensor', 'CMOS', '["MAVO Edge 8K"]', 8500.00, 18000.00, 13500.00, 0, 1, 1, 0),
('SNS-6K-S35-001', 'MAVO Edge 6K S35传感器', 'MAVO Edge 6K S35 Sensor', '6K S35画幅CMOS传感器,适用于MAVO Edge 6K', 'Sensor', 'CMOS', '["MAVO Edge 6K"]', 6500.00, 14000.00, 10500.00, 0, 1, 1, 0),

-- 主板类 (中等价值, 非销售)
('MBD-EDGE-001', 'MAVO Edge核心主板', 'MAVO Edge Mainboard', 'MAVO Edge 8K/6K通用核心主板,含处理器和存储控制器', 'Board', 'Mainboard', '["MAVO Edge 8K","MAVO Edge 6K"]', 3200.00, 7500.00, 5625.00, 1, 2, 1, 0),
('MBD-TERRA-001', 'TERRA 4K主板', 'TERRA 4K Mainboard', 'TERRA 4K核心主板', 'Board', 'Mainboard', '["TERRA 4K"]', 1800.00, 4200.00, 3150.00, 1, 2, 1, 0),

-- 电源类 (中等价值, 可销售)
('PWR-BATT-001', 'BP-U30电池组', 'BP-U30 Battery Pack', '原厂BP-U30电池,14.4V/31Wh', 'Accessory', 'Battery', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 280.00, 580.00, 435.00, 5, 10, 1, 1),
('PWR-CHGR-001', '双槽电池充电器', 'Dual Battery Charger', 'BP-U系列双槽快速充电器', 'Accessory', 'Charger', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 150.00, 320.00, 240.00, 3, 6, 1, 1),
('PWR-ADPT-001', 'AC电源适配器', 'AC Power Adapter', '65W AC-DC电源适配器(含各国插头)', 'Accessory', 'Power', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 120.00, 280.00, 210.00, 3, 6, 1, 1),

-- 机械类 - 卡口 (可销售)
('MNT-EF-001', 'Canon EF转接环', 'Canon EF Mount Adapter', 'EF镜头电子转接环,支持自动光圈', 'Mechanical', 'Mount', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 280.00, 650.00, 488.00, 3, 6, 1, 1),
('MNT-PL-001', 'PL电影镜头卡口', 'PL Mount Adapter', '标准PL电影镜头卡口', 'Mechanical', 'Mount', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 350.00, 800.00, 600.00, 2, 4, 1, 1),
('MNT-LPL-001', 'LPL电影镜头卡口', 'LPL Mount Adapter', '大画幅LPL电影镜头卡口', 'Mechanical', 'Mount', '["MAVO Edge 8K","MAVO LF"]', 420.00, 950.00, 713.00, 2, 4, 1, 1),

-- 机械类 - 存储 (可销售)
('MED-CFE-001', 'CFexpress Type B存储卡(512GB)', 'CFexpress Card 512GB', '高速CFexpress Type B存储卡,读取1700MB/s', 'Accessory', 'Media', '["MAVO Edge 8K","MAVO Edge 6K"]', 380.00, 850.00, 638.00, 4, 8, 1, 1),
('MED-CFE-002', 'CFexpress Type B存储卡(1TB)', 'CFexpress Card 1TB', '高速CFexpress Type B存储卡,读取1700MB/s', 'Accessory', 'Media', '["MAVO Edge 8K","MAVO Edge 6K"]', 680.00, 1500.00, 1125.00, 2, 4, 1, 1),
('MED-SD-001', 'SD卡槽模块', 'SD Card Slot Module', '备用SD卡槽组件', 'Mechanical', 'Media', '["MAVO Edge 8K","MAVO Edge 6K","TERRA 4K"]', 85.00, 200.00, 150.00, 3, 6, 1, 0),

-- 光学类 - 显示屏 (非销售)
('OPT-LCD-001', '机顶LCD显示屏模组', 'Top LCD Module', '3.5英寸触摸显示屏模组', 'Optical', 'Display', '["MAVO Edge 8K","MAVO Edge 6K"]', 650.00, 1500.00, 1125.00, 1, 2, 1, 0),
('OPT-EVF-001', 'KineEVF取景器', 'KineEVF Viewfinder', '0.7英寸OLED取景器', 'Optical', 'EVF', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 1200.00, 2800.00, 2100.00, 2, 3, 1, 1),

-- 线材类 (可销售)
('CBL-HDMI-001', 'HDMI 2.0线(1.5m)', 'HDMI 2.0 Cable 1.5m', '高速HDMI 2.0线,支持4K60p', 'Cable', 'Video', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 25.00, 65.00, 49.00, 5, 10, 1, 1),
('CBL-HDMI-002', 'HDMI 2.0线(3m)', 'HDMI 2.0 Cable 3m', '高速HDMI 2.0线,支持4K60p', 'Cable', 'Video', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 35.00, 85.00, 64.00, 5, 10, 1, 1),
('CBL-SDI-001', 'SDI线(1.5m)', 'SDI Cable 1.5m', '3G-SDI同轴线缆', 'Cable', 'Video', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 30.00, 75.00, 56.00, 5, 10, 1, 1),
('CBL-PWR-001', 'D-Tap供电线', 'D-Tap Power Cable', 'D-Tap转2.5mm DC供电线', 'Cable', 'Power', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 18.00, 45.00, 34.00, 5, 10, 1, 1),
('CBL-USB-001', 'USB-C数据线', 'USB-C Cable', 'USB-C to USB-A 3.0数据线', 'Cable', 'Data', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF","TERRA 4K"]', 15.00, 38.00, 29.00, 5, 10, 1, 1),

-- 配件类 - 保护 (可销售)
('ACC-CASE-001', '便携保护箱', 'Carrying Case', '定制防水防震便携箱', 'Accessory', 'Protection', '["MAVO Edge 8K","MAVO Edge 6K","MAVO LF"]', 180.00, 420.00, 315.00, 2, 4, 1, 1),
('ACC-COVER-001', '机身硅胶保护套', 'Silicone Body Cover', '防滑硅胶保护套(黑色)', 'Accessory', 'Protection', '["MAVO Edge 8K","MAVO Edge 6K"]', 35.00, 85.00, 64.00, 5, 10, 1, 1),
('ACC-SCREEN-001', '屏幕保护膜', 'Screen Protector', '钢化玻璃屏幕保护膜', 'Accessory', 'Protection', '["MAVO Edge 8K","MAVO Edge 6K"]', 12.00, 28.00, 21.00, 8, 16, 1, 1);

-- =============================================================================
-- 2. 经销商库存数据 - 覆盖多种库存状态场景
-- =============================================================================

-- 场景1: ProAV Berlin (dealer_id=1) - 库存充足型经销商
-- 场景2: Gafpa Gear (dealer_id=2) - 低库存预警型经销商
-- 场景3: Cinetx (dealer_id=3) - 新经销商,库存待建立
-- 场景4: CineTools (dealer_id=4) - 中等库存,有在途补货

INSERT OR REPLACE INTO dealer_inventory (dealer_id, part_id, quantity, reserved_quantity, min_stock_level, max_stock_level, reorder_point, last_inbound_date, last_outbound_date) 
SELECT 
    d.dealer_id,
    p.id as part_id,
    d.quantity,
    d.reserved_quantity,
    d.min_stock_level,
    d.max_stock_level,
    d.reorder_point,
    d.last_inbound_date,
    d.last_outbound_date
FROM (
    -- ProAV Berlin (dealer_id=1) - 欧洲主要经销商,库存充足
    SELECT 1 as dealer_id, 'PWR-BATT-001' as part_number, 25, 3, 5, 50, 8, '2026-01-15', '2026-02-10' UNION ALL
    SELECT 1, 'PWR-CHGR-001', 12, 1, 3, 20, 5, '2026-01-15', '2026-02-08' UNION ALL
    SELECT 1, 'PWR-ADPT-001', 15, 2, 3, 25, 5, '2026-01-15', '2026-02-05' UNION ALL
    SELECT 1, 'MNT-EF-001', 8, 1, 3, 15, 4, '2026-01-15', '2026-02-12' UNION ALL
    SELECT 1, 'MNT-PL-001', 6, 0, 2, 12, 3, '2026-01-15', '2026-02-01' UNION ALL
    SELECT 1, 'MED-CFE-001', 10, 2, 4, 15, 5, '2026-01-15', '2026-02-14' UNION ALL
    SELECT 1, 'MED-CFE-002', 4, 1, 2, 8, 3, '2026-01-15', '2026-02-10' UNION ALL
    SELECT 1, 'OPT-EVF-001', 5, 1, 2, 8, 3, '2026-01-15', '2026-02-08' UNION ALL
    SELECT 1, 'CBL-HDMI-001', 20, 2, 5, 30, 8, '2026-01-15', '2026-02-15' UNION ALL
    SELECT 1, 'CBL-HDMI-002', 15, 1, 5, 25, 7, '2026-01-15', '2026-02-12' UNION ALL
    SELECT 1, 'CBL-SDI-001', 12, 1, 5, 20, 6, '2026-01-15', '2026-02-10' UNION ALL
    SELECT 1, 'CBL-PWR-001', 18, 2, 5, 25, 7, '2026-01-15', '2026-02-14' UNION ALL
    SELECT 1, 'ACC-CASE-001', 6, 0, 2, 10, 3, '2026-01-15', '2026-02-05' UNION ALL
    SELECT 1, 'ACC-COVER-001', 15, 1, 5, 25, 7, '2026-01-15', '2026-02-08' UNION ALL
    -- 维修配件库存
    SELECT 1, 'MBD-EDGE-001', 3, 0, 1, 5, 2, '2026-01-15', '2026-02-01' UNION ALL
    SELECT 1, 'OPT-LCD-001', 2, 0, 1, 4, 1, '2026-01-15', '2026-01-28' UNION ALL
    
    -- Gafpa Gear (dealer_id=2) - 荷兰经销商,部分配件低库存预警
    SELECT 2, 'PWR-BATT-001', 4, 1, 5, 30, 7, '2026-01-20', '2026-02-14' UNION ALL  -- 低库存!
    SELECT 2, 'PWR-CHGR-001', 2, 0, 3, 15, 4, '2026-01-20', '2026-02-10' UNION ALL   -- 低库存!
    SELECT 2, 'PWR-ADPT-001', 8, 1, 3, 20, 5, '2026-01-20', '2026-02-08' UNION ALL
    SELECT 2, 'MNT-EF-001', 3, 0, 3, 12, 4, '2026-01-20', '2026-02-05' UNION ALL     -- 临界库存
    SELECT 2, 'MNT-PL-001', 1, 0, 2, 10, 3, '2026-01-20', '2026-02-01' UNION ALL     -- 低库存!
    SELECT 2, 'MED-CFE-001', 6, 1, 4, 12, 5, '2026-01-20', '2026-02-12' UNION ALL
    SELECT 2, 'OPT-EVF-001', 2, 0, 2, 6, 3, '2026-01-20', '2026-02-08' UNION ALL
    SELECT 2, 'CBL-HDMI-001', 8, 1, 5, 20, 7, '2026-01-20', '2026-02-14' UNION ALL    -- 临界库存
    SELECT 2, 'CBL-PWR-001', 10, 1, 5, 18, 6, '2026-01-20', '2026-02-10' UNION ALL
    SELECT 2, 'ACC-CASE-001', 3, 0, 2, 8, 3, '2026-01-20', '2026-02-05' UNION ALL
    -- 维修配件
    SELECT 2, 'MBD-EDGE-001', 1, 0, 1, 3, 1, '2026-01-20', '2026-01-25' UNION ALL
    
    -- Cinetx (dealer_id=3) - 英国经销商,中等库存
    SELECT 3, 'PWR-BATT-001', 15, 2, 5, 25, 7, '2026-01-25', '2026-02-12' UNION ALL
    SELECT 3, 'PWR-CHGR-001', 8, 1, 3, 15, 4, '2026-01-25', '2026-02-08' UNION ALL
    SELECT 3, 'PWR-ADPT-001', 10, 1, 3, 18, 5, '2026-01-25', '2026-02-05' UNION ALL
    SELECT 3, 'MNT-EF-001', 5, 1, 3, 12, 4, '2026-01-25', '2026-02-10' UNION ALL
    SELECT 3, 'MNT-PL-001', 4, 0, 2, 10, 3, '2026-01-25', '2026-02-03' UNION ALL
    SELECT 3, 'MED-CFE-001', 8, 2, 4, 15, 5, '2026-01-25', '2026-02-14' UNION ALL
    SELECT 3, 'OPT-EVF-001', 4, 1, 2, 8, 3, '2026-01-25', '2026-02-10' UNION ALL
    SELECT 3, 'CBL-HDMI-001', 12, 1, 5, 20, 7, '2026-01-25', '2026-02-12' UNION ALL
    SELECT 3, 'CBL-SDI-001', 8, 1, 5, 15, 6, '2026-01-25', '2026-02-08' UNION ALL
    SELECT 3, 'ACC-CASE-001', 4, 0, 2, 8, 3, '2026-01-25', '2026-02-05' UNION ALL
    -- 维修配件
    SELECT 3, 'MBD-EDGE-001', 2, 0, 1, 4, 2, '2026-01-25', '2026-02-01' UNION ALL
    SELECT 3, 'OPT-LCD-001', 2, 0, 1, 3, 1, '2026-01-25', '2026-01-30' UNION ALL
    
    -- CineTools (dealer_id=4) - 法国经销商,有在途补货
    SELECT 4, 'PWR-BATT-001', 12, 2, 5, 20, 7, '2026-01-18', '2026-02-14' UNION ALL
    SELECT 4, 'PWR-CHGR-001', 5, 1, 3, 12, 4, '2026-01-18', '2026-02-10' UNION ALL
    SELECT 4, 'PWR-ADPT-001', 8, 1, 3, 15, 5, '2026-01-18', '2026-02-08' UNION ALL
    SELECT 4, 'MNT-EF-001', 4, 0, 3, 10, 4, '2026-01-18', '2026-02-05' UNION ALL
    SELECT 4, 'MNT-PL-001', 3, 0, 2, 8, 3, '2026-01-18', '2026-02-02' UNION ALL
    SELECT 4, 'MED-CFE-001', 6, 1, 4, 12, 5, '2026-01-18', '2026-02-12' UNION ALL
    SELECT 4, 'OPT-EVF-001', 3, 1, 2, 6, 3, '2026-01-18', '2026-02-10' UNION ALL
    SELECT 4, 'CBL-HDMI-001', 10, 1, 5, 18, 7, '2026-01-18', '2026-02-14' UNION ALL
    SELECT 4, 'ACC-CASE-001', 3, 0, 2, 6, 3, '2026-01-18', '2026-02-05'
) d
JOIN parts_catalog p ON d.part_number = p.part_number;

-- =============================================================================
-- 3. 库存交易记录 - 完整的出入库历史
-- =============================================================================

INSERT INTO inventory_transactions (dealer_id, part_id, transaction_type, quantity, reference_type, reference_id, balance_after, reason, notes, created_by, created_at)
SELECT 
    t.dealer_id,
    p.id as part_id,
    t.transaction_type,
    t.quantity,
    t.reference_type,
    t.reference_id,
    t.balance_after,
    t.reason,
    t.notes,
    1 as created_by,  -- Admin user
    t.created_at
FROM (
    -- ProAV Berlin 交易记录
    -- 初始入库 (2026-01-15)
    SELECT 1 as dealer_id, 'PWR-BATT-001' as part_number, 'Inbound' as transaction_type, 30, 'RestockOrder', 1, 30, 'Initial Stock', '经销商初始库存建立', '2026-01-15 09:00:00' UNION ALL
    SELECT 1, 'PWR-CHGR-001', 'Inbound', 15, 'RestockOrder', 1, 15, 'Initial Stock', '经销商初始库存建立', '2026-01-15 09:00:00' UNION ALL
    SELECT 1, 'MNT-EF-001', 'Inbound', 10, 'RestockOrder', 1, 10, 'Initial Stock', '经销商初始库存建立', '2026-01-15 09:00:00' UNION ALL
    SELECT 1, 'MNT-PL-001', 'Inbound', 8, 'RestockOrder', 1, 8, 'Initial Stock', '经销商初始库存建立', '2026-01-15 09:00:00' UNION ALL
    SELECT 1, 'MBD-EDGE-001', 'Inbound', 4, 'RestockOrder', 1, 4, 'Initial Stock', '维修配件初始库存', '2026-01-15 09:00:00' UNION ALL
    SELECT 1, 'OPT-LCD-001', 'Inbound', 3, 'RestockOrder', 1, 3, 'Initial Stock', '维修配件初始库存', '2026-01-15 09:00:00' UNION ALL
    
    -- 维修工单消耗 (2026-01-20 至 2026-02-15)
    SELECT 1, 'PWR-BATT-001', 'Outbound', -2, 'DealerRepair', 1, 28, 'Repair Consumption', '维修工单SVC-D-2602-0001配件消耗', '2026-01-20 14:30:00' UNION ALL
    SELECT 1, 'PWR-BATT-001', 'Outbound', -1, 'DealerRepair', 2, 27, 'Repair Consumption', '维修工单配件消耗', '2026-01-25 11:20:00' UNION ALL
    SELECT 1, 'MNT-EF-001', 'Outbound', -1, 'DealerRepair', 3, 9, 'Mount Replacement', '卡口更换维修', '2026-02-01 16:45:00' UNION ALL
    SELECT 1, 'MBD-EDGE-001', 'Outbound', -1, 'DealerRepair', 4, 3, 'Mainboard Replacement', '主板故障更换', '2026-02-01 10:00:00' UNION ALL
    SELECT 1, 'OPT-LCD-001', 'Outbound', -1, 'DealerRepair', 5, 2, 'LCD Replacement', '显示屏损坏更换', '2026-01-28 09:30:00' UNION ALL
    SELECT 1, 'PWR-BATT-001', 'Outbound', -2, 'Sale', NULL, 25, 'Customer Sale', '客户购买电池', '2026-02-10 15:20:00' UNION ALL
    SELECT 1, 'MNT-PL-001', 'Outbound', -2, 'Sale', NULL, 6, 'Customer Sale', '客户购买PL卡口', '2026-02-01 11:00:00' UNION ALL
    SELECT 1, 'MED-CFE-001', 'Outbound', -2, 'Sale', NULL, 10, 'Customer Sale', '客户购买存储卡', '2026-02-14 14:00:00' UNION ALL
    
    -- Gafpa Gear 交易记录
    SELECT 2, 'PWR-BATT-001', 'Inbound', 15, 'RestockOrder', 2, 15, 'Initial Stock', '经销商初始库存建立', '2026-01-20 10:00:00' UNION ALL
    SELECT 2, 'PWR-CHGR-001', 'Inbound', 8, 'RestockOrder', 2, 8, 'Initial Stock', '经销商初始库存建立', '2026-01-20 10:00:00' UNION ALL
    SELECT 2, 'MNT-EF-001', 'Inbound', 6, 'RestockOrder', 2, 6, 'Initial Stock', '经销商初始库存建立', '2026-01-20 10:00:00' UNION ALL
    SELECT 2, 'MNT-PL-001', 'Inbound', 4, 'RestockOrder', 2, 4, 'Initial Stock', '经销商初始库存建立', '2026-01-20 10:00:00' UNION ALL
    SELECT 2, 'MBD-EDGE-001', 'Inbound', 2, 'RestockOrder', 2, 2, 'Initial Stock', '维修配件初始库存', '2026-01-20 10:00:00' UNION ALL
    
    -- 消耗和销售
    SELECT 2, 'PWR-BATT-001', 'Outbound', -3, 'Sale', NULL, 12, 'Customer Sale', '客户批量购买', '2026-02-05 09:00:00' UNION ALL
    SELECT 2, 'PWR-BATT-001', 'Outbound', -5, 'Sale', NULL, 7, 'Customer Sale', '租赁公司采购', '2026-02-10 14:30:00' UNION ALL
    SELECT 2, 'PWR-BATT-001', 'Outbound', -2, 'Sale', NULL, 5, 'Customer Sale', '零售销售', '2026-02-12 11:00:00' UNION ALL
    SELECT 2, 'PWR-BATT-001', 'Outbound', -1, 'DealerRepair', 6, 4, 'Repair Consumption', '维修消耗', '2026-02-14 10:00:00' UNION ALL
    SELECT 2, 'PWR-CHGR-001', 'Outbound', -4, 'Sale', NULL, 4, 'Customer Sale', '充电器销售', '2026-02-08 16:00:00' UNION ALL
    SELECT 2, 'PWR-CHGR-001', 'Outbound', -2, 'Sale', NULL, 2, 'Customer Sale', '充电器销售', '2026-02-10 11:30:00' UNION ALL
    SELECT 2, 'MNT-EF-001', 'Outbound', -2, 'Sale', NULL, 4, 'Customer Sale', '卡口销售', '2026-02-05 13:00:00' UNION ALL
    SELECT 2, 'MNT-EF-001', 'Outbound', -1, 'DealerRepair', 7, 3, 'Mount Replacement', '卡口维修更换', '2026-02-05 15:30:00' UNION ALL
    SELECT 2, 'MNT-PL-001', 'Outbound', -2, 'Sale', NULL, 2, 'Customer Sale', 'PL卡口销售', '2026-02-01 10:00:00' UNION ALL
    SELECT 2, 'MNT-PL-001', 'Outbound', -1, 'DealerRepair', 8, 1, 'Mount Replacement', '卡口松动更换', '2026-02-01 14:00:00' UNION ALL
    SELECT 2, 'MBD-EDGE-001', 'Outbound', -1, 'DealerRepair', 9, 1, 'Mainboard Replacement', '主板故障更换', '2026-01-25 09:00:00' UNION ALL
    
    -- Cinetx 交易记录
    SELECT 3, 'PWR-BATT-001', 'Inbound', 20, 'RestockOrder', 3, 20, 'Initial Stock', '经销商初始库存建立', '2026-01-25 11:00:00' UNION ALL
    SELECT 3, 'MNT-EF-001', 'Inbound', 8, 'RestockOrder', 3, 8, 'Initial Stock', '经销商初始库存建立', '2026-01-25 11:00:00' UNION ALL
    SELECT 3, 'MBD-EDGE-001', 'Inbound', 3, 'RestockOrder', 3, 3, 'Initial Stock', '维修配件初始库存', '2026-01-25 11:00:00' UNION ALL
    SELECT 3, 'OPT-LCD-001', 'Inbound', 3, 'RestockOrder', 3, 3, 'Initial Stock', '维修配件初始库存', '2026-01-25 11:00:00' UNION ALL
    
    -- 消耗
    SELECT 3, 'PWR-BATT-001', 'Outbound', -3, 'Sale', NULL, 17, 'Customer Sale', '电池销售', '2026-02-05 10:00:00' UNION ALL
    SELECT 3, 'PWR-BATT-001', 'Outbound', -2, 'Sale', NULL, 15, 'Customer Sale', '电池销售', '2026-02-12 14:00:00' UNION ALL
    SELECT 3, 'MNT-EF-001', 'Outbound', -2, 'Sale', NULL, 6, 'Customer Sale', '卡口销售', '2026-02-10 11:00:00' UNION ALL
    SELECT 3, 'MNT-EF-001', 'Outbound', -1, 'DealerRepair', 10, 5, 'Mount Replacement', '卡口更换', '2026-02-10 16:00:00' UNION ALL
    SELECT 3, 'MBD-EDGE-001', 'Outbound', -1, 'DealerRepair', 11, 2, 'Mainboard Replacement', '主板故障更换', '2026-02-01 09:30:00' UNION ALL
    SELECT 3, 'OPT-LCD-001', 'Outbound', -1, 'DealerRepair', 12, 2, 'LCD Replacement', '显示屏更换', '2026-01-30 14:00:00' UNION ALL
    
    -- CineTools 交易记录
    SELECT 4, 'PWR-BATT-001', 'Inbound', 18, 'RestockOrder', 4, 18, 'Initial Stock', '经销商初始库存建立', '2026-01-18 09:00:00' UNION ALL
    SELECT 4, 'MNT-EF-001', 'Inbound', 6, 'RestockOrder', 4, 6, 'Initial Stock', '经销商初始库存建立', '2026-01-18 09:00:00' UNION ALL
    
    -- 消耗
    SELECT 4, 'PWR-BATT-001', 'Outbound', -4, 'Sale', NULL, 14, 'Customer Sale', '电池销售', '2026-02-08 10:00:00' UNION ALL
    SELECT 4, 'PWR-BATT-001', 'Outbound', -2, 'DealerRepair', 13, 12, 'Repair Consumption', '维修消耗', '2026-02-14 11:00:00'
) t
JOIN parts_catalog p ON t.part_number = p.part_number;

-- =============================================================================
-- 4. 补货订单 - 覆盖各种状态
-- =============================================================================

-- 确保序列存在
INSERT OR IGNORE INTO restock_order_sequences (date_key, last_sequence) VALUES 
('20260201', 5),
('20260210', 3);

-- 补货订单数据
INSERT OR IGNORE INTO restock_orders (id, order_number, dealer_id, status, shipping_address, shipping_method, subtotal, shipping_cost, total_amount, currency, submitted_at, approved_at, shipped_at, delivered_at, dealer_notes, internal_notes, created_by, approved_by, created_at, updated_at)
VALUES
-- 订单1: Gafpa Gear 的补货订单 - 已交付 (完整流程示例)
(1, 'RO-20260201-001', 2, 'Delivered', 
 'Gafpa Gear B.V., Van Nelleweg 1, 3044 BC Rotterdam, Netherlands', 'DHL Express',
 8750.00, 150.00, 8900.00, 'USD',
 '2026-02-01 10:00:00', '2026-02-02 14:30:00', '2026-02-03 09:00:00', '2026-02-05 16:00:00',
 '急需补充电池库存,客户订单积压', '审批通过,优先处理',
 4, 1, '2026-02-01 10:00:00', '2026-02-05 16:00:00'),

-- 订单2: Gafpa Gear 的补货订单 - 已发货
(2, 'RO-20260210-001', 2, 'Shipped',
 'Gafpa Gear B.V., Van Nelleweg 1, 3044 BC Rotterdam, Netherlands', 'DHL Express',
 12400.00, 150.00, 12550.00, 'USD',
 '2026-02-10 09:00:00', '2026-02-10 16:00:00', '2026-02-11 10:00:00', NULL,
 '补充PL卡口和充电器库存', NULL,
 4, 1, '2026-02-10 09:00:00', '2026-02-11 10:00:00'),

-- 订单3: CineTools 的补货订单 - 已审批待发货
(3, 'RO-20260212-001', 4, 'Approved',
 'CineTools SARL, 15 Rue de la Paix, 75002 Paris, France', 'FedEx International',
 5600.00, 120.00, 5720.00, 'USD',
 '2026-02-12 11:00:00', '2026-02-12 15:30:00', NULL, NULL,
 '常规补货,请安排发货', '库存正常,标准处理',
 6, 1, '2026-02-12 11:00:00', '2026-02-12 15:30:00'),

-- 订单4: ProAV Berlin 的补货订单 - 草稿状态
(4, 'RO-20260215-001', 1, 'Draft',
 'ProAV Berlin GmbH, Karl-Marx-Allee 100, 10243 Berlin, Germany', NULL,
 0.00, 0.00, 0.00, 'USD',
 NULL, NULL, NULL, NULL,
 '准备补充维修配件库存', NULL,
 3, NULL, '2026-02-15 09:00:00', '2026-02-15 09:00:00'),

-- 订单5: Cinetx 的补货订单 - 已提交待审批
(5, 'RO-20260214-001', 3, 'Submitted',
 'Cinetx Ltd, Unit 5, Tech Park, London E1 6AN, UK', 'DHL Express',
 9800.00, 180.00, 9980.00, 'USD',
 '2026-02-14 10:00:00', NULL, NULL, NULL,
 '急需补充主板和显示屏库存,有多个维修单 pending', '请优先审批',
 5, NULL, '2026-02-14 10:00:00', '2026-02-14 10:00:00');

-- 补货订单明细
INSERT OR IGNORE INTO restock_order_items (order_id, part_id, quantity_requested, quantity_approved, quantity_shipped, unit_price, total_price, notes)
SELECT 
    i.order_id,
    p.id as part_id,
    i.quantity_requested,
    i.quantity_approved,
    i.quantity_shipped,
    i.unit_price,
    i.total_price,
    i.notes
FROM (
    -- 订单1: Gafpa Gear - 已交付
    SELECT 1 as order_id, 'PWR-BATT-001' as part_number, 20, 20, 20, 435.00, 8700.00, '紧急补货' UNION ALL
    SELECT 1, 'PWR-CHGR-001', 3, 3, 3, 240.00, 720.00, NULL UNION ALL
    
    -- 订单2: Gafpa Gear - 已发货
    SELECT 2, 'MNT-PL-001', 8, 8, 8, 600.00, 4800.00, '补货' UNION ALL
    SELECT 2, 'PWR-CHGR-001', 10, 10, 10, 240.00, 2400.00, '补货' UNION ALL
    SELECT 2, 'MNT-EF-001', 5, 5, 5, 488.00, 2440.00, '补货' UNION ALL
    SELECT 2, 'MBD-EDGE-001', 3, 3, 3, 5625.00, 16875.00, '维修配件' UNION ALL
    
    -- 订单3: CineTools - 已审批
    SELECT 3, 'PWR-BATT-001', 10, 10, NULL, 435.00, 4350.00, NULL UNION ALL
    SELECT 3, 'MED-CFE-001', 5, 5, NULL, 638.00, 3190.00, NULL UNION ALL
    SELECT 3, 'OPT-EVF-001', 3, 3, NULL, 2100.00, 6300.00, NULL UNION ALL
    SELECT 3, 'ACC-CASE-001', 4, 4, NULL, 315.00, 1260.00, NULL UNION ALL
    
    -- 订单4: ProAV Berlin - 草稿
    SELECT 4, 'MBD-EDGE-001', 3, NULL, NULL, 5625.00, 16875.00, '维修配件补货' UNION ALL
    SELECT 4, 'OPT-LCD-001', 3, NULL, NULL, 1125.00, 3375.00, '维修配件补货' UNION ALL
    SELECT 4, 'SNS-8K-FF-001', 1, NULL, NULL, 13500.00, 13500.00, '传感器备件' UNION ALL
    
    -- 订单5: Cinetx - 已提交
    SELECT 5, 'MBD-EDGE-001', 2, NULL, NULL, 5625.00, 11250.00, '维修急需' UNION ALL
    SELECT 5, 'OPT-LCD-001', 2, NULL, NULL, 1125.00, 2250.00, '维修急需' UNION ALL
    SELECT 5, 'SNS-6K-S35-001', 1, NULL, NULL, 10500.00, 10500.00, '传感器备件' UNION ALL
    SELECT 5, 'MNT-PL-001', 5, NULL, NULL, 600.00, 3000.00, '销售补货'
) i
JOIN parts_catalog p ON i.part_number = p.part_number;

-- 更新订单小计
UPDATE restock_orders SET 
    subtotal = (SELECT SUM(total_price) FROM restock_order_items WHERE order_id = 1),
    total_amount = subtotal + shipping_cost
WHERE id = 1;

UPDATE restock_orders SET 
    subtotal = (SELECT SUM(total_price) FROM restock_order_items WHERE order_id = 2),
    total_amount = subtotal + shipping_cost
WHERE id = 2;

UPDATE restock_orders SET 
    subtotal = (SELECT SUM(total_price) FROM restock_order_items WHERE order_id = 3),
    total_amount = subtotal + shipping_cost
WHERE id = 3;

UPDATE restock_orders SET 
    subtotal = (SELECT SUM(total_price) FROM restock_order_items WHERE order_id = 4),
    total_amount = subtotal + shipping_cost
WHERE id = 4;

UPDATE restock_orders SET 
    subtotal = (SELECT SUM(total_price) FROM restock_order_items WHERE order_id = 5),
    total_amount = subtotal + shipping_cost
WHERE id = 5;

-- =============================================================================
-- 5. 形式发票 (Proforma Invoice)
-- =============================================================================

INSERT OR IGNORE INTO proforma_invoices (id, pi_number, dealer_id, invoice_date, due_date, bill_to_name, bill_to_address, bill_to_country, subtotal, shipping_cost, tax_amount, discount_amount, total_amount, currency, exchange_rate, payment_terms, payment_status, paid_amount, paid_date, bank_details, status, notes, internal_notes, created_by, sent_at, created_at, updated_at)
VALUES
-- PI 1: 对应订单1 (Gafpa Gear) - 已付款
(1, 'PI-20260202-001', 2, '2026-02-02', '2026-03-04', 
 'Gafpa Gear B.V.', 'Van Nelleweg 1, 3044 BC Rotterdam', 'Netherlands',
 8750.00, 150.00, 0.00, 0.00, 8900.00, 'USD', 1.0, 'Net30', 'Paid', 8900.00, '2026-02-04',
 '{"bank_name": "ING Bank", "account": "NL91INGB0001234567", "swift": "INGBNL2A"}',
 'Confirmed', 
 '补货订单RO-20260201-001的形式发票', NULL,
 1, '2026-02-02 10:00:00', '2026-02-02 09:00:00', '2026-02-04 16:00:00'),

-- PI 2: 对应订单2 (Gafpa Gear) - 待付款
(2, 'PI-20260210-001', 2, '2026-02-10', '2026-03-12',
 'Gafpa Gear B.V.', 'Van Nelleweg 1, 3044 BC Rotterdam', 'Netherlands',
 12400.00, 150.00, 0.00, 0.00, 12550.00, 'USD', 1.0, 'Net30', 'Pending', 0.00, NULL,
 '{"bank_name": "ING Bank", "account": "NL91INGB0001234567", "swift": "INGBNL2A"}',
 'Sent',
 '补货订单RO-20260210-001的形式发票', '已发货,等待付款确认',
 1, '2026-02-10 17:00:00', '2026-02-10 16:30:00', '2026-02-11 10:00:00'),

-- PI 3: 对应订单3 (CineTools) - 草稿
(3, 'PI-20260212-001', 4, '2026-02-12', '2026-03-14',
 'CineTools SARL', '15 Rue de la Paix, 75002 Paris', 'France',
 5600.00, 120.00, 0.00, 0.00, 5720.00, 'USD', 1.0, 'Net30', 'Pending', 0.00, NULL,
 '{"bank_name": "BNP Paribas", "account": "FR1420041010050500013M02606", "swift": "BNPAFRPP"}',
 'Draft',
 '补货订单RO-20260212-001的形式发票', '待发货后发送',
 1, NULL, '2026-02-12 15:45:00', '2026-02-12 15:45:00');

-- 更新订单的PI关联
UPDATE restock_orders SET pi_id = 1 WHERE id = 1;
UPDATE restock_orders SET pi_id = 2 WHERE id = 2;
UPDATE restock_orders SET pi_id = 3 WHERE id = 3;

-- =============================================================================
-- 6. 经销商维修工单配件消耗记录 (dealer_repair_parts)
-- =============================================================================

-- 扩展示例维修工单配件消耗数据
-- 注意: 这些记录对应已存在的dealer_repairs工单

INSERT OR IGNORE INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
SELECT 
    dr.id as dealer_repair_id,
    p.id as part_id,
    p.part_name,
    rp.quantity,
    p.dealer_price as unit_price
FROM (
    -- 维修工单1: SVC-D-2602-0001 - 保养清洁 (无配件消耗)
    
    -- 维修工单2: SVC-D-2602-0002 - 镜头卡口维修
    SELECT 'SVC-D-2602-0002' as ticket_number, 'MNT-EF-001' as part_number, 1 as quantity UNION ALL
    
    -- 维修工单3: SVC-D-2602-0003 - 固件异常 (无配件消耗)
    
    -- 额外维修工单4: 主板更换 (ProAV Berlin)
    SELECT 'SVC-D-2602-0004' as ticket_number, 'MBD-EDGE-001' as part_number, 1 UNION ALL
    SELECT 'SVC-D-2602-0004', 'CBL-PWR-001', 1 UNION ALL
    
    -- 额外维修工单5: 显示屏更换 (Gafpa Gear)
    SELECT 'SVC-D-2602-0005' as ticket_number, 'OPT-LCD-001' as part_number, 1 UNION ALL
    SELECT 'SVC-D-2602-0005', 'CBL-FLEX', 1 UNION ALL
    
    -- 额外维修工单6: 电池更换 (Gafpa Gear)
    SELECT 'SVC-D-2602-0006' as ticket_number, 'PWR-BATT-001' as part_number, 2 UNION ALL
    
    -- 额外维修工单7: 卡口松动维修 (Cinetx)
    SELECT 'SVC-D-2602-0007' as ticket_number, 'MNT-PL-001' as part_number, 1 UNION ALL
    
    -- 额外维修工单8: 传感器清洁后测试 (Cinetx)
    SELECT 'SVC-D-2602-0008' as ticket_number, 'SNS-6K-S35-001' as part_number, 0 UNION ALL -- 仅检测,未更换
    
    -- 额外维修工单9: 多配件维修 (ProAV Berlin)
    SELECT 'SVC-D-2602-0009' as ticket_number, 'MBD-EDGE-001' as part_number, 1 UNION ALL
    SELECT 'SVC-D-2602-0009', 'OPT-LCD-001', 1 UNION ALL
    SELECT 'SVC-D-2602-0009', 'PWR-BATT-001', 1
) rp
JOIN dealer_repairs dr ON dr.ticket_number = rp.ticket_number
JOIN parts_catalog p ON rp.part_number = p.part_number;

-- =============================================================================
-- 7. 数据完整性验证查询 (可选,用于检查)
-- =============================================================================

-- 验证1: 检查各经销商库存总量
-- SELECT d.name, SUM(di.quantity) as total_parts FROM dealer_inventory di JOIN dealers d ON di.dealer_id = d.id GROUP BY d.name;

-- 验证2: 检查低库存预警
-- SELECT d.name, p.part_name, di.quantity, di.reorder_point FROM dealer_inventory di JOIN dealers d ON di.dealer_id = d.id JOIN parts_catalog p ON di.part_id = p.id WHERE di.quantity <= di.reorder_point;

-- 验证3: 检查库存交易平衡
-- SELECT dealer_id, part_id, SUM(quantity) as net_change FROM inventory_transactions GROUP BY dealer_id, part_id;

-- 验证4: 检查补货订单金额计算
-- SELECT ro.order_number, ro.subtotal, SUM(roi.total_price) as calc_subtotal FROM restock_orders ro JOIN restock_order_items roi ON ro.id = roi.order_id GROUP BY ro.id HAVING ro.subtotal != calc_subtotal;

-- =============================================================================
-- 完成
-- =============================================================================
