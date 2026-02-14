-- =============================================================================
-- Sample Tickets Data - 20 Inquiry + 10 RMA + 9 Dealer Repairs
-- 关联现有经销商(1-3,5-8)和客户(4,9-30)
-- 使用现有产品(1-12)和SN
-- =============================================================================

-- 清空现有工单数据（保留表结构）
DELETE FROM dealer_repair_parts;
DELETE FROM dealer_repairs;
DELETE FROM rma_tickets;
DELETE FROM inquiry_tickets;
DELETE FROM inquiry_ticket_sequences;
DELETE FROM rma_ticket_sequences;
DELETE FROM dealer_repair_sequences;

-- =============================================================================
-- 1. 设置序列号
-- =============================================================================
INSERT INTO inquiry_ticket_sequences (year_month, last_sequence) VALUES ('2601', 20);
INSERT INTO rma_ticket_sequences (channel_code, year_month, last_sequence) VALUES 
    ('D', '2601', 7),
    ('C', '2601', 3);
INSERT INTO dealer_repair_sequences (year_month, last_sequence) VALUES ('2601', 9);

-- =============================================================================
-- 2. 咨询工单 (20条) - 编号 K2601-0001 到 K2601-0020
-- =============================================================================
INSERT INTO inquiry_tickets (
    ticket_number, account_id, contact_id,
    customer_name, customer_contact, customer_id, dealer_id,
    product_id, serial_number, service_type, channel, problem_summary,
    communication_log, resolution, status,
    handler_id, created_by, first_response_at, resolved_at, created_at, updated_at,
    host_device_type, host_device_model, upgraded_to_type, upgraded_to_id, upgraded_at, reopened_at
) VALUES
-- 1-5: 已解决/关闭的咨询
('K2601-0001', 9, 64, 'Netflix Studios', 'cnolan@netflix.com', 9, NULL,
 1, 'ME8K_001', 'Consultation', 'Email', '询问MAVO Edge 8K最新固件KineOS 7.3的升级方法和注意事项',
 '2026-01-05 09:00 - 客户邮件咨询固件升级\n2026-01-05 10:30 - 回复升级步骤和备份建议', 
 '已发送固件升级指南，客户确认升级成功', 'Resolved',
 1, 1, '2026-01-05 10:30', '2026-01-05 16:00', '2026-01-05 09:00', '2026-01-05 16:00',
 NULL, NULL, NULL, NULL, NULL, NULL),

('K2601-0002', 10, 67, 'ARRI Rental', 'mzeiler@arri.de', 10, NULL,
 2, 'ME6K_002', 'Troubleshooting', 'Phone', 'MAVO Edge 6K拍摄时出现间歇性黑屏，怀疑是SDI线缆问题',
 '2026-01-06 14:00 - 接到客户电话描述问题\n2026-01-06 15:30 - 指导客户更换SDI线缆测试',
 '确认SDI线缆接触不良，建议更换官方认证线缆', 'Resolved',
 1, 1, '2026-01-06 15:30', '2026-01-07 10:00', '2026-01-06 14:00', '2026-01-07 10:00'),

('K2601-0003', 4, 56, 'CVP UK', 'tom.wilson@cvp.com', 4, NULL,
 3, 'MM2_003', 'RemoteAssist', 'WeChat', 'MAVO mark2 LF菜单设置问题，无法保存自定义预设',
 '2026-01-08 11:00 - 微信视频远程协助\n2026-01-08 11:45 - 指导恢复出厂设置并重新配置',
 '问题解决，客户已能正常保存预设', 'Resolved',
 2, 2, '2026-01-08 11:15', '2026-01-08 14:00', '2026-01-08 11:00', '2026-01-08 14:00'),

('K2601-0004', 1, 48, 'ProAV UK', 'mike.johnson@proav.co.uk', 1, 1,
 4, 'MLF_004', 'Consultation', 'Email', '询问MAVO LF与第三方镜头的兼容性列表',
 '2026-01-09 16:00 - 客户邮件询问\n2026-01-10 09:00 - 发送兼容性列表PDF',
 '已发送最新镜头兼容性列表', 'Resolved',
 1, 1, '2026-01-10 09:00', '2026-01-10 17:00', '2026-01-09 16:00', '2026-01-10 17:00'),

