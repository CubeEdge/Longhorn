-- =============================================================================
-- 经销商维修工单扩展数据 - 与配件消耗记录配套
-- 版本: 1.0.0
-- 日期: 2026-02-15
-- 
-- 设计原则:
-- 1. 覆盖不同维修类型: 保修期内/保修期外/保养/升级
-- 2. 覆盖不同配件消耗场景: 无消耗/单配件/多配件
-- 3. 与库存数据联动: 配件消耗对应库存扣减
-- 4. 时间分布合理: 2026-01-15 至 2026-02-15
-- =============================================================================

-- 确保序列存在
INSERT OR IGNORE INTO dealer_repair_sequences (year_month, last_sequence) VALUES ('2602', 9);

-- 扩展经销商维修工单数据
INSERT OR IGNORE INTO dealer_repairs (
    ticket_number, dealer_id, product_id, serial_number, customer_name, customer_contact,
    issue_category, issue_subcategory, problem_description, repair_content,
    status, created_at, updated_at
)
VALUES
-- 维修工单4: ProAV Berlin - 主板故障更换 (高价值维修)
('SVC-D-2602-0004', 1,
 (SELECT id FROM products WHERE serial_number = '8624-A001'), '8624-A001',
 'Studio Hamburg', 'tech@studio-hamburg.de',
 'Mainboard', 'Power Failure', 
 '机器无法开机,电源指示灯不亮。客户反映在拍摄现场突然断电后无法重启。经检测为主板电源管理芯片烧毁。',
 '更换核心主板,重新安装固件KineOS 7.2.3,进行完整功能测试。更换电源适配器避免再次损坏。',
 'Completed', '2026-02-01 09:00:00', '2026-02-03 16:00:00'),

-- 维修工单5: Gafpa Gear - 显示屏损坏更换
('SVC-D-2602-0005', 2,
 (SELECT id FROM products WHERE serial_number = '6623-F072'), '6623-F072',
 'Amsterdam Film Academy', 'equipment@afa.nl',
 'LCD', 'Display Damage',
 '机顶LCD显示屏出现亮线和黑块,触摸功能失效。疑似受到外力撞击导致屏幕损坏。',
 '更换LCD显示屏模组,校准触摸层,测试所有显示模式和触摸功能。',
 'Completed', '2026-01-28 10:00:00', '2026-01-30 15:30:00'),

-- 维修工单6: Gafpa Gear - 电池仓腐蚀清洁+更换
('SVC-D-2602-0006', 2,
 (SELECT id FROM products WHERE serial_number = '6624-B088'), '6624-B088',
 'Rotterdam Rental', 'service@rotterdam-rental.nl',
 'Battery', 'Corrosion',
 '电池仓触点氧化腐蚀,导致电池接触不良,经常断电。客户使用环境潮湿导致。',
 '清洁电池仓触点,涂抹防氧化剂,更换两节原厂电池(旧电池已漏液损坏)。',
 'Completed', '2026-02-10 11:00:00', '2026-02-12 14:00:00'),

-- 维修工单7: Cinetx - PL卡口松动维修
('SVC-D-2602-0007', 3,
 (SELECT id FROM products WHERE serial_number = '4522-C012'), '4522-C012',
 'London Camera Exchange', 'repair@lce.co.uk',
 'MountSystem', 'Loose Mount',
 'PL卡口锁紧机构松动,镜头安装后有明显晃动,影响对焦精度。长期使用频繁更换镜头导致磨损。',
 '更换PL卡口模块,重新校准法兰距,测试多款PL镜头兼容性。',
 'Completed', '2026-02-05 13:00:00', '2026-02-07 11:00:00'),

-- 维修工单8: Cinetx - 传感器检测清洁(无配件更换)
('SVC-D-2602-0008', 3,
 (SELECT id FROM products WHERE serial_number = '1523-D045'), '1523-D045',
 'Bristol Productions', 'gear@bristol-prod.co.uk',
 'Sensor', 'Dust Spots',
 '拍摄纯色背景时发现画面中有固定黑点,疑似传感器进灰。',
 '传感器清洁(无配件更换),使用专业清洁棒和试剂,拍摄测试卡确认无灰尘。',
 'Completed', '2026-01-30 09:30:00', '2026-01-30 16:00:00'),

