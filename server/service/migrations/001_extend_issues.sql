-- Issue Tracker PRD Schema Extension
-- Version: 0.2.0
-- Date: 2026-01-30

-- ============================================
-- 1. Extend issues table with PRD fields
-- ============================================

-- Add RMA and repair tracking fields
ALTER TABLE issues ADD COLUMN rma_number TEXT;
ALTER TABLE issues ADD COLUMN issue_type TEXT DEFAULT 'CustomerReturn'; -- ProductionIssue/ShippingIssue/CustomerReturn/InternalSample
ALTER TABLE issues ADD COLUMN issue_subcategory TEXT; -- Detailed subcategory
ALTER TABLE issues ADD COLUMN serial_number TEXT; -- Product serial number (denormalized for quick access)
ALTER TABLE issues ADD COLUMN firmware_version TEXT;
ALTER TABLE issues ADD COLUMN hardware_version TEXT;

-- Problem & Solution fields (per PRD)
ALTER TABLE issues ADD COLUMN problem_description TEXT;
ALTER TABLE issues ADD COLUMN solution_for_customer TEXT;
ALTER TABLE issues ADD COLUMN is_warranty INTEGER DEFAULT 1;

-- Repair info (Production dept fills)
ALTER TABLE issues ADD COLUMN repair_content TEXT;
ALTER TABLE issues ADD COLUMN problem_analysis TEXT;

-- Reporter info
ALTER TABLE issues ADD COLUMN reporter_name TEXT;
ALTER TABLE issues ADD COLUMN reporter_type TEXT DEFAULT 'Customer'; -- Customer/Dealer/Internal
ALTER TABLE issues ADD COLUMN dealer_id INTEGER;
ALTER TABLE issues ADD COLUMN region TEXT DEFAULT '国内'; -- 国内/国外

-- Payment tracking
ALTER TABLE issues ADD COLUMN payment_channel TEXT; -- 微信/支付宝/对公转账/PayPal/Wire
ALTER TABLE issues ADD COLUMN payment_amount REAL DEFAULT 0;
ALTER TABLE issues ADD COLUMN payment_date DATE;

-- Timestamps
ALTER TABLE issues ADD COLUMN feedback_date DATE;
ALTER TABLE issues ADD COLUMN ship_date DATE;
ALTER TABLE issues ADD COLUMN received_date DATE;
ALTER TABLE issues ADD COLUMN completed_date DATE;

-- External reference
ALTER TABLE issues ADD COLUMN external_link TEXT;

-- Create index for RMA lookup
CREATE INDEX IF NOT EXISTS idx_issues_rma ON issues(rma_number);
CREATE INDEX IF NOT EXISTS idx_issues_serial ON issues(serial_number);
CREATE INDEX IF NOT EXISTS idx_issues_region ON issues(region);
CREATE INDEX IF NOT EXISTS idx_issues_dealer ON issues(dealer_id);

-- ============================================
-- 2. Dealers table (for partner management)
-- ============================================

CREATE TABLE IF NOT EXISTS dealers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    dealer_type TEXT DEFAULT 'FirstTier', -- FirstTier/SecondTier/Direct
    region TEXT DEFAULT '海外', -- 国内/海外
    country TEXT,
    city TEXT,
    contact_person TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    -- Service capabilities
    can_repair INTEGER DEFAULT 0,
    repair_level TEXT, -- SimpleRepair/MediumRepair/FullRepair
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dealers_code ON dealers(code);
CREATE INDEX IF NOT EXISTS idx_dealers_region ON dealers(region);

-- ============================================
-- 3. Production Feedbacks (F0 issues)
-- ============================================

CREATE TABLE IF NOT EXISTS production_feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback_date DATE,
    ship_date DATE,
    category TEXT NOT NULL, -- Production/Shipping/Return/Repair
    severity INTEGER DEFAULT 3, -- 1/2/3
    product_name TEXT,
    serial_number TEXT,
    problem_description TEXT NOT NULL,
    communication_feedback TEXT,
    reporter TEXT,
    responsible_person TEXT,
    order_responsible TEXT,
    remarks TEXT,
    related_issue_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(related_issue_id) REFERENCES issues(id)
);