('K2601-0005', 21, 85, '张伟', 'zhangwei@example.com', 21, 5,
 5, 'T4K_005', 'Troubleshooting', 'Phone', 'Terra 4K开机后风扇噪音异常大',
 '2026-01-11 10:00 - 接到客户电话\n2026-01-11 11:00 - 指导清理风扇滤网',
 '清理后噪音恢复正常，建议定期维护', 'Resolved',
 2, 2, '2026-01-11 10:30', '2026-01-11 15:00', '2026-01-11 10:00', '2026-01-11 15:00'),

-- 6-10: 进行中/待反馈
('K2601-0006', 11, 69, 'Panavision London', 'rthompson@panavision.com', 11, NULL,
 6, 'ES_006', 'Consultation', 'Email', 'Eagle SDI寻像器亮度不均匀，咨询是否保修范围内',
 '2026-01-12 13:00 - 收到客户邮件\n2026-01-12 15:00 - 请求提供照片和购买凭证',
 NULL, 'AwaitingFeedback',
 1, 1, '2026-01-12 15:00', NULL, '2026-01-12 13:00', '2026-01-12 15:00'),

('K2601-0007', 2, 51, 'Gafpa Gear', 'hans.mueller@gafpa.de', 2, 2,
 7, 'EH_007', 'Troubleshooting', 'WeChat', 'Eagle HDMI连接后无信号输出',
 '2026-01-13 09:30 - 微信咨询\n2026-01-13 10:00 - 指导检查HDMI设置',
 NULL, 'InProgress',
 2, 2, '2026-01-13 10:00', NULL, '2026-01-13 09:30', '2026-01-13 14:00'),

('K2601-0008', 12, 71, '北京光线传媒', 'zhang@enlightmedia.com', 12, 5,
 8, 'PCB_008', 'RemoteAssist', 'WeChat', 'MC Board 8K安装后无法识别',
 '2026-01-14 14:00 - 微信视频协助\n2026-01-14 15:00 - 发现固件版本不匹配',
 NULL, 'InProgress',
 1, 1, '2026-01-14 14:30', NULL, '2026-01-14 14:00', '2026-01-14 16:00'),

('K2601-0009', 22, 86, 'Michael Jordan', 'mjordan@example.com', 22, 3,
 9, 'BAT_009', 'Consultation', 'Email', 'PD KineBAT 75电池续航时间咨询',
 '2026-01-15 11:00 - 邮件咨询',
 NULL, 'InProgress',
 2, 2, '2026-01-15 14:00', NULL, '2026-01-15 11:00', '2026-01-15 14:00'),

('K2601-0010', 13, 73, '上海东方传媒', 'wangxm@smg.cn', 13, 6,
 10, 'ME8K_010', 'Troubleshooting', 'Phone', 'MAVO Edge 8K拍摄4K120p时过热关机',
 '2026-01-16 15:00 - 电话咨询过热问题',
 NULL, 'AwaitingFeedback',
 1, 1, '2026-01-16 16:00', NULL, '2026-01-16 15:00', '2026-01-16 18:00'),

-- 11-15: 已升级
('K2601-0011', 14, 75, 'Wanda Pictures', 'wangjl@wandapictures.com', 14, 6,
 1, 'ME8K_001', 'Complaint', 'Email', '新机开箱CMOS有坏点，要求换新',
 '2026-01-17 10:00 - 收到投诉邮件\n2026-01-17 12:00 - 确认坏点问题，建议升级RMA',
 '已升级至RMA返厂单处理', 'Upgraded',
 1, 1, '2026-01-17 12:00', NULL, '2026-01-17 10:00', '2026-01-17 14:00'),

