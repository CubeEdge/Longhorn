-- Seed Data for Three-Layer Ticket System
-- Products, Inquiry Tickets (5), RMA Tickets (5), Dealer Repairs (3)

-- =============================================================================
-- 1. Insert Products (Kinefinity Camera Products)
-- =============================================================================
INSERT INTO products (product_line, model_name, serial_number, firmware_version, production_batch, production_date, notes) VALUES
('Camera', 'MAVO Edge 8K', '8624-A001', 'KineOS 7.2.3', 'B2024-12', '2024-12-01', 'Full Frame Cinema Camera'),
('Camera', 'MAVO Edge 6K', '6623-F072', 'KineOS 7.2.0', 'B2023-11', '2023-11-15', 'S35 Cinema Camera'),
('Camera', 'MAVO Edge 6K', '6624-B088', 'KineOS 7.1.12', 'B2024-02', '2024-02-20', 'S35 Cinema Camera'),
('Camera', 'MAVO LF', '4522-C012', 'KineOS 6.5.1', 'B2022-08', '2022-08-10', 'Large Format Cinema Camera'),
('Camera', 'TERRA 4K', '1523-D045', 'KineOS 7.0.8', 'B2023-06', '2023-06-05', 'Compact Cinema Camera'),
('EVF', 'KineEVF', 'EVF-2301', 'v2.1.5', 'E2023-01', '2023-01-20', 'High Resolution Electronic Viewfinder'),
('Accessory', 'KineBack', 'KB-2401', 'v1.0.0', 'A2024-01', '2024-01-15', 'Media Recording Module');

-- =============================================================================
-- 2. Insert Inquiry Ticket Sequences for 2026-02
-- =============================================================================
INSERT OR IGNORE INTO inquiry_ticket_sequences (year_month) VALUES ('2602');
UPDATE inquiry_ticket_sequences SET last_number = 5 WHERE year_month = '2602';

-- =============================================================================
-- 3. Insert 5 Inquiry Tickets (Layer 1: K2602-0001 to K2602-0005)
-- =============================================================================
INSERT INTO inquiry_tickets (
    ticket_number, customer_name, customer_contact, customer_id, dealer_id,
    product_id, serial_number, service_type, channel,
    problem_summary, communication_log, resolution, status,
    handler_id, created_by, first_response_at, created_at, updated_at
) VALUES
-- Ticket 1: 固件升级咨询
('K2602-0001', 'Michael Schmidt', 'michael.schmidt@filmmaker.de', NULL, 1,
 (SELECT id FROM products WHERE serial_number = '8624-A001'), '8624-A001', 'Consultation', 'Email',
 '客户询问MAVO Edge 8K如何升级到最新固件KineOS 7.3，以及升级后是否会影响当前项目设置。',
 '2026-02-01 10:30 - 收到邮件咨询\n2026-02-01 11:15 - 回复固件升级步骤和注意事项',
 '已发送固件升级指南PDF，告知项目设置会保留。', 'Resolved',
 1, 1, datetime('now', '-2 days'), datetime('now', '-2 days'), datetime('now', '-1 day')),

-- Ticket 2: ProRes格式问题
('K2602-0002', 'Emma Johnson', 'emma.j@studioclip.com', NULL, 2,
 (SELECT id FROM products WHERE serial_number = '6623-F072'), '6623-F072', 'Troubleshooting', 'WeCom',
 'Edge 6K录制ProRes 422 HQ时偶尔出现绿帧，固件7.2.0。',
 '2026-02-01 14:00 - 企业微信反馈问题\n2026-02-01 14:30 - 请求提供示例素材\n2026-02-01 16:00 - 收到素材，正在分析',
 NULL, 'InProgress',
 37, 1, datetime('now', '-1 day', '+2 hours'), datetime('now', '-1 day'), datetime('now', '-6 hours')),

-- Ticket 3: SDI输出问题
('K2602-0003', 'James Wilson', 'j.wilson@cinegear.uk', NULL, 3,
 (SELECT id FROM products WHERE serial_number = '6624-B088'), '6624-B088', 'RemoteAssist', 'Phone',
 'SDI输出到导演监视器时画面偶尔闪烁，怀疑是线材问题但换线后仍存在。',
 '2026-02-02 09:00 - 电话接入\n2026-02-02 09:30 - 远程协助检查设置\n2026-02-02 10:00 - 发现是SDI格式设置问题',
 '已远程指导将SDI输出格式从分离式改为嵌入式，问题解决。', 'Resolved',
 37, 1, datetime('now', '-1 day'), datetime('now', '-1 day'), datetime('now', '-12 hours')),

