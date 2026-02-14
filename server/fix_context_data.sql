-- =============================================================================
-- 修复客户上下文数据
-- =============================================================================

-- 1. 为所有有工单的客户创建设备资产记录
INSERT OR IGNORE INTO account_devices (account_id, product_id, serial_number, firmware_version, purchase_date, warranty_until, device_status, created_at) VALUES
-- NHK Japan (account_id=17) - 对应工单 K2601-0019
(17, 7, 'EH_007', 'KineOS 7.2', '2025-06-15', '2027-06-15', 'ACTIVE', CURRENT_TIMESTAMP),

-- Emma Watson (account_id=26) - 对应工单 SVC-2601-0002
(26, 8, 'PCB_008', 'KineOS 7.1', '2025-08-20', '2027-08-20', 'ACTIVE', CURRENT_TIMESTAMP),

-- Netflix (account_id=9)
(9, 1, 'ME8K_001', 'KineOS 7.3', '2025-03-10', '2027-03-10', 'ACTIVE', CURRENT_TIMESTAMP),

-- ARRI Rental (account_id=10)
(10, 2, 'ME6K_002', 'KineOS 7.3', '2025-04-05', '2027-04-05', 'ACTIVE', CURRENT_TIMESTAMP),

-- CVP UK (account_id=4)
(4, 3, 'MM2_003', 'KineOS 7.2', '2025-05-12', '2027-05-12', 'ACTIVE', CURRENT_TIMESTAMP),

-- 张伟 (account_id=21)
(21, 5, 'T4K_005', 'KineOS 6.8', '2024-11-20', '2026-11-20', 'ACTIVE', CURRENT_TIMESTAMP),

-- Wanda Pictures (account_id=14)
(14, 1, 'ME8K_001', 'KineOS 7.2', '2025-12-01', '2027-12-01', 'ACTIVE', CURRENT_TIMESTAMP),

-- 1SourceVideo (account_id=3)
(3, 2, 'ME6K_002', 'KineOS 7.3', '2025-07-15', '2027-07-15', 'ACTIVE', CURRENT_TIMESTAMP),

-- Panavision London (account_id=11)
(11, 6, 'ES_006', 'KineOS 7.2', '2025-02-10', '2027-02-10', 'ACTIVE', CURRENT_TIMESTAMP),

-- Gafpa Gear (account_id=2)
(2, 7, 'EH_007', 'KineOS 7.1', '2025-01-20', '2027-01-20', 'ACTIVE', CURRENT_TIMESTAMP),

-- 北京光线传媒 (account_id=12)
(12, 8, 'PCB_008', 'KineOS 7.0', '2024-09-15', '2026-09-15', 'ACTIVE', CURRENT_TIMESTAMP),

-- Michael Jordan (account_id=22)
(22, 9, 'BAT_009', 'N/A', '2025-05-01', '2027-05-01', 'ACTIVE', CURRENT_TIMESTAMP),

-- 上海东方传媒 (account_id=13)
(13, 10, 'ME8K_010', 'KineOS 7.3', '2025-04-20', '2027-04-20', 'ACTIVE', CURRENT_TIMESTAMP),

-- Sony Pictures (account_id=15)
(15, 11, 'ME8K_011', 'KineOS 7.2', '2025-03-01', '2027-03-01', 'ACTIVE', CURRENT_TIMESTAMP),

-- RMK Australia (account_id=7)
(7, 12, 'ME6K_012', 'KineOS 7.3', '2025-06-01', '2027-06-01', 'ACTIVE', CURRENT_TIMESTAMP),

-- BBC Studios (account_id=16)
(16, 5, 'T4K_005', 'KineOS 6.8', '2024-08-10', '2026-08-10', 'ACTIVE', CURRENT_TIMESTAMP),

-- 李明 (account_id=25)
(25, 6, 'ES_006', 'KineOS 7.2', '2025-02-28', '2027-02-28', 'ACTIVE', CURRENT_TIMESTAMP),

-- Jean Pierre (account_id=24)
(24, 4, 'MLF_004', 'KineOS 6.8', '2024-07-15', '2026-07-15', 'ACTIVE', CURRENT_TIMESTAMP);

-- 2. 验证数据
SELECT 'Account devices created: ' || COUNT(*) FROM account_devices;

-- 3. 检查 contacts 数据是否完整
SELECT 'Contacts count: ' || COUNT(*) FROM contacts;

-- 4. 显示关键客户的设备
SELECT a.name as account_name, p.model_name, ad.serial_number
FROM account_devices ad
JOIN accounts a ON ad.account_id = a.id
JOIN products p ON ad.product_id = p.id
WHERE a.id IN (17, 26, 9, 10)
ORDER BY a.name;