('K2601-0012', 3, 53, '1SourceVideo', 'john.smith@1sourcevideo.com', 3, 3,
 2, 'ME6K_002', 'Troubleshooting', 'Phone', 'MAVO Edge 6K录制时频繁掉帧',
 '2026-01-18 09:00 - 电话描述问题\n2026-01-18 11:00 - 初步判断存储卡问题，但客户已换卡仍有问题',
 '建议升级RMA返厂检测', 'Upgraded',
 2, 2, '2026-01-18 10:00', NULL, '2026-01-18 09:00', '2026-01-18 14:00'),

('K2601-0013', 23, 87, '山田太郎', 'yamada@example.jp', 23, 7,
 3, 'MM2_003', 'Troubleshooting', 'Email', 'MAVO mark2 LF无法开机，电源指示灯不亮',
 '2026-01-19 08:00 - 邮件描述故障\n2026-01-19 10:00 - 远程诊断无法解决',
 '建议升级RMA返厂维修', 'Upgraded',
 1, 1, '2026-01-19 10:30', NULL, '2026-01-19 08:00', '2026-01-19 12:00'),

('K2601-0014', 15, 101, 'Sony Pictures', 'tvinciquerra@sonypictures.com', 15, 3,
 11, 'ME8K_011', 'Complaint', 'Email', '购买3个月内出现3次相同故障，要求彻底检修',
 '2026-01-20 14:00 - 收到客户投诉\n2026-01-20 16:00 - 确认历史维修记录',
 '升级至RMA返厂进行全面检测', 'Upgraded',
 1, 1, '2026-01-20 16:00', NULL, '2026-01-20 14:00', '2026-01-20 17:00'),

('K2601-0015', 7, 61, 'RMK Australia', 'james.wilson@rmk.com.au', 7, 7,
 12, 'ME6K_012', 'Troubleshooting', 'Phone', '客户反馈相机快门按钮失灵',
 '2026-01-21 11:00 - 电话描述问题\n2026-01-21 13:00 - 远程指导无效',
 '建议升级RMA返厂更换快门组件', 'Upgraded',
 2, 2, '2026-01-21 12:00', NULL, '2026-01-21 11:00', '2026-01-21 15:00'),

-- 16-20: 其他状态
('K2601-0016', 24, 88, 'Jean Pierre', 'jpierre@example.fr', 24, 8,
 4, 'MLF_004', 'Consultation', 'Email', '询问MAVO LF二手市场价格评估',
 '2026-01-22 10:00 - 邮件咨询',
 '已回复二手市场参考价格', 'AutoClosed',
 1, 1, '2026-01-22 14:00', '2026-01-25 10:00', '2026-01-22 10:00', '2026-01-25 10:00'),

('K2601-0017', 16, 102, 'BBC Studios', 'john.smith@bbc.co.uk', 16, 1,
 5, 'T4K_005', 'RemoteAssist', 'WeChat', 'Terra 4K色彩科学设置指导',
 '2026-01-23 15:00 - 微信视频协助设置',
 '已完成色彩科学配置指导', 'Resolved',
 2, 2, '2026-01-23 15:30', '2026-01-23 17:00', '2026-01-23 15:00', '2026-01-23 17:00'),

('K2601-0018', 25, 89, '李明', 'liming@example.com', 25, 2,
 6, 'ES_006', 'Consultation', 'Phone', 'Eagle SDI与第三方监视器兼容性咨询',
 '2026-01-24 09:00 - 电话咨询',
 NULL, 'InProgress',
 1, 1, '2026-01-24 10:00', NULL, '2026-01-24 09:00', '2026-01-24 12:00'),

('K2601-0019', 17, 103, 'NHK Japan', 'yamada@nhk.or.jp', 17, 7,
 7, 'EH_007', 'Troubleshooting', 'Email', 'Eagle HDMI色彩显示偏色',
 '2026-01-25 13:00 - 邮件描述问题\n2026-01-26 10:00 - 请求提供测试截图',
 NULL, 'AwaitingFeedback',
 2, 2, '2026-01-26 10:00', NULL, '2026-01-25 13:00', '2026-01-26 11:00'),