-- Ticket 4: 客户投诉续保问题
('K2602-0004', 'Li Wei', 'liwei@beijingfilm.cn', NULL, NULL,
 (SELECT id FROM products WHERE serial_number = '4522-C012'), '4522-C012', 'Complaint', 'WeChat',
 '客户反映购买的延保服务未在系统中登记，联系多次未解决。',
 '2026-02-02 15:00 - 微信投诉\n2026-02-02 15:30 - 核实购买记录\n2026-02-02 16:00 - 确认系统漏登',
 NULL, 'AwaitingFeedback',
 1, 1, datetime('now', '-12 hours'), datetime('now', '-12 hours'), datetime('now', '-6 hours')),

-- Ticket 5: EVF连接问题
('K2602-0005', 'Sophie Martin', 'sophie@parisproduction.fr', NULL, 4,
 (SELECT id FROM products WHERE serial_number = 'EVF-2301'), 'EVF-2301', 'Troubleshooting', 'Email',
 'KineEVF连接Edge 8K后显示No Signal，但监视器端正常输出。',
 '2026-02-03 08:00 - 收到邮件',
 NULL, 'InProgress',
 11, 1, NULL, datetime('now', '-2 hours'), datetime('now', '-1 hour'));

-- =============================================================================
-- 4. Insert RMA Ticket Sequences for 2026-02
-- =============================================================================
INSERT OR IGNORE INTO rma_ticket_sequences (year_month, channel_code) VALUES ('2602', 'D');
INSERT OR IGNORE INTO rma_ticket_sequences (year_month, channel_code) VALUES ('2602', 'C');
INSERT OR IGNORE INTO rma_ticket_sequences (year_month, channel_code) VALUES ('2602', 'I');
UPDATE rma_ticket_sequences SET last_number = 3 WHERE year_month = '2602' AND channel_code = 'D';
UPDATE rma_ticket_sequences SET last_number = 1 WHERE year_month = '2602' AND channel_code = 'C';
UPDATE rma_ticket_sequences SET last_number = 1 WHERE year_month = '2602' AND channel_code = 'I';

-- =============================================================================
-- 5. Insert 5 RMA Tickets (Layer 2)
-- =============================================================================
INSERT INTO rma_tickets (
    ticket_number, channel_code, issue_type, issue_category, issue_subcategory, severity,
    product_id, serial_number, firmware_version, hardware_version,
    problem_description, solution_for_customer, is_warranty, repair_content, problem_analysis,
    reporter_name, customer_id, dealer_id, submitted_by, assigned_to,
    payment_channel, payment_amount, payment_date, status, repair_priority,
    received_date, created_at, updated_at
) VALUES
-- RMA 1: 经销商渠道，传感器问题
('RMA-D-2602-0001', 'D', 'Hardware', 'Sensor', 'Dead Pixel', 1,
 (SELECT id FROM products WHERE serial_number = '8624-A001'), '8624-A001', 'KineOS 7.2.3', 'Rev.C',
 '传感器右上角区域发现3个聚集坏点，拍摄纯色背景时可见。', '可寄回原厂进行传感器校准或更换。', 1, NULL, NULL,
 'ProAV Berlin', NULL, 1, 1, 37,
 NULL, 0.00, NULL, 'Pending', 'High',
 NULL, datetime('now', '-3 days'), datetime('now', '-1 day')),

-- RMA 2: 经销商渠道，ND滤镜故障
('RMA-D-2602-0002', 'D', 'Hardware', 'ND Filter', 'Motor Failure', 2,
 (SELECT id FROM products WHERE serial_number = '6623-F072'), '6623-F072', 'KineOS 7.2.0', 'Rev.B',
 '内置ND滤镜切换时卡顿，有时无法响应指令。', '需返厂检修ND滤镜电机。', 1, '更换ND滤镜电机组件', '电机老化导致驱动力不足',
 'Gafpa Gear', NULL, 2, 1, 37,
 NULL, 0.00, NULL, 'InRepair', 'Normal',
 date('now', '-5 days'), datetime('now', '-5 days'), datetime('now', '-2 days')),

-- RMA 3: 经销商渠道，主板故障
('RMA-D-2602-0003', 'D', 'Hardware', 'Mainboard', 'Power Issue', 1,
 (SELECT id FROM products WHERE serial_number = '4522-C012'), '4522-C012', 'KineOS 6.5.1', 'Rev.A',
 '开机后3-5分钟自动关机，无论电池或DC供电。', '主板电源管理芯片故障，需返厂维修。', 0, NULL, NULL,
 'Cinetx', NULL, 5, 1, 37,
 'PayPal', 450.00, date('now', '-2 days'), 'Assigned', 'Urgent',
 date('now', '-2 days'), datetime('now', '-4 days'), datetime('now', '-1 day')),

