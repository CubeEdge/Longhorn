-- Migration 026: Dispatch Rules for Department Automation
-- 为部门自动化提供工单分发规则存储

CREATE TABLE IF NOT EXISTS dispatch_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL,
    ticket_type TEXT NOT NULL, -- 'rma', 'svc', 'inquiry'
    node_key TEXT NOT NULL,     -- 'op_receiving', 'op_shipping', etc.
    default_assignee_id INTEGER, -- NULL means back to team pool
    is_enabled INTEGER DEFAULT 1,
    config TEXT,                -- JSON for future expansion (e.g., Round Robin rules)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_id, ticket_type, node_key),
    FOREIGN KEY(department_id) REFERENCES departments(id),
    FOREIGN KEY(default_assignee_id) REFERENCES users(id)
);
