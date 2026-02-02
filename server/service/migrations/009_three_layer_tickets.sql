-- Migration 009: Inquiry Tickets (咨询工单)
-- Three-Layer Ticket Model - Layer 1
-- ID Format: KYYMM-XXXX (e.g., K2602-0001)

-- Inquiry Tickets Table (咨询工单)
CREATE TABLE IF NOT EXISTS inquiry_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,  -- K2602-0001
    
    -- Customer Info
    customer_name TEXT,
    customer_contact TEXT,
    customer_id INTEGER REFERENCES customers(id),
    dealer_id INTEGER REFERENCES dealers(id),
    
    -- Product Info
    product_id INTEGER REFERENCES products(id),
    serial_number TEXT,
    
    -- Service Content
    service_type TEXT DEFAULT 'Consultation',  -- Consultation/Troubleshooting/RemoteAssist/Complaint
    channel TEXT,  -- Phone/Email/WeChat/WeCom/Facebook/Online
    problem_summary TEXT NOT NULL,
    communication_log TEXT,
    resolution TEXT,
    
    -- Status & Tracking
    status TEXT DEFAULT 'InProgress',  -- InProgress/AwaitingFeedback/Resolved/AutoClosed/Upgraded
    handler_id INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    
    -- Upgrade Info (if upgraded to RMA or SVC)
    upgraded_to_type TEXT,  -- 'rma' or 'svc'
    upgraded_to_id INTEGER,
    upgraded_at TEXT,
    
    -- Timestamps
    first_response_at TEXT,
    resolved_at TEXT,
    reopened_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Inquiry Ticket Sequences (月度序号)
CREATE TABLE IF NOT EXISTS inquiry_ticket_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month TEXT NOT NULL UNIQUE,  -- YYMM format: "2602"
    last_sequence INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inquiry_tickets_status ON inquiry_tickets(status);
CREATE INDEX IF NOT EXISTS idx_inquiry_tickets_handler ON inquiry_tickets(handler_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_tickets_customer ON inquiry_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_tickets_dealer ON inquiry_tickets(dealer_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_tickets_serial ON inquiry_tickets(serial_number);
CREATE INDEX IF NOT EXISTS idx_inquiry_tickets_created ON inquiry_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_inquiry_ticket_sequences_ym ON inquiry_ticket_sequences(year_month);

-- RMA Tickets Table (RMA返厂单) - Rename from issues
-- Note: Keep 'issues' table for backward compatibility, add new structure
CREATE TABLE IF NOT EXISTS rma_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,  -- RMA-D-2602-0001
    
    -- Channel Info
    channel_code TEXT DEFAULT 'D',  -- D=Dealer, C=Customer, I=Internal
    
    -- Issue Classification
    issue_type TEXT,  -- Production/Shipping/CustomerReturn/InternalSample
    issue_category TEXT,
    issue_subcategory TEXT,
    severity INTEGER DEFAULT 3,  -- 1/2/3
    
    -- Product Info
    product_id INTEGER REFERENCES products(id),
    serial_number TEXT,
    firmware_version TEXT,
    hardware_version TEXT,
    
    -- Problem & Solution
    problem_description TEXT NOT NULL,
    solution_for_customer TEXT,
    is_warranty INTEGER DEFAULT 1,
    
    -- Repair Info (filled by production)
    repair_content TEXT,
    problem_analysis TEXT,
    
    -- People
    reporter_name TEXT,
    customer_id INTEGER REFERENCES customers(id),
    dealer_id INTEGER REFERENCES dealers(id),
    submitted_by INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    
    -- Related Inquiry Ticket
    inquiry_ticket_id INTEGER REFERENCES inquiry_tickets(id),
    
    -- Payment
    payment_channel TEXT,
    payment_amount REAL DEFAULT 0,
    payment_date TEXT,
    
    -- Status & Dates
    status TEXT DEFAULT 'Pending',
    repair_priority TEXT DEFAULT 'R3',  -- R1/R2/R3
    feedback_date TEXT,
    received_date TEXT,
    completed_date TEXT,
    
    -- Approval (for dealer submissions in v2.0)
    approval_status TEXT,
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- RMA Ticket Sequences (月度序号, 按渠道分)
CREATE TABLE IF NOT EXISTS rma_ticket_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_code TEXT NOT NULL,  -- D/C/I
    year_month TEXT NOT NULL,  -- YYMM format: "2602"
    last_sequence INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_code, year_month)
);

-- Dealer Repairs Table (经销商维修单)
-- ID Format: SVC-D-YYMM-XXXX
CREATE TABLE IF NOT EXISTS dealer_repairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,  -- SVC-D-2602-0001
    
    -- Dealer Info
    dealer_id INTEGER REFERENCES dealers(id) NOT NULL,
    
    -- Customer Info
    customer_name TEXT,
    customer_contact TEXT,
    customer_id INTEGER REFERENCES customers(id),
    
    -- Product Info
    product_id INTEGER REFERENCES products(id),
    serial_number TEXT,
    
    -- Repair Info
    issue_category TEXT,
    issue_subcategory TEXT,
    problem_description TEXT,
    repair_content TEXT,
    
    -- Related Inquiry Ticket
    inquiry_ticket_id INTEGER REFERENCES inquiry_tickets(id),
    
    -- Status
    status TEXT DEFAULT 'Completed',  -- InProgress/Completed
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Dealer Repair Sequences (月度序号)
CREATE TABLE IF NOT EXISTS dealer_repair_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month TEXT NOT NULL UNIQUE,  -- YYMM format: "2602"
    last_sequence INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Parts Used in Dealer Repairs (配件消耗记录)
CREATE TABLE IF NOT EXISTS dealer_repair_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dealer_repair_id INTEGER REFERENCES dealer_repairs(id) NOT NULL,
    part_id INTEGER REFERENCES parts(id),
    part_name TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_rma_tickets_status ON rma_tickets(status);
CREATE INDEX IF NOT EXISTS idx_rma_tickets_channel ON rma_tickets(channel_code);
CREATE INDEX IF NOT EXISTS idx_rma_tickets_dealer ON rma_tickets(dealer_id);
CREATE INDEX IF NOT EXISTS idx_rma_tickets_serial ON rma_tickets(serial_number);
CREATE INDEX IF NOT EXISTS idx_dealer_repairs_dealer ON dealer_repairs(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_repair_parts_repair ON dealer_repair_parts(dealer_repair_id);