-- RMA 4: 客户直送，SSD卡槽问题
('RMA-C-2602-0001', 'C', 'Hardware', 'Media Slot', 'Connection Issue', 2,
 (SELECT id FROM products WHERE serial_number = '6624-B088'), '6624-B088', 'KineOS 7.1.12', 'Rev.B',
 'CFexpress卡槽接触不良，需要反复插拔才能识别存储卡。', '清洁卡槽或更换卡槽模块。', 1, NULL, NULL,
 'Direct Customer - Tom Lee', NULL, NULL, 1, 11,
 NULL, 0.00, NULL, 'Pending', 'Normal',
 NULL, datetime('now', '-1 day'), datetime('now', '-6 hours')),

-- RMA 5: 内部渠道，测试机返修
('RMA-I-2602-0001', 'I', 'Hardware', 'LCD', 'Display Defect', 3,
 (SELECT id FROM products WHERE serial_number = '1523-D045'), '1523-D045', 'KineOS 7.0.8', 'Rev.C',
 '展示机LCD显示屏边缘出现漏光现象。', '内部测试机，更换LCD模组。', 1, '更换LCD显示模组', '长期展示使用导致背光老化',
 'Internal QA', NULL, NULL, 1, 11,
 NULL, 0.00, NULL, 'Repaired', 'Low',
 date('now', '-10 days'), datetime('now', '-10 days'), datetime('now', '-2 days'));

-- =============================================================================
-- 6. Insert Dealer Repair Sequences for 2026-02
-- =============================================================================
INSERT OR IGNORE INTO dealer_repair_sequences (year_month) VALUES ('2602');
UPDATE dealer_repair_sequences SET last_number = 3 WHERE year_month = '2602';

-- =============================================================================
-- 7. Insert 3 Dealer Repairs (Layer 3)
-- =============================================================================
INSERT INTO dealer_repairs (
    ticket_number, repair_type, product_id, serial_number,
    customer_name, customer_contact, problem_description,
    diagnosis_result, repair_content, received_condition, accessories,
    labor_hours, labor_cost, parts_cost, total_cost, status,
    technician_id, created_by, inquiry_ticket_id,
    received_at, diagnosed_at, completed_at, created_at, updated_at
) VALUES
-- Dealer Repair 1: 清洁保养
('SVC-D-2602-0001', 'Maintenance', 
 (SELECT id FROM products WHERE serial_number = '8624-A001'), '8624-A001',
 'Berlin Film Studio', 'contact@berlinfilm.de', '机器使用一年后进行常规保养和清洁。',
 '外观正常，内部积灰较多，传感器有少量灰点。', '全机清洁，传感器清洁，风扇除尘，固件更新到7.3。', '外观良好，轻微使用痕迹', '原装电池x2, SD卡x1',
 2.0, 200.00, 0.00, 200.00, 'Completed',
 37, 1, NULL,
 datetime('now', '-5 days'), datetime('now', '-4 days'), datetime('now', '-3 days'), datetime('now', '-5 days'), datetime('now', '-3 days')),

-- Dealer Repair 2: 镜头卡口维修
('SVC-D-2602-0002', 'OutOfWarranty',
 (SELECT id FROM products WHERE serial_number = '6623-F072'), '6623-F072',
 'Munich Rental', 'rental@munich-gear.de', '镜头卡口松动，怀疑是长期更换镜头磨损。',
 '卡口固定螺丝松动，卡口环有轻微磨损。', '紧固螺丝，更换卡口密封圈。', '机身有使用痕迹', 'EF转接环',
 1.5, 150.00, 35.00, 185.00, 'Returned',
 11, 1, NULL,
 datetime('now', '-8 days'), datetime('now', '-7 days'), datetime('now', '-5 days'), datetime('now', '-8 days'), datetime('now', '-4 days')),

-- Dealer Repair 3: 固件异常修复
('SVC-D-2602-0003', 'InWarranty',
 (SELECT id FROM products WHERE serial_number = '1523-D045'), '1523-D045',
 'Frankfurt Media', 'tech@frankfurtmedia.de', '固件升级失败后无法开机，显示错误代码E-101。',
 '固件升级中断导致系统分区损坏。', NULL, '无法开机，屏幕显示E-101', '无',
 0.0, 0.00, 0.00, 0.00, 'Diagnosing',
 37, 1, NULL,
 datetime('now', '-1 day'), datetime('now', '-1 day'), NULL, datetime('now', '-1 day'), datetime('now', '-6 hours'));
