-- Repair Management System
-- Version: 0.3.0
-- Date: 2026-02-02
-- Phase 4: Parts pricing, quotation estimation, logistics tracking

-- ============================================
-- 1. Parts Catalog
-- ============================================

CREATE TABLE IF NOT EXISTS parts_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Part Info
    part_number TEXT UNIQUE NOT NULL, -- SKU
    part_name TEXT NOT NULL,
    part_name_en TEXT, -- English name
    description TEXT,
    
    -- Classification
    category TEXT NOT NULL, -- Sensor/Board/Mechanical/Cable/Optical/Accessory
    subcategory TEXT,
    
    -- Applicable Products
    applicable_products TEXT, -- JSON array of product models
    
    -- Pricing (in RMB, used for quotation)
    cost_price REAL DEFAULT 0, -- Internal cost
    retail_price REAL DEFAULT 0, -- Customer price
    dealer_price REAL DEFAULT 0, -- Dealer price
    
    -- Stock Info
    min_stock_level INTEGER DEFAULT 0,
    reorder_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER DEFAULT 7,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    is_sellable INTEGER DEFAULT 1, -- Can be sold separately
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parts_number ON parts_catalog(part_number);
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts_catalog(category);
CREATE INDEX IF NOT EXISTS idx_parts_active ON parts_catalog(is_active);

-- ============================================
-- 2. Repair Quotations
-- ============================================

