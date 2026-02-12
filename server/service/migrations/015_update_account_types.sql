-- Migration 015: Update Account Types
-- 更新账户类型：CORPORATE/INTERNAL → ORGANIZATION
-- 添加客户类型转换历史记录表

-- 1. 创建账户类型转换历史记录表（如果不存在）
CREATE TABLE IF NOT EXISTS account_type_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    old_type TEXT NOT NULL,
    new_type TEXT NOT NULL,
    converted_by INTEGER REFERENCES users(id),
    converted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_account_type_history_account ON account_type_history(account_id);
CREATE INDEX IF NOT EXISTS idx_account_type_history_converted_at ON account_type_history(converted_at);

-- 3. 记录已转换的账户（用于审计）
INSERT INTO account_type_history (account_id, old_type, new_type, reason)
SELECT id, account_type, 'ORGANIZATION', 'Migration 015: 统一账户类型为 ORGANIZATION'
FROM accounts 
WHERE account_type IN ('CORPORATE', 'INTERNAL');

-- 4. 更新现有账户类型
UPDATE accounts 
SET account_type = 'ORGANIZATION' 
WHERE account_type IN ('CORPORATE', 'INTERNAL');
