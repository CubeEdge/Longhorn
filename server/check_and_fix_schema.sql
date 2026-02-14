-- =============================================================================
-- 检查并修复数据库表结构以支持客户上下文 API
-- =============================================================================

-- 1. 检查并添加 account_devices 表缺少的字段
PRAGMA table_info(account_devices);

-- 如果 account_devices 表不存在，创建它
CREATE TABLE IF NOT EXISTS account_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    product_id INTEGER,
    serial_number TEXT,
    firmware_version TEXT,
    purchase_date DATE,
    warranty_until DATE,
    device_status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 检查 products 表字段
PRAGMA table_info(products);

-- 3. 检查 inquiry_tickets 表是否有 account_id 字段
PRAGMA table_info(inquiry_tickets);

-- 4. 检查 rma_tickets 表字段
PRAGMA table_info(rma_tickets);

-- 5. 检查 dealer_repairs 表字段
PRAGMA table_info(dealer_repairs);

-- 6. 添加 inquiry_tickets 缺少的 account_id 字段（如果不存在）
ALTER TABLE inquiry_tickets ADD COLUMN account_id INTEGER;

-- 7. 添加 rma_tickets 缺少的 account_id 字段（如果不存在）
ALTER TABLE rma_tickets ADD COLUMN account_id INTEGER;

-- 8. 添加 dealer_repairs 缺少的 account_id 字段（如果不存在）
ALTER TABLE dealer_repairs ADD COLUMN account_id INTEGER;

-- 9. 同步数据：将 customer_id 复制到 account_id
UPDATE inquiry_tickets SET account_id = customer_id WHERE account_id IS NULL AND customer_id IS NOT NULL;
UPDATE rma_tickets SET account_id = customer_id WHERE account_id IS NULL AND customer_id IS NOT NULL;
UPDATE dealer_repairs SET account_id = customer_id WHERE account_id IS NULL AND customer_id IS NOT NULL;

-- 10. 验证修复结果
SELECT 'inquiry_tickets with account_id:' as check_item, COUNT(*) as count FROM inquiry_tickets WHERE account_id IS NOT NULL;
SELECT 'rma_tickets with account_id:' as check_item, COUNT(*) as count FROM rma_tickets WHERE account_id IS NOT NULL;
SELECT 'dealer_repairs with account_id:' as check_item, COUNT(*) as count FROM dealer_repairs WHERE account_id IS NOT NULL;
SELECT 'account_devices count:' as check_item, COUNT(*) as count FROM account_devices;