-- 维修工单9: ProAV Berlin - 进水损坏大修(多配件更换)
('SVC-D-2602-0009', 1,
 (SELECT id FROM products WHERE serial_number = 'EVF-2301'), 'EVF-2301',
 'Munich Broadcast', 'tech@munich-broadcast.de',
 'WaterDamage', 'Multiple Failures',
 '机器意外进水,导致主板短路、LCD显示屏损坏、电池无法充电。紧急断电后送修。',
 '全面拆解清洁,更换主板、LCD显示屏、电池。进行48小时老化测试,确认功能完全恢复。',
 'Completed', '2026-02-08 08:00:00', '2026-02-12 18:00:00'),

-- 维修工单10: CineTools - 固件升级失败恢复(无配件)
('SVC-D-2602-0010', 4,
 (SELECT id FROM products WHERE serial_number = '6624-B088'), '6624-B088-002',
 'Paris Studio', 'contact@paris-studio.fr',
 'Firmware', 'Boot Failure',
 '固件升级过程中断电,导致系统无法启动,显示错误代码E-202。',
 '进入恢复模式,重新刷写固件KineOS 7.2.0,恢复出厂设置,重新配置用户预设。',
 'Completed', '2026-02-14 10:00:00', '2026-02-14 15:00:00'),

-- 维修工单11: ProAV Berlin - ND滤镜电机故障(进行中)
('SVC-D-2602-0011', 1,
 (SELECT id FROM products WHERE serial_number = '8624-A001'), '8624-A001-002',
 'Berlin Film School', 'equipment@bfs.de',
 'NDFilter', 'Motor Failure',
 '内置ND滤镜切换时卡顿,有时无法响应指令。电机异响。',
 NULL,
 'InProgress', '2026-02-12 09:00:00', '2026-02-12 17:00:00'),

-- 维修工单12: Gafpa Gear - 卡槽模块更换(待处理)
('SVC-D-2602-0012', 2,
 (SELECT id FROM products WHERE serial_number = '6623-F072'), '6623-F072-002',
 'Dutch Film Fund', 'tech@filmfund.nl',
 'MediaSlot', 'Card Error',
 'CFexpress卡槽频繁报错,无法识别存储卡,已排除卡和固件问题。',
 NULL,
 'Pending', '2026-02-15 08:00:00', '2026-02-15 08:00:00');

-- =============================================================================
-- 维修工单与配件消耗的关联说明
-- =============================================================================

/*
维修工单配件消耗对应关系 (seed_dealer_inventory_complete.sql 中的 dealer_repair_parts):

SVC-D-2602-0002 (已有) -> MNT-EF-001 (EF卡口)
SVC-D-2602-0004 (新增) -> MBD-EDGE-001 (主板) + CBL-PWR-001 (电源线)
SVC-D-2602-0005 (新增) -> OPT-LCD-001 (LCD显示屏) + CBL-FLEX (软排线)
SVC-D-2602-0006 (新增) -> PWR-BATT-001 (电池x2)
SVC-D-2602-0007 (新增) -> MNT-PL-001 (PL卡口)
SVC-D-2602-0008 (新增) -> 无配件 (仅清洁)
SVC-D-2602-0009 (新增) -> MBD-EDGE-001 (主板) + OPT-LCD-001 (LCD) + PWR-BATT-001 (电池)
SVC-D-2602-0010 (新增) -> 无配件 (仅固件恢复)
SVC-D-2602-0011 (新增) -> MAVO-ND-MOTOR (ND电机) - 待补充
SVC-D-2602-0012 (新增) -> MED-CFE-SLOT (卡槽模块) - 待补充

配件消耗触发库存扣减:
- 每个配件消耗记录对应 inventory_transactions 中的一条 Outbound 记录
- 扣减后库存数量更新到 dealer_inventory.quantity
- 库存不足时产生低库存预警
*/

-- =============================================================================
-- 完成
-- =============================================================================
