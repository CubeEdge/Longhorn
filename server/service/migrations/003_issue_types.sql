-- Issue Types Extension
-- Version: 0.3.0
-- Date: 2026-02-02
-- Phase 1: Work Order Types (Local Repair vs Return Repair)

-- ============================================
-- 1. Extend Issues Table with Ticket Type Support
-- ============================================

-- Ticket Type: Distinguish between local repair (LR) and return repair (IS)
ALTER TABLE issues ADD COLUMN ticket_type TEXT DEFAULT 'IS'; -- LR (Local Repair) / IS (Internal Service/Return)

-- Issue Number Format: LR-YYYYMMDD-XXX or IS-YYYYMMDD-XXX
-- Note: Existing issue_number column will be used, format determined by ticket_type

-- Service Priority (for initial assessment)
ALTER TABLE issues ADD COLUMN service_priority TEXT DEFAULT 'Normal'; -- Urgent/High/Normal/Low

-- Repair Priority (for production dept)
ALTER TABLE issues ADD COLUMN repair_priority TEXT DEFAULT 'Normal'; -- Urgent/High/Normal/Low

-- Link to source service record (if upgraded from service record)
ALTER TABLE issues ADD COLUMN source_service_record_id INTEGER;

-- Estimated completion date
ALTER TABLE issues ADD COLUMN estimated_completion_date DATE;

-- Time tracking fields
ALTER TABLE issues ADD COLUMN first_response_at DATETIME;
ALTER TABLE issues ADD COLUMN assigned_at DATETIME;
ALTER TABLE issues ADD COLUMN repair_started_at DATETIME;
ALTER TABLE issues ADD COLUMN repair_completed_at DATETIME;

-- Customer communication preference
ALTER TABLE issues ADD COLUMN preferred_contact_method TEXT DEFAULT 'Email'; -- Phone/Email/WeChat

-- ============================================
-- 2. Issue Sequences Table (for LR/IS numbering)
-- ============================================

CREATE TABLE IF NOT EXISTS issue_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_type TEXT NOT NULL, -- LR or IS
    date_key TEXT NOT NULL, -- YYYYMMDD format
    last_sequence INTEGER DEFAULT 0,
    UNIQUE(ticket_type, date_key)
);

-- ============================================
-- 3. Issue Status History (for audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS issue_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY(changed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_issue_status_history_issue ON issue_status_history(issue_id);

-- ============================================
-- 4. Issue Time Metrics View
-- ============================================

-- Create a view for calculated time metrics
CREATE VIEW IF NOT EXISTS issue_time_metrics AS
SELECT 
    i.id,
    i.issue_number,
    i.created_at,
    i.first_response_at,
    i.assigned_at,
    i.repair_started_at,
    i.repair_completed_at,
    i.completed_date,
    -- First response time (in hours)
    CASE 
        WHEN i.first_response_at IS NOT NULL THEN
            ROUND((julianday(i.first_response_at) - julianday(i.created_at)) * 24, 2)
        ELSE NULL
    END as first_response_hours,
    -- Total service time (in days)
    CASE 
        WHEN i.completed_date IS NOT NULL THEN
            ROUND(julianday(i.completed_date) - julianday(i.created_at), 2)
        ELSE 
            ROUND(julianday('now') - julianday(i.created_at), 2)
    END as total_service_days,
    -- Repair time (in days)
    CASE 
        WHEN i.repair_started_at IS NOT NULL AND i.repair_completed_at IS NOT NULL THEN
            ROUND(julianday(i.repair_completed_at) - julianday(i.repair_started_at), 2)
        ELSE NULL
    END as repair_days
FROM issues i;

-- ============================================
-- 5. Extended System Dictionaries for Issue Types
-- ============================================

INSERT OR IGNORE INTO system_dictionaries (dict_type, dict_key, dict_value, sort_order) VALUES
-- Ticket Types
('ticket_type', 'LR', '本地工单 (Local Repair)', 1),
('ticket_type', 'IS', '返修工单 (Internal Service)', 2),

-- Service Priority
('service_priority', 'Urgent', '紧急', 1),
('service_priority', 'High', '高', 2),
('service_priority', 'Normal', '普通', 3),
('service_priority', 'Low', '低', 4),

-- Repair Priority
('repair_priority', 'Urgent', '紧急', 1),
('repair_priority', 'High', '高', 2),
('repair_priority', 'Normal', '普通', 3),
('repair_priority', 'Low', '低', 4),

-- Contact Methods
('contact_method', 'Phone', '电话', 1),
('contact_method', 'Email', '邮件', 2),
('contact_method', 'WeChat', '微信', 3);

-- ============================================
-- 6. Create Indexes for New Columns
-- ============================================

CREATE INDEX IF NOT EXISTS idx_issues_ticket_type ON issues(ticket_type);
CREATE INDEX IF NOT EXISTS idx_issues_service_priority ON issues(service_priority);
CREATE INDEX IF NOT EXISTS idx_issues_repair_priority ON issues(repair_priority);
CREATE INDEX IF NOT EXISTS idx_issues_source_sr ON issues(source_service_record_id);
