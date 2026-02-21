-- Migration 011: Ticket Search Index for Bokeh AI
-- Enable Bokeh to search and reference historical tickets with permission isolation
-- Uses FTS5 (full-text search) instead of vector embeddings for simplicity

-- ============================================
-- 1. Ticket Search Index Table (索引表)
-- ============================================
CREATE TABLE IF NOT EXISTS ticket_search_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Ticket Info
    ticket_type TEXT NOT NULL,  -- 'inquiry', 'rma', 'dealer_repair'
    ticket_id INTEGER NOT NULL,
    ticket_number TEXT NOT NULL,
    
    -- Searchable Content Digest
    title TEXT NOT NULL,  -- Problem summary/title
    description TEXT,  -- Problem description + communication log
    resolution TEXT,  -- Solution/resolution
    tags TEXT,  -- JSON array of tags/keywords
    
    -- Metadata for filtering
    product_model TEXT,
    serial_number TEXT,
    category TEXT,  -- Issue category
    status TEXT,  -- Current status
    
    -- Permission Control
    dealer_id INTEGER,  -- NULL = internal/direct customer ticket
    account_id INTEGER,
    visibility TEXT DEFAULT 'internal',  -- 'internal', 'dealer', 'public'
    
    -- Timeline
    closed_at TEXT,  -- Only index closed tickets
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
<<<<<<< HEAD
    FOREIGN KEY(dealer_id) REFERENCES accounts(id),
=======
    FOREIGN KEY(dealer_id) REFERENCES dealers(id),
>>>>>>> 76dc4ba (wiki editor和知识库导入的修改)
    FOREIGN KEY(account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_tsi_type_id ON ticket_search_index(ticket_type, ticket_id);
CREATE INDEX IF NOT EXISTS idx_tsi_dealer ON ticket_search_index(dealer_id);
<<<<<<< HEAD
CREATE INDEX IF NOT EXISTS idx_tsi_customer ON ticket_search_index(account_id);
=======
CREATE INDEX IF NOT EXISTS idx_tsi_account ON ticket_search_index(account_id);
>>>>>>> 76dc4ba (wiki editor和知识库导入的修改)
CREATE INDEX IF NOT EXISTS idx_tsi_closed ON ticket_search_index(closed_at);
CREATE INDEX IF NOT EXISTS idx_tsi_visibility ON ticket_search_index(visibility);

-- ============================================
-- 2. FTS5 Virtual Table for Full-Text Search
-- ============================================
CREATE VIRTUAL TABLE IF NOT EXISTS ticket_search_fts USING fts5(
    title, description, resolution, tags,
    content='ticket_search_index',
    content_rowid='id'
);

-- ============================================
-- 3. Triggers to Keep FTS in Sync
-- ============================================

-- Insert Trigger
CREATE TRIGGER IF NOT EXISTS ticket_search_ai AFTER INSERT ON ticket_search_index BEGIN
    INSERT INTO ticket_search_fts(rowid, title, description, resolution, tags)
    VALUES (new.id, new.title, new.description, new.resolution, new.tags);
END;

-- Delete Trigger
CREATE TRIGGER IF NOT EXISTS ticket_search_ad AFTER DELETE ON ticket_search_index BEGIN
    INSERT INTO ticket_search_fts(ticket_search_fts, rowid, title, description, resolution, tags)
    VALUES('delete', old.id, old.title, old.description, old.resolution, old.tags);
END;

-- Update Trigger
CREATE TRIGGER IF NOT EXISTS ticket_search_au AFTER UPDATE ON ticket_search_index BEGIN
    INSERT INTO ticket_search_fts(ticket_search_fts, rowid, title, description, resolution, tags)
    VALUES('delete', old.id, old.title, old.description, old.resolution, old.tags);
    INSERT INTO ticket_search_fts(rowid, title, description, resolution, tags)
    VALUES (new.id, new.title, new.description, new.resolution, new.tags);
END;

-- ============================================
-- 4. Helper Functions (via Views)
-- ============================================

-- View: Ready-to-Index Inquiry Tickets
CREATE VIEW IF NOT EXISTS v_inquiry_tickets_ready_for_index AS
SELECT 
    id,
    ticket_number,
<<<<<<< HEAD
    account_id AS customer_id,
=======
    account_id,
>>>>>>> 76dc4ba (wiki editor和知识库导入的修改)
    dealer_id,
    product_id,
    serial_number,
    problem_summary,
    communication_log,
    resolution,
    status,
    resolved_at,
    created_at
FROM inquiry_tickets;

-- View: Ready-to-Index RMA Tickets
CREATE VIEW IF NOT EXISTS v_rma_tickets_ready_for_index AS
SELECT 
    id,
    ticket_number,
<<<<<<< HEAD
    account_id AS customer_id,
=======
    account_id,
>>>>>>> 76dc4ba (wiki editor和知识库导入的修改)
    dealer_id,
    product_id,
    serial_number,
    problem_description,
    problem_analysis,
    repair_content,
    solution_for_customer,
    issue_category,
    status,
    completed_date,
    created_at
FROM rma_tickets;

-- View: Ready-to-Index Dealer Repairs
CREATE VIEW IF NOT EXISTS v_dealer_repairs_ready_for_index AS
SELECT 
    id,
    ticket_number,
<<<<<<< HEAD
    account_id AS customer_id,
=======
    account_id,
>>>>>>> 76dc4ba (wiki editor和知识库导入的修改)
    dealer_id,
    product_id,
    serial_number,
    problem_description,
    repair_content,
    issue_category,
    status,
    created_at,
    updated_at
FROM dealer_repairs
WHERE status = 'Completed';