CREATE INDEX IF NOT EXISTS idx_production_feedbacks_date ON production_feedbacks(feedback_date);
CREATE INDEX IF NOT EXISTS idx_production_feedbacks_severity ON production_feedbacks(severity);

-- ============================================
-- 4. RMA Sequence tracking
-- ============================================

CREATE TABLE IF NOT EXISTS rma_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT NOT NULL,
    channel_code TEXT NOT NULL,
    year INTEGER NOT NULL,
    last_sequence INTEGER DEFAULT 0,
    UNIQUE(product_code, channel_code, year)
);

-- ============================================
-- 5. Extend users for department/role
-- ============================================

ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'Employee'; -- Employee/Dealer/Customer
ALTER TABLE users ADD COLUMN region_responsible TEXT; -- 国内/国外 (for marketing dept)
ALTER TABLE users ADD COLUMN dealer_id INTEGER;

-- ============================================
-- 6. System dictionaries
-- ============================================

CREATE TABLE IF NOT EXISTS system_dictionaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dict_type TEXT NOT NULL,
    dict_key TEXT NOT NULL,
    dict_value TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dict_type, dict_key)
);

-- Insert default dictionaries
INSERT OR IGNORE INTO system_dictionaries (dict_type, dict_key, dict_value, sort_order) VALUES
-- Issue Types
('issue_type', 'ProductionIssue', '生产问题', 1),
('issue_type', 'ShippingIssue', '发货问题', 2),
('issue_type', 'CustomerReturn', '客户返修', 3),
('issue_type', 'InternalSample', '内部样机', 4),

-- Issue Categories
('issue_category', 'Stability', '稳定性', 1),
('issue_category', 'Material', '素材', 2),
('issue_category', 'Monitor', '监看', 3),
('issue_category', 'SSD', 'SSD', 4),
('issue_category', 'Audio', '音频', 5),
('issue_category', 'Compatibility', '兼容性', 6),
('issue_category', 'Timecode', '时码', 7),
('issue_category', 'Hardware', '硬件/结构', 8),

-- Severity Levels
('severity', '1', '1级 - 严重错误+严重后果', 1),
('severity', '2', '2级 - 严重错误+无严重后果', 2),
('severity', '3', '3级 - 一般问题', 3),

-- Payment Channels
('payment_channel', 'Wechat', '微信', 1),
('payment_channel', 'Alipay', '支付宝', 2),
('payment_channel', 'BankTransfer', '对公转账', 3),
('payment_channel', 'PayPal', 'PayPal', 4),
('payment_channel', 'Wire', 'Wire Transfer', 5),

-- Regions
('region', 'Domestic', '国内', 1),
('region', 'Overseas', '国外', 2),

-- RMA Product Codes
('rma_product_code', '09', '电影机', 1),
('rma_product_code', '10', 'Eagle', 2),
('rma_product_code', '11', '配件', 3),

-- RMA Channel Codes
('rma_channel_code', '01', '国内', 1),
('rma_channel_code', '02', '海外-ProAV', 2),
('rma_channel_code', '03', '海外-Gafpa', 3),
('rma_channel_code', '04', '海外-EUOffice', 4),
('rma_channel_code', '05', '海外-1SV', 5);

-- Insert default dealers (from PRD reference)
INSERT OR IGNORE INTO dealers (name, code, dealer_type, region, country, can_repair, repair_level) VALUES
('ProAV Berlin', 'PROAV', 'FirstTier', '海外', 'Germany', 1, 'SimpleRepair'),
('Gafpa Gear', 'GAFPA', 'FirstTier', '海外', 'USA', 1, 'MediumRepair'),
('EU Office', 'EUOFFICE', 'Direct', '海外', 'Netherlands', 1, 'FullRepair'),
('1SV', '1SV', 'FirstTier', '海外', 'USA', 0, NULL),
('Cinetx', 'CINETX', 'FirstTier', '海外', 'USA', 1, 'SimpleRepair'),
('RMK', 'RMK', 'FirstTier', '海外', 'Russia', 0, NULL),
('DP Gadget', 'DPGADGET', 'FirstTier', '海外', 'Thailand', 0, NULL);
