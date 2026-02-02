-- Service Records System
-- Version: 0.3.0
-- Date: 2026-02-02
-- Phase 1: Basic Service Records

-- ============================================
-- 1. Service Records Table (Lightweight service tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS service_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_number TEXT UNIQUE NOT NULL, -- SR-YYYYMMDD-XXX format
    
    -- Service Mode
    service_mode TEXT NOT NULL DEFAULT 'CustomerService', -- QuickQuery (no record)/CustomerService (creates record)
    
    -- Customer Information
    customer_name TEXT,
    customer_contact TEXT, -- Phone/Email
    customer_id INTEGER, -- Link to customers table if exists
    dealer_id INTEGER, -- For dealer-initiated services
    
    -- Product Information
    product_id INTEGER, -- Link to products table
    product_name TEXT, -- Denormalized for quick access
    serial_number TEXT,
    firmware_version TEXT,
    hardware_version TEXT,
    
    -- Service Details
    service_type TEXT DEFAULT 'Consultation', -- Consultation/TechnicalSupport/WarrantyQuery/RepairRequest/Complaint
    channel TEXT DEFAULT 'Phone', -- Phone/Email/WeChat/Online/InPerson
    problem_summary TEXT NOT NULL,
    problem_category TEXT, -- Links to system_dictionaries
    
    -- Communication Log (JSON array of messages)
    communication_log TEXT DEFAULT '[]',
    
    -- Status & Resolution
    status TEXT DEFAULT 'Created', -- Created/InProgress/WaitingCustomer/Resolved/AutoClosed/UpgradedToTicket
    resolution TEXT,
    resolution_type TEXT, -- Solved/Redirected/UpgradedToTicket/CustomerNoResponse/CannotReproduce
    
    -- Assignment
    handler_id INTEGER, -- Assigned staff
    department TEXT, -- Marketing/Production/RD
    
    -- Time Tracking (Auto-calculated)
    first_response_at DATETIME, -- First staff response time
    resolved_at DATETIME,
    waiting_customer_since DATETIME, -- For auto-close tracking
    
    -- Upgrade to Work Order
    upgraded_to_issue_id INTEGER, -- If converted to work order
    upgrade_reason TEXT,
    
    -- Metadata
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(dealer_id) REFERENCES dealers(id),
    FOREIGN KEY(handler_id) REFERENCES users(id),
    FOREIGN KEY(upgraded_to_issue_id) REFERENCES issues(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_service_records_number ON service_records(record_number);
CREATE INDEX IF NOT EXISTS idx_service_records_customer ON service_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_records_serial ON service_records(serial_number);
CREATE INDEX IF NOT EXISTS idx_service_records_status ON service_records(status);
CREATE INDEX IF NOT EXISTS idx_service_records_handler ON service_records(handler_id);
CREATE INDEX IF NOT EXISTS idx_service_records_dealer ON service_records(dealer_id);
CREATE INDEX IF NOT EXISTS idx_service_records_created ON service_records(created_at);
CREATE INDEX IF NOT EXISTS idx_service_records_waiting ON service_records(waiting_customer_since);

-- ============================================
-- 2. Service Record Comments Table
-- ============================================

CREATE TABLE IF NOT EXISTS service_record_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_record_id INTEGER NOT NULL,
    
    -- Comment Details
    comment_type TEXT DEFAULT 'Staff', -- Staff/Customer/System
    content TEXT NOT NULL,
    
    -- Visibility
    is_internal INTEGER DEFAULT 0, -- 1 = internal note, 0 = visible to customer
    
    -- Attachments (JSON array of file references)
    attachments TEXT DEFAULT '[]',
    
    -- Metadata
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(service_record_id) REFERENCES service_records(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sr_comments_record ON service_record_comments(service_record_id);
CREATE INDEX IF NOT EXISTS idx_sr_comments_type ON service_record_comments(comment_type);

-- ============================================
-- 3. Service Record Sequences
-- ============================================

CREATE TABLE IF NOT EXISTS service_record_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_key TEXT NOT NULL UNIQUE, -- YYYYMMDD format
    last_sequence INTEGER DEFAULT 0
);

-- ============================================
-- 4. Service Record Status History
-- ============================================

CREATE TABLE IF NOT EXISTS service_record_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_record_id INTEGER NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(service_record_id) REFERENCES service_records(id) ON DELETE CASCADE,
    FOREIGN KEY(changed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sr_status_history_record ON service_record_status_history(service_record_id);

-- ============================================
-- 5. Extended System Dictionaries for Service Records
-- ============================================

INSERT OR IGNORE INTO system_dictionaries (dict_type, dict_key, dict_value, sort_order) VALUES
-- Service Types
('service_type', 'Consultation', '咨询', 1),
('service_type', 'TechnicalSupport', '技术支持', 2),
('service_type', 'WarrantyQuery', '保修查询', 3),
('service_type', 'RepairRequest', '维修申请', 4),
('service_type', 'Complaint', '投诉', 5),
('service_type', 'Other', '其他', 6),

-- Service Channels
('service_channel', 'Phone', '电话', 1),
('service_channel', 'Email', '邮件', 2),
('service_channel', 'WeChat', '微信', 3),
('service_channel', 'Online', '在线客服', 4),
('service_channel', 'InPerson', '上门', 5),

-- Service Record Status
('service_record_status', 'Created', '已创建', 1),
('service_record_status', 'InProgress', '处理中', 2),
('service_record_status', 'WaitingCustomer', '待客户反馈', 3),
('service_record_status', 'Resolved', '已解决', 4),
('service_record_status', 'AutoClosed', '自动关闭', 5),
('service_record_status', 'UpgradedToTicket', '已转工单', 6),

-- Resolution Types
('resolution_type', 'Solved', '已解决', 1),
('resolution_type', 'Redirected', '转交处理', 2),
('resolution_type', 'UpgradedToTicket', '升级为工单', 3),
('resolution_type', 'CustomerNoResponse', '客户无响应', 4),
('resolution_type', 'CannotReproduce', '无法复现', 5),

-- Service Modes
('service_mode', 'QuickQuery', '快速查询', 1),
('service_mode', 'CustomerService', '代客户服务', 2);
