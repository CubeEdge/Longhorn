-- Migration 015: Update Account Types (v2)
-- 更新账户类型：CORPORATE/INTERNAL → ORGANIZATION
-- 由于 CHECK 约束限制，需要重建表

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

-- 4. 重建 accounts 表以更新 CHECK 约束
-- 4.1 创建新表
CREATE TABLE accounts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT UNIQUE,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('DEALER', 'ORGANIZATION', 'INDIVIDUAL')),
    email TEXT,
    phone TEXT,
    country TEXT,
    province TEXT,
    city TEXT,
    address TEXT,
    service_tier TEXT DEFAULT 'STANDARD' CHECK(service_tier IN ('STANDARD', 'VIP', 'VVIP', 'BLACKLIST')),
    industry_tags TEXT,
    credit_limit REAL DEFAULT 0,
    dealer_code TEXT,
    dealer_level TEXT,
    region TEXT,
    can_repair INTEGER DEFAULT 0,
    repair_level TEXT,
    parent_dealer_id INTEGER REFERENCES accounts(id),
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 4.2 复制数据（转换类型）
INSERT INTO accounts_new SELECT * FROM accounts;

-- 4.3 更新类型
UPDATE accounts_new 
SET account_type = 'ORGANIZATION' 
WHERE account_type IN ('CORPORATE', 'INTERNAL');

-- 4.4 删除旧表
DROP TABLE accounts;

-- 4.5 重命名新表
ALTER TABLE accounts_new RENAME TO accounts;

-- 4.6 重新创建索引
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_dealer_id);