CREATE TABLE IF NOT EXISTS repair_quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_number TEXT UNIQUE NOT NULL, -- QT-YYYYMMDD-XXX
    
    -- Link to Issue
    issue_id INTEGER NOT NULL,
    
    -- Customer Info (denormalized)
    customer_name TEXT,
    customer_email TEXT,
    
    -- Quotation Details
    diagnosis TEXT, -- Initial diagnosis
    repair_description TEXT, -- What needs to be done
    
    -- Pricing Breakdown
    parts_total REAL DEFAULT 0,
    labor_cost REAL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    other_cost REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    discount_reason TEXT,
    total_amount REAL DEFAULT 0,
    
    -- Currency
    currency TEXT DEFAULT 'RMB',
    exchange_rate REAL DEFAULT 1,
    
    -- Warranty
    is_warranty INTEGER DEFAULT 0,
    warranty_notes TEXT,
    
    -- Status
    status TEXT DEFAULT 'Draft', -- Draft/Sent/Approved/Rejected/Expired
    valid_until DATE, -- Quotation expiry date
    
    -- Customer Response
    customer_response TEXT, -- Approved/Rejected
    customer_notes TEXT,
    responded_at DATETIME,
    
    -- Audit
    created_by INTEGER NOT NULL,
    approved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(issue_id) REFERENCES issues(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(approved_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_quotations_issue ON repair_quotations(issue_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON repair_quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_number ON repair_quotations(quotation_number);

-- ============================================
-- 3. Quotation Line Items
-- ============================================

CREATE TABLE IF NOT EXISTS quotation_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id INTEGER NOT NULL,
    
    -- Item Details
    item_type TEXT NOT NULL, -- Part/Labor/Shipping/Other
    part_id INTEGER, -- Link to parts_catalog if type is Part
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    
    -- Notes
    notes TEXT,
    
    FOREIGN KEY(quotation_id) REFERENCES repair_quotations(id) ON DELETE CASCADE,
    FOREIGN KEY(part_id) REFERENCES parts_catalog(id)
);

CREATE INDEX IF NOT EXISTS idx_qli_quotation ON quotation_line_items(quotation_id);

-- ============================================
-- 4. Quotation Sequences
-- ============================================

CREATE TABLE IF NOT EXISTS quotation_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_key TEXT NOT NULL UNIQUE, -- YYYYMMDD
    last_sequence INTEGER DEFAULT 0
);

-- ============================================
-- 5. Logistics Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS logistics_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Link to Issue
    issue_id INTEGER NOT NULL,
    
    -- Shipment Info
    shipment_type TEXT NOT NULL, -- Inbound/Outbound (customer to us / us to customer)
    carrier TEXT, -- DHL/FedEx/UPS/SF/Other
    tracking_number TEXT,
    
    -- Addresses
    from_address TEXT,
    to_address TEXT,
    
    -- Status
    status TEXT DEFAULT 'Pending', -- Pending/Shipped/InTransit/Delivered/Exception
    shipped_at DATETIME,
    estimated_delivery DATE,
    delivered_at DATETIME,
    
    -- Package Info
    package_count INTEGER DEFAULT 1,
    total_weight REAL, -- in kg
    dimensions TEXT, -- JSON: {length, width, height}
    
    -- Cost
    shipping_cost REAL DEFAULT 0,
    currency TEXT DEFAULT 'RMB',
    
    -- Notes
    notes TEXT,
    exception_reason TEXT,
    
    -- Audit
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(issue_id) REFERENCES issues(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_logistics_issue ON logistics_tracking(issue_id);
CREATE INDEX IF NOT EXISTS idx_logistics_tracking ON logistics_tracking(tracking_number);
CREATE INDEX IF NOT EXISTS idx_logistics_status ON logistics_tracking(status);

-- ============================================
-- 6. Logistics Events (Tracking History)
-- ============================================

CREATE TABLE IF NOT EXISTS logistics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logistics_id INTEGER NOT NULL,
    
    event_time DATETIME NOT NULL,
    location TEXT,
    status TEXT NOT NULL,
    description TEXT,
    
    -- Source
    source TEXT DEFAULT 'Manual', -- Manual/API/Carrier
    raw_data TEXT, -- Original data from carrier API
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(logistics_id) REFERENCES logistics_tracking(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_le_logistics ON logistics_events(logistics_id);

-- ============================================
-- 7. Repair Exceptions
-- ============================================

CREATE TABLE IF NOT EXISTS repair_exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Link to Issue
    issue_id INTEGER NOT NULL,
    
    -- Exception Details
    exception_type TEXT NOT NULL, -- CustomerDelay/PartShortage/TechnicalIssue/QualityIssue/Other
    description TEXT NOT NULL,
    impact TEXT, -- How it affects the repair
    
    -- Status
    status TEXT DEFAULT 'Open', -- Open/InProgress/Resolved/Closed
    resolution TEXT,
    resolved_at DATETIME,
    
    -- Audit
    reported_by INTEGER NOT NULL,
    resolved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(issue_id) REFERENCES issues(id),
    FOREIGN KEY(reported_by) REFERENCES users(id),
    FOREIGN KEY(resolved_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_exceptions_issue ON repair_exceptions(issue_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON repair_exceptions(status);

-- ============================================
-- 8. Labor Rates Configuration
-- ============================================

CREATE TABLE IF NOT EXISTS labor_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    rate_type TEXT NOT NULL, -- Basic/Advanced/Expert
    description TEXT,
    hourly_rate REAL NOT NULL,
    currency TEXT DEFAULT 'RMB',
    
    -- Applicable Region
    region TEXT DEFAULT 'Global', -- Global/Domestic/Overseas
    
    is_active INTEGER DEFAULT 1,
    effective_from DATE,
    effective_to DATE,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. Shipping Rates Configuration
-- ============================================

CREATE TABLE IF NOT EXISTS shipping_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    carrier TEXT NOT NULL,
    service_type TEXT NOT NULL, -- Express/Standard/Economy
    
    -- Region
    from_region TEXT NOT NULL,
    to_region TEXT NOT NULL,
    
    -- Pricing
    base_rate REAL DEFAULT 0,
    per_kg_rate REAL DEFAULT 0,
    currency TEXT DEFAULT 'RMB',
    
    -- Estimated Delivery
    min_days INTEGER,
    max_days INTEGER,
    
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. Extended System Dictionaries for Phase 4
-- ============================================

INSERT OR IGNORE INTO system_dictionaries (dict_type, dict_key, dict_value, sort_order) VALUES
-- Parts Categories
('parts_category', 'Sensor', '传感器', 1),
('parts_category', 'Board', '电路板', 2),
('parts_category', 'Mechanical', '机械件', 3),
('parts_category', 'Cable', '线缆', 4),
('parts_category', 'Optical', '光学件', 5),
('parts_category', 'Accessory', '配件', 6),

-- Quotation Status
('quotation_status', 'Draft', '草稿', 1),
('quotation_status', 'Sent', '已发送', 2),
('quotation_status', 'Approved', '已批准', 3),
('quotation_status', 'Rejected', '已拒绝', 4),
('quotation_status', 'Expired', '已过期', 5),

-- Logistics Status
('logistics_status', 'Pending', '待发货', 1),
('logistics_status', 'Shipped', '已发货', 2),
('logistics_status', 'InTransit', '运输中', 3),
('logistics_status', 'Delivered', '已送达', 4),
('logistics_status', 'Exception', '异常', 5),

-- Carriers
('carrier', 'DHL', 'DHL', 1),
('carrier', 'FedEx', 'FedEx', 2),
('carrier', 'UPS', 'UPS', 3),
('carrier', 'SF', '顺丰', 4),
('carrier', 'ZTO', '中通', 5),
('carrier', 'Other', '其他', 6),

-- Exception Types
('exception_type', 'CustomerDelay', '客户延迟', 1),
('exception_type', 'PartShortage', '配件缺货', 2),
('exception_type', 'TechnicalIssue', '技术问题', 3),
('exception_type', 'QualityIssue', '质量问题', 4),
('exception_type', 'Other', '其他', 5);

-- Insert default labor rates
INSERT OR IGNORE INTO labor_rates (rate_type, description, hourly_rate, region) VALUES
('Basic', '基础维修 (更换配件)', 100, 'Domestic'),
('Advanced', '高级维修 (需要诊断)', 200, 'Domestic'),
('Expert', '专家维修 (复杂问题)', 300, 'Domestic'),
('Basic', 'Basic Repair', 15, 'Overseas'),
('Advanced', 'Advanced Repair', 30, 'Overseas'),
('Expert', 'Expert Repair', 50, 'Overseas');