('K2601-0020', 26, 90, 'Emma Watson', 'Emma Watson', 'ewatson@example.co.uk', 26, 1,
 8, 'PCB_008', 'Consultation', 'Email', 'MC Board 8K固件回滚方法咨询',
 '2026-01-26 16:00 - 邮件咨询',
 '已发送固件回滚指南', 'Resolved',
 1, 1, '2026-01-27 09:00', '2026-01-27 15:00', '2026-01-26 16:00', '2026-01-27 15:00');

-- =============================================================================
-- 3. RMA返厂单 (10条) - 编号 RMA-D-2601-0001 到 RMA-D-2601-0007 和 RMA-C-2601-0001 到 RMA-C-2601-0003
-- =============================================================================
INSERT INTO rma_tickets (
    ticket_number, channel_code, issue_type, issue_category, issue_subcategory, severity,
    product_id, serial_number, firmware_version, hardware_version,
    problem_description, solution_for_customer, is_warranty,
    repair_content, problem_analysis,
    reporter_name, customer_id, dealer_id, submitted_by, assigned_to, inquiry_ticket_id,
    payment_channel, payment_amount, payment_date,
    status, repair_priority, feedback_date, received_date, completed_date,
    created_at, updated_at
) VALUES
-- 经销商渠道 RMA (7条)
('RMA-D-2601-0001', 'D', 'CustomerReturn', 'Image', 'DeadPixels', 2,
 1, 'ME8K_001', 'KineOS 7.2', 'Rev C',
 '新机开箱发现CMOS有3个坏点，位置在画面中央区域，影响拍摄质量',
 '确认坏点问题，安排换新机', 1,
 '更换CMOS传感器模块，执行坏点映射校准', '出厂检测疏漏导致坏点未被发现',
 '王健林', 14, 6, 1, 3, 11,
 NULL, 0, NULL,
 'Completed', 'R1', '2026-01-17', '2026-01-19', '2026-01-20',
 '2026-01-17 14:00', '2026-01-20 16:00'),

('RMA-D-2601-0002', 'D', 'CustomerReturn', 'Recording', 'FrameDrop', 2,
 2, 'ME6K_002', 'KineOS 7.3', 'Rev B',
 '录制4K60p时频繁掉帧，已排除存储卡问题，怀疑主板问题',
 '返厂检测主板，确认故障后维修', 1,
 '更换主板数据接口芯片，升级散热垫', '主板数据接口芯片虚焊导致传输不稳定',
 'John Smith', 3, 3, 2, 3, 12,
 NULL, 0, NULL,
 'Completed', 'R2', '2026-01-18', '2026-01-20', '2026-01-23',
 '2026-01-18 14:00', '2026-01-23 15:00'),

('RMA-D-2601-0003', 'D', 'CustomerReturn', 'Power', 'NoPower', 1,
 3, 'MM2_003', 'KineOS 7.1', 'Rev A',
 '无法开机，电源指示灯不亮，电池和适配器均无法供电',
 '紧急返厂维修，预计3个工作日', 1,
 '更换电源管理IC，修复电源板短路点', '电源管理IC击穿导致短路',
 '山田太郎', 23, 7, 1, 4, 13,
 NULL, 0, NULL,
 'InRepair', 'R1', '2026-01-19', '2026-01-21', NULL,
 '2026-01-19 12:00', '2026-01-21 10:00'),

('RMA-D-2601-0004', 'D', 'CustomerReturn', 'Mechanical', 'ShutterButton', 2,
 12, 'ME6K_012', 'KineOS 7.3', 'Rev C',
 '快门按钮按下无反应，无法正常触发录制',
 '返厂更换快门组件', 1,
 NULL, NULL,
 'James Wilson', 7, 7, 2, 4, 15,
 NULL, 0, NULL,
 'Pending', 'R2', '2026-01-21', NULL, NULL,
 '2026-01-21 15:00', '2026-01-21 15:00'),

