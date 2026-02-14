-- Migration: Update account_type from CORPORATE to ORGANIZATION
-- Reference: Service_PRD.md v0.12.5 - 账户类型更新：CORPORATE → ORGANIZATION
-- Date: 2026-02-13

-- SQLite doesn't support ALTER TABLE for CHECK constraints directly
-- We need to recreate the table

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- 1. Create new table with updated constraint (including all original columns)
CREATE TABLE accounts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT UNIQUE,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('ORGANIZATION', 'INDIVIDUAL', 'DEALER', 'INTERNAL')),
    
    -- 联系信息
    email TEXT,
    phone TEXT,
    country TEXT,
    province TEXT,
    city TEXT,
    address TEXT,
    
    -- 业务属性
    service_tier TEXT DEFAULT 'STANDARD' CHECK(service_tier IN ('STANDARD', 'VIP', 'VVIP', 'BLACKLIST')),
    industry_tags TEXT,
    credit_limit REAL DEFAULT 0,
    
    -- 经销商特有字段
    dealer_code TEXT,
    dealer_level TEXT,
    region TEXT,
    can_repair INTEGER DEFAULT 0,
    repair_level TEXT,
    
    -- 关联
    parent_dealer_id INTEGER REFERENCES accounts_new(id),
    successor_account_id INTEGER REFERENCES accounts_new(id),
    
    -- 状态
    is_active INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    notes TEXT,
    
    -- 停用/删除记录
    deactivated_at DATETIME,
    deactivated_reason TEXT,
    deleted_at DATETIME,
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Copy data from old table, mapping columns explicitly
INSERT INTO accounts_new (
    id, account_number, name, account_type, email, phone, country, province, city, address,
    service_tier, industry_tags, credit_limit, dealer_code, dealer_level, region, can_repair, repair_level,
    parent_dealer_id, successor_account_id, is_active, is_deleted, notes,
    deactivated_at, deactivated_reason, deleted_at, created_at, updated_at
)
SELECT 
    id, account_number, name, account_type, email, phone, country, province, city, address,
    service_tier, industry_tags, credit_limit, dealer_code, dealer_level, region, can_repair, repair_level,
    parent_dealer_id, successor_account_id, is_active, is_deleted, notes,
    deactivated_at, deactivated_reason, deleted_at, created_at, updated_at
FROM accounts;

-- 3. Update existing CORPORATE records to ORGANIZATION
UPDATE accounts_new SET account_type = 'ORGANIZATION' WHERE account_type = 'CORPORATE';

-- 4. Drop old table
DROP TABLE accounts;

-- 5. Rename new table
ALTER TABLE accounts_new RENAME TO accounts;

-- 6. Recreate indexes
CREATE INDEX idx_accounts_type ON accounts(account_type);
CREATE INDEX idx_accounts_parent_dealer ON accounts(parent_dealer_id);
CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_accounts_country_province ON accounts(country, province);
CREATE INDEX idx_accounts_service_tier ON accounts(service_tier);
CREATE INDEX idx_accounts_deactivated ON accounts(is_active, account_type) WHERE account_type = 'DEALER';
CREATE INDEX idx_accounts_deleted ON accounts(is_deleted);

COMMIT;
PRAGMA foreign_keys = ON;

-- Verify the change
SELECT account_type, COUNT(*) as count FROM accounts GROUP BY account_type;
