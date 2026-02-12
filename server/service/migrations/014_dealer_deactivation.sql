-- Migration 014: 经销商停用功能支持
-- 创建时间: 2026-02-11
-- 功能: 支持经销商停用、客户转移、历史追溯

-- 1. 添加停用相关字段到 accounts 表
ALTER TABLE accounts ADD COLUMN deactivated_at DATETIME;
ALTER TABLE accounts ADD COLUMN deactivated_reason TEXT;
ALTER TABLE accounts ADD COLUMN successor_account_id INTEGER REFERENCES accounts(id);

-- 2. 创建客户转移记录表（用于追溯）
CREATE TABLE account_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    from_dealer_id INTEGER REFERENCES accounts(id),
    to_dealer_id INTEGER REFERENCES accounts(id),  -- NULL 表示转为直客
    transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    transferred_by INTEGER REFERENCES users(id),
    reason TEXT,
    transfer_type TEXT CHECK(transfer_type IN ('dealer_to_dealer', 'dealer_to_direct'))
);

-- 3. 创建索引
CREATE INDEX idx_account_transfers_account ON account_transfers(account_id);
CREATE INDEX idx_account_transfers_from_dealer ON account_transfers(from_dealer_id);
CREATE INDEX idx_account_transfers_to_dealer ON account_transfers(to_dealer_id);
CREATE INDEX idx_accounts_deactivated ON accounts(is_active, account_type) WHERE account_type = 'DEALER';

-- 4. 迁移数据：将现有 is_active=0 的经销商记录补充 deactivated_at
UPDATE accounts 
SET deactivated_at = updated_at,
    deactivated_reason = '系统自动迁移：历史停用记录'
WHERE is_active = 0 AND account_type = 'DEALER' AND deactivated_at IS NULL;

-- Migration complete