('RMA-D-2601-0005', 'D', 'CustomerReturn', 'Image', 'ColorShift', 3,
 11, 'ME8K_011', 'KineOS 7.2', 'Rev B',
 '画面偏色严重，白色平衡无法校准',
 '返厂校准色彩', 0,
 '重新校准色彩矩阵，更新LUT', '色彩校准数据丢失',
 'Tony Vinciquerra', 15, 3, 1, 3, 14,
 'BankTransfer', 280.00, '2026-01-22',
 'Completed', 'R3', '2026-01-20', '2026-01-22', '2026-01-25',
 '2026-01-20 17:00', '2026-01-25 14:00'),

('RMA-D-2601-0006', 'D', 'InternalSample', 'EVF', 'NoSignal', 2,
 6, 'ES_006', 'N/A', 'Rev A',
 '寻像器无信号输出，内部测试样品',
 '内部维修', 1,
 '更换SDI输出模块', 'SDI芯片损坏',
 '内部测试', NULL, 1, 3, 4, NULL,
 NULL, 0, NULL,
 'Completed', 'R2', '2026-01-10', '2026-01-11', '2026-01-13',
 '2026-01-10 09:00', '2026-01-13 16:00'),

('RMA-D-2601-0007', 'D', 'Shipping', 'Mechanical', 'LensMount', 3,
 4, 'MLF_004', 'KineOS 6.8', 'Rev A',
 '运输过程中镜头卡口变形，无法安装镜头',
 '返厂更换卡口', 0,
 '更换PL卡口组件，重新校准法兰距', '运输冲击导致卡口变形',
 '物流异常', NULL, 2, 2, 3, NULL,
 'CreditCard', 450.00, '2026-01-15',
 'Completed', 'R3', '2026-01-12', '2026-01-15', '2026-01-18',
 '2026-01-12 10:00', '2026-01-18 11:00'),

-- 客户直邮 RMA (3条)
('RMA-C-2601-0001', 'C', 'CustomerReturn', 'Image', 'NoisePattern', 2,
 10, 'ME8K_010', 'KineOS 7.3', 'Rev C',
 '高ISO下出现固定噪点图案，影响低光拍摄',
 '返厂检测传感器', 1,
 '清洁传感器，更新降噪算法', '传感器微尘导致固定噪点',
 '王小明', 13, NULL, 1, 4, NULL,
 NULL, 0, NULL,
 'Completed', 'R2', '2026-01-15', '2026-01-17', '2026-01-20',
 '2026-01-15 11:00', '2026-01-20 14:00'),

('RMA-C-2601-0002', 'C', 'CustomerReturn', 'Audio', 'NoAudio', 2,
 5, 'T4K_005', 'KineOS 6.5', 'Rev B',
 '录制无音频，音频电平显示正常但回放无声',
 '返厂检测音频模块', 1,
 '更换音频编解码芯片', '音频编解码芯片故障',
 '张伟', 21, NULL, 2, 4, NULL,
 NULL, 0, NULL,
 'InRepair', 'R2', '2026-01-18', '2026-01-20', NULL,
 '2026-01-18 14:00', '2026-01-20 09:00'),

('RMA-C-2601-0003', 'C', 'Production', 'Power', 'BatteryDrain', 3,
 9, 'BAT_009', 'N/A', 'N/A',
 '电池异常耗电，充满后仅能使用30分钟',
 '检测电池健康状况', 0,
 NULL, NULL,
 'Michael Jordan', 22, NULL, 1, 3, NULL,
 NULL, 0, NULL,
 'Pending', 'R3', '2026-01-22', NULL, NULL,
 '2026-01-22 16:00', '2026-01-22 16:00');

-- =============================================================================
-- 4. 经销商维修单 (9条) - 编号 SVC-2601-0001 到 SVC-2601-0009
-- =============================================================================
INSERT INTO dealer_repairs (
    ticket_number, dealer_id, customer_name, customer_contact, customer_id,
    product_id, serial_number, issue_category, issue_subcategory, problem_description, repair_content,
    inquiry_ticket_id, status, created_at, updated_at
) VALUES
-- ProAV UK (dealer_id=1) - 2条
('SVC-2601-0001', 1, 'BBC Studios', 'john.smith@bbc.co.uk', 16,
 5, 'T4K_005', 'Firmware', 'UpdateIssue', '客户无法完成固件升级，卡在99%', 
 '使用官方工具重新刷写固件，升级成功', 17, 'Completed', '2026-01-23 15:00', '2026-01-23 18:00'),

