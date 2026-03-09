-- Migration: Add PI and Repair Report tables with workflow support
-- Date: 2026-03-08
-- Description: Document workflow system for PI and Repair Reports

-- ============================================
-- 1. PI (Proforma Invoice) Table
-- ============================================
CREATE TABLE IF NOT EXISTS proforma_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pi_number TEXT UNIQUE NOT NULL,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    
    -- Document Status Workflow
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending_review', 'approved', 'rejected', 'published')),
    
    -- Document Content (JSON for flexible structure)
    content TEXT NOT NULL,  -- JSON: {header, customer_info, device_info, items, terms, notes}
    
    -- Financial Summary (denormalized for quick access)
    subtotal REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    
    -- Validity
    valid_until TEXT,
    
    -- Workflow Tracking
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    -- Review Workflow
    submitted_for_review_at TEXT,
    submitted_by INTEGER REFERENCES users(id),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    review_comment TEXT,
    
    -- Publishing
    published_by INTEGER REFERENCES users(id),
    published_at TEXT,
    
    -- Version Control
    version INTEGER DEFAULT 1,
    parent_version_id INTEGER REFERENCES proforma_invoices(id),
    
    -- Soft Delete
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pi_ticket ON proforma_invoices(ticket_id);
CREATE INDEX IF NOT EXISTS idx_pi_status ON proforma_invoices(status);
CREATE INDEX IF NOT EXISTS idx_pi_number ON proforma_invoices(pi_number);

-- ============================================
-- 2. Repair Report Table
-- ============================================
CREATE TABLE IF NOT EXISTS repair_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_number TEXT UNIQUE NOT NULL,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    
    -- Document Status Workflow
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending_review', 'approved', 'rejected', 'published')),
    
    -- Document Content (JSON for flexible structure)
    content TEXT NOT NULL,  -- JSON: {header, device_info, issue_description, diagnosis, repair_process, parts_used, qa_result, warranty_terms}
    
    -- Service Summary
    service_type TEXT,  -- warranty, paid, goodwill
    total_cost REAL DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    
    -- Warranty Info
    warranty_status TEXT,
    repair_warranty_days INTEGER DEFAULT 90,
    
    -- Workflow Tracking
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    -- Review Workflow
    submitted_for_review_at TEXT,
    submitted_by INTEGER REFERENCES users(id),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    review_comment TEXT,
    
    -- Publishing
    published_by INTEGER REFERENCES users(id),
    published_at TEXT,
    
    -- Customer Acknowledgment (optional)
    customer_acknowledged INTEGER DEFAULT 0,
    customer_acknowledged_at TEXT,
    customer_signature_url TEXT,
    
    -- Version Control
    version INTEGER DEFAULT 1,
    parent_version_id INTEGER REFERENCES repair_reports(id),
    
    -- Soft Delete
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_report_ticket ON repair_reports(ticket_id);
CREATE INDEX IF NOT EXISTS idx_report_status ON repair_reports(status);
CREATE INDEX IF NOT EXISTS idx_report_number ON repair_reports(report_number);

-- ============================================
-- 3. Document Audit Log (for tracking all changes)
-- ============================================
CREATE TABLE IF NOT EXISTS document_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_type TEXT NOT NULL CHECK(document_type IN ('pi', 'repair_report')),
    document_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('created', 'updated', 'submitted', 'reviewed', 'approved', 'rejected', 'published', 'deleted')),
    
    -- Actor
    user_id INTEGER REFERENCES users(id),
    user_name TEXT,
    
    -- Change Details
    changes_summary TEXT,  -- JSON of changed fields
    comment TEXT,
    
    -- Timestamp
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_audit_type_id ON document_audit_log(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_doc_audit_action ON document_audit_log(action);

-- ============================================
-- 4. Add references to tickets table
-- ============================================
-- These columns store the active/published document IDs
ALTER TABLE tickets ADD COLUMN active_pi_id INTEGER REFERENCES proforma_invoices(id);
ALTER TABLE tickets ADD COLUMN active_repair_report_id INTEGER REFERENCES repair_reports(id);
