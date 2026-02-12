-- Migration 012: Account-Contact Architecture
-- 账户-联系人双层架构数据库迁移
-- 创建新表: accounts, contacts, account_devices
-- 为工单表添加 account_id 和 contact_id 字段

-- 1. 创建账户表 (替代 customers + dealers)
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT UNIQUE,  -- ACC-2026-0001
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('DEALER', 'ORGANIZATION', 'INDIVIDUAL')),
    
    -- 联系信息
    email TEXT,
    phone TEXT,
    country TEXT,
    province TEXT,
    city TEXT,
    address TEXT,
    
    -- 业务属性
    service_tier TEXT DEFAULT 'STANDARD' CHECK(service_tier IN ('STANDARD', 'VIP', 'VVIP', 'BLACKLIST')),
    industry_tags TEXT,  -- JSON array
    credit_limit REAL DEFAULT 0,
    
    -- 经销商特有字段 (当 account_type = 'DEALER' 时)
    dealer_code TEXT,  -- 原 dealers.code
    dealer_level TEXT,  -- tier1/tier2/tier3
    region TEXT,
    can_repair INTEGER DEFAULT 0,
    repair_level TEXT,
    
    -- 关联
    parent_dealer_id INTEGER REFERENCES accounts(id),
    
    -- 状态
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    
    -- 时间戳
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建联系人表
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    
    -- 个人信息
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    wechat TEXT,
    
    -- 职位
    job_title TEXT,
    department TEXT,
    
    -- 偏好
    language_preference TEXT DEFAULT 'zh',
    communication_preference TEXT DEFAULT 'EMAIL',
    
    -- 状态
    status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'PRIMARY')),
    is_primary INTEGER DEFAULT 0,
    
    -- 备注
    notes TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(account_id, email)
);

-- 3. 创建账户设备关联表
CREATE TABLE IF NOT EXISTS account_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    serial_number TEXT NOT NULL,
    
    firmware_version TEXT,
    purchase_date TEXT,
    warranty_until TEXT,
    
    device_status TEXT DEFAULT 'ACTIVE' CHECK(device_status IN ('ACTIVE', 'SOLD', 'RETIRED')),
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(account_id, serial_number)
);

-- 4. 添加新字段到工单表
-- 咨询工单
ALTER TABLE inquiry_tickets ADD COLUMN account_id INTEGER REFERENCES accounts(id);
ALTER TABLE inquiry_tickets ADD COLUMN contact_id INTEGER REFERENCES contacts(id);

-- RMA返厂单
ALTER TABLE rma_tickets ADD COLUMN account_id INTEGER REFERENCES accounts(id);
ALTER TABLE rma_tickets ADD COLUMN contact_id INTEGER REFERENCES contacts(id);

-- 经销商维修单
ALTER TABLE dealer_repairs ADD COLUMN account_id INTEGER REFERENCES accounts(id);
ALTER TABLE dealer_repairs ADD COLUMN contact_id INTEGER REFERENCES contacts(id);

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_dealer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_account_devices_account ON account_devices(account_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_tickets_account ON inquiry_tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_tickets_contact ON inquiry_tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_rma_tickets_account ON rma_tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_rma_tickets_contact ON rma_tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_dealer_repairs_account ON dealer_repairs(account_id);
CREATE INDEX IF NOT EXISTS idx_dealer_repairs_contact ON dealer_repairs(contact_id);

-- 6. 创建账户编号生成触发器
CREATE TABLE IF NOT EXISTS account_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    last_sequence INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year)
);
