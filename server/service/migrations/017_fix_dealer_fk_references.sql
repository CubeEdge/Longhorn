-- Migration: Fix dealer_repairs foreign key references
-- Change dealer_id FK from dealers(id) to accounts(id)

-- SQLite doesn't support ALTER TABLE DROP CONSTRAINT
-- So we need to recreate the table

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- Create new table with correct FK
CREATE TABLE dealer_repairs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,
    
    -- Dealer Info (now references accounts)
    dealer_id INTEGER REFERENCES accounts(id) NOT NULL,
    
    -- Customer Info
    customer_name TEXT,
    customer_contact TEXT,
    customer_id INTEGER REFERENCES customers(id),
    account_id INTEGER REFERENCES accounts(id),
    contact_id INTEGER REFERENCES contacts(id),
    
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
    status TEXT DEFAULT 'Completed',
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Copy data
INSERT INTO dealer_repairs_new SELECT * FROM dealer_repairs;

-- Drop old table
DROP TABLE dealer_repairs;

-- Rename new table
ALTER TABLE dealer_repairs_new RENAME TO dealer_repairs;

-- Recreate indexes
CREATE INDEX idx_dealer_repairs_dealer ON dealer_repairs(dealer_id);
CREATE INDEX idx_dealer_repairs_account ON dealer_repairs(account_id);
CREATE INDEX idx_dealer_repairs_contact ON dealer_repairs(contact_id);

-- Same fix for rma_tickets
CREATE TABLE rma_tickets_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,
    
    -- Channel Info
    channel_code TEXT DEFAULT 'D',
    
    -- Issue Classification
    issue_type TEXT,
    issue_category TEXT,
    issue_subcategory TEXT,
    severity INTEGER DEFAULT 3,
    
    -- Product Info
    product_id INTEGER REFERENCES products(id),
    serial_number TEXT,
    firmware_version TEXT,
    hardware_version TEXT,
    
    -- Problem & Solution
    problem_description TEXT NOT NULL,
    solution_for_customer TEXT,
    is_warranty INTEGER DEFAULT 1,
    
    -- Repair Info
    repair_content TEXT,
    problem_analysis TEXT,
    
    -- People (FK to accounts, not dealers)
    reporter_name TEXT,
    customer_id INTEGER REFERENCES customers(id),
    dealer_id INTEGER REFERENCES accounts(id),
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
    repair_priority TEXT DEFAULT 'R3',
    feedback_date TEXT,
    received_date TEXT,
    completed_date TEXT,
    
    -- Approval
    approval_status TEXT,
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO rma_tickets_new SELECT * FROM rma_tickets;

DROP TABLE rma_tickets;

ALTER TABLE rma_tickets_new RENAME TO rma_tickets;

-- Recreate indexes
CREATE INDEX idx_rma_tickets_status ON rma_tickets(status);
CREATE INDEX idx_rma_tickets_channel ON rma_tickets(channel_code);
CREATE INDEX idx_rma_tickets_dealer ON rma_tickets(dealer_id);
CREATE INDEX idx_rma_tickets_serial ON rma_tickets(serial_number);

COMMIT;

PRAGMA foreign_keys = ON;
