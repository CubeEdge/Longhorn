-- Dealer Parts Inventory and PI Invoice System
-- Version: 0.3.0
-- Date: 2026-02-02
-- Phase 5: Dealer inventory management and Proforma Invoice

-- ============================================
-- 1. Dealer Parts Inventory
-- ============================================

CREATE TABLE IF NOT EXISTS dealer_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Dealer and Part
    dealer_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    
    -- Stock Levels
    quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0, -- Reserved for pending orders
    available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    
    -- Safety Stock
    min_stock_level INTEGER DEFAULT 0,
    max_stock_level INTEGER,
    reorder_point INTEGER DEFAULT 0,
    
    -- Last Activity
    last_inbound_date DATE,
    last_outbound_date DATE,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(dealer_id) REFERENCES dealers(id),
    FOREIGN KEY(part_id) REFERENCES parts_catalog(id),
    UNIQUE(dealer_id, part_id)
);

CREATE INDEX IF NOT EXISTS idx_dealer_inv_dealer ON dealer_inventory(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_inv_part ON dealer_inventory(part_id);

-- ============================================
-- 2. Inventory Transactions
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Link to inventory
    dealer_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    
    -- Transaction Details
    transaction_type TEXT NOT NULL, -- Inbound/Outbound/Adjustment/Reserve/Release
    quantity INTEGER NOT NULL, -- Positive for in, negative for out
    
    -- Reference
    reference_type TEXT, -- Issue/RestockOrder/Adjustment/PI
    reference_id INTEGER,
    
    -- Balance After
    balance_after INTEGER,
    
    -- Notes
    reason TEXT,
    notes TEXT,
    
    -- Audit
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(dealer_id) REFERENCES dealers(id),
    FOREIGN KEY(part_id) REFERENCES parts_catalog(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_inv_trans_dealer ON inventory_transactions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_inv_trans_date ON inventory_transactions(created_at);

-- ============================================
-- 3. Restock Orders
-- ============================================

CREATE TABLE IF NOT EXISTS restock_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL, -- RO-YYYYMMDD-XXX
    
    -- Dealer
    dealer_id INTEGER NOT NULL,
    
    -- Order Status
    status TEXT DEFAULT 'Draft', -- Draft/Submitted/Approved/Processing/Shipped/Delivered/Cancelled
    
    -- Shipping
    shipping_address TEXT,
    shipping_method TEXT,
    tracking_number TEXT,
    
    -- Totals
    subtotal REAL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    
    -- Dates
    submitted_at DATETIME,
    approved_at DATETIME,
    shipped_at DATETIME,
    delivered_at DATETIME,
    
    -- Notes
    dealer_notes TEXT,
    internal_notes TEXT,
    
    -- Related PI
    pi_id INTEGER, -- Link to proforma invoice
    
    -- Audit
    created_by INTEGER,
    approved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(dealer_id) REFERENCES dealers(id),
    FOREIGN KEY(pi_id) REFERENCES proforma_invoices(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(approved_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_restock_dealer ON restock_orders(dealer_id);
CREATE INDEX IF NOT EXISTS idx_restock_status ON restock_orders(status);

-- ============================================
-- 4. Restock Order Items
-- ============================================

CREATE TABLE IF NOT EXISTS restock_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    
    -- Part
    part_id INTEGER NOT NULL,
    
    -- Quantity
    quantity_requested INTEGER NOT NULL,
    quantity_approved INTEGER,
    quantity_shipped INTEGER,
    
    -- Pricing
    unit_price REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    
    -- Notes
    notes TEXT,
    
    FOREIGN KEY(order_id) REFERENCES restock_orders(id) ON DELETE CASCADE,
    FOREIGN KEY(part_id) REFERENCES parts_catalog(id)
);

CREATE INDEX IF NOT EXISTS idx_roi_order ON restock_order_items(order_id);

-- ============================================
-- 5. Restock Order Sequences
-- ============================================

CREATE TABLE IF NOT EXISTS restock_order_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_key TEXT NOT NULL UNIQUE,
    last_sequence INTEGER DEFAULT 0
);

-- ============================================
-- 6. Proforma Invoices
-- ============================================

CREATE TABLE IF NOT EXISTS proforma_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pi_number TEXT UNIQUE NOT NULL, -- PI-YYYYMMDD-XXX
    
    -- Dealer
    dealer_id INTEGER NOT NULL,
    
    -- Invoice Details
    invoice_date DATE NOT NULL,
    due_date DATE,
    
    -- Billing Info
    bill_to_name TEXT,
    bill_to_address TEXT,
    bill_to_country TEXT,
    
    -- Amounts
    subtotal REAL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    exchange_rate REAL DEFAULT 1,
    
    -- Payment
    payment_terms TEXT, -- Net30/Net60/Prepaid
    payment_status TEXT DEFAULT 'Pending', -- Pending/PartialPaid/Paid/Overdue/Cancelled
    paid_amount REAL DEFAULT 0,
    paid_date DATE,
    
    -- Bank Details
    bank_details TEXT, -- JSON with bank info
    
    -- Status
    status TEXT DEFAULT 'Draft', -- Draft/Sent/Confirmed/Cancelled
    
    -- Notes
    notes TEXT,
    internal_notes TEXT,
    
    -- Audit
    created_by INTEGER,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(dealer_id) REFERENCES dealers(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pi_dealer ON proforma_invoices(dealer_id);
CREATE INDEX IF NOT EXISTS idx_pi_status ON proforma_invoices(status);
CREATE INDEX IF NOT EXISTS idx_pi_payment ON proforma_invoices(payment_status);

-- ============================================
-- 7. PI Line Items
-- ============================================

CREATE TABLE IF NOT EXISTS pi_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pi_id INTEGER NOT NULL,
    
    -- Item Type
    item_type TEXT NOT NULL, -- Part/Service/Shipping/Other
    
    -- Part Reference
    part_id INTEGER,
    
    -- Details
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    
    -- Reference
    restock_order_id INTEGER, -- Link to restock order if applicable
    
    FOREIGN KEY(pi_id) REFERENCES proforma_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(part_id) REFERENCES parts_catalog(id),
    FOREIGN KEY(restock_order_id) REFERENCES restock_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_pili_pi ON pi_line_items(pi_id);

-- ============================================
-- 8. PI Sequences
-- ============================================

CREATE TABLE IF NOT EXISTS pi_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_key TEXT NOT NULL UNIQUE,
    last_sequence INTEGER DEFAULT 0
);

-- ============================================
-- 9. Monthly Settlements
-- ============================================

CREATE TABLE IF NOT EXISTS monthly_settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Period
    dealer_id INTEGER NOT NULL,
    settlement_period TEXT NOT NULL, -- YYYY-MM format
    
    -- Summary
    total_repairs INTEGER DEFAULT 0,
    parts_used_count INTEGER DEFAULT 0,
    parts_used_value REAL DEFAULT 0,
    
    -- Settlement Status
    status TEXT DEFAULT 'Pending', -- Pending/Calculated/Approved/Settled
    
    -- Generated PI
    pi_id INTEGER,
    
    -- Audit
    calculated_at DATETIME,
    approved_at DATETIME,
    approved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(dealer_id) REFERENCES dealers(id),
    FOREIGN KEY(pi_id) REFERENCES proforma_invoices(id),
    FOREIGN KEY(approved_by) REFERENCES users(id),
    UNIQUE(dealer_id, settlement_period)
);

CREATE INDEX IF NOT EXISTS idx_settlement_dealer ON monthly_settlements(dealer_id);
CREATE INDEX IF NOT EXISTS idx_settlement_period ON monthly_settlements(settlement_period);

-- ============================================
-- 10. Extended System Dictionaries for Phase 5
-- ============================================

INSERT OR IGNORE INTO system_dictionaries (dict_type, dict_key, dict_value, sort_order) VALUES
-- Restock Order Status
('restock_status', 'Draft', '草稿', 1),
('restock_status', 'Submitted', '已提交', 2),
('restock_status', 'Approved', '已批准', 3),
('restock_status', 'Processing', '处理中', 4),
('restock_status', 'Shipped', '已发货', 5),
('restock_status', 'Delivered', '已送达', 6),
('restock_status', 'Cancelled', '已取消', 7),

-- PI Status
('pi_status', 'Draft', '草稿', 1),
('pi_status', 'Sent', '已发送', 2),
('pi_status', 'Confirmed', '已确认', 3),
('pi_status', 'Cancelled', '已取消', 4),

-- Payment Status
('payment_status', 'Pending', '待付款', 1),
('payment_status', 'PartialPaid', '部分付款', 2),
('payment_status', 'Paid', '已付款', 3),
('payment_status', 'Overdue', '逾期', 4),
('payment_status', 'Cancelled', '已取消', 5),

-- Payment Terms
('payment_terms', 'Prepaid', '预付', 1),
('payment_terms', 'Net30', 'Net 30', 2),
('payment_terms', 'Net60', 'Net 60', 3),
('payment_terms', 'Net90', 'Net 90', 4),

-- Transaction Types
('inv_transaction_type', 'Inbound', '入库', 1),
('inv_transaction_type', 'Outbound', '出库', 2),
('inv_transaction_type', 'Adjustment', '调整', 3),
('inv_transaction_type', 'Reserve', '预留', 4),
('inv_transaction_type', 'Release', '释放', 5);