('SVC-2601-0002', 1, 'Emma Watson', 'ewatson@example.co.uk', 26,
 8, 'PCB_008', 'Firmware', 'Rollback', '客户需要回滚到旧版本固件',
 '执行固件回滚操作，恢复至KineOS 7.1', 20, 'Completed', '2026-01-27 09:00', '2026-01-27 16:00'),

-- Gafpa Gear (dealer_id=2) - 2条
('SVC-2601-0003', 2, '李明', 'liming@example.com', 25,
 6, 'ES_006', 'Compatibility', 'ThirdParty', 'Eagle SDI与第三方监视器兼容性问题',
 '更新监视器EDID配置，调整输出格式', 18, 'InProgress', '2026-01-24 10:00', '2026-01-24 14:00'),

('SVC-2601-0004', 2, '本地租赁公司', 'rental@local.de', NULL,
 7, 'EH_007', 'Settings', 'ColorCalibration', '寻像器色彩显示不准确',
 '使用色彩校准仪重新校准寻像器', NULL, 'Completed', '2026-01-20 11:00', '2026-01-20 15:00'),

-- 1SourceVideo (dealer_id=3) - 2条
('SVC-2601-0005', 3, '独立制片人', 'indie@filmmaker.com', NULL,
 2, 'ME6K_002', 'Accessories', 'BatteryIssue', '第三方电池无法识别',
 '清洁电池触点，更新电池认证列表', NULL, 'Completed', '2026-01-19 14:00', '2026-01-19 17:00'),

('SVC-2601-0006', 3, 'Sony Pictures', 'support@sony.com', 15,
 11, 'ME8K_011', 'Mechanical', 'ButtonRepair', '录制按钮手感异常',
 '清洁并润滑录制按钮机构', NULL, 'Completed', '2026-01-21 09:00', '2026-01-21 12:00'),

-- DP Gadget (dealer_id=5) - 1条
('SVC-2601-0007', 5, '张伟', 'zhangwei@example.com', 21,
 5, 'T4K_005', 'Maintenance', 'FanCleaning', '风扇噪音大，需要清理',
 '拆解清理风扇及散热片灰尘', 5, 'Completed', '2026-01-11 15:00', '2026-01-11 18:00'),

-- Cinetx (dealer_id=6) - 1条
('SVC-2601-0008', 6, '北京光线传媒', 'tech@enlightmedia.com', 12,
 8, 'PCB_008', 'Installation', 'DriverIssue', 'MC Board安装后驱动加载失败',
 '重新安装驱动，更新固件版本匹配', 8, 'InProgress', '2026-01-14 16:00', '2026-01-15 10:00'),

-- RMK Australia (dealer_id=7) - 1条
('SVC-2601-0009', 7, 'NHK Japan', 'tech@nhk.or.jp', 17,
 7, 'EH_007', 'Image', 'ColorShift', 'HDMI输出色彩偏色',
 '调整HDMI输出色彩空间设置', 19, 'AwaitingFeedback', '2026-01-26 11:00', '2026-01-26 14:00');

-- =============================================================================
-- 5. 验证数据
-- =============================================================================
SELECT 'Data insertion completed' as status;

SELECT 'Inquiry Tickets' as table_name, COUNT(*) as count, 
       GROUP_CONCAT(DISTINCT status) as statuses
FROM inquiry_tickets;

SELECT 'RMA Tickets' as table_name, COUNT(*) as count,
       GROUP_CONCAT(DISTINCT status) as statuses,
       GROUP_CONCAT(DISTINCT channel_code) as channels
FROM rma_tickets;

SELECT 'Dealer Repairs' as table_name, COUNT(*) as count,
       GROUP_CONCAT(DISTINCT status) as statuses
FROM dealer_repairs;
