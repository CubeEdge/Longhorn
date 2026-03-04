-- Migration 025: Ticket Audit & Soft Delete (审计化修正与墓碑化软删除)
-- 参考: Service PRD_P2.md §7.1 & §7.2

-- ============================================================
-- 1. 添加软删除字段到 tickets 表
-- ============================================================
ALTER TABLE tickets ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE tickets ADD COLUMN deleted_at TEXT;
ALTER TABLE tickets ADD COLUMN deleted_by INTEGER REFERENCES users(id);
ALTER TABLE tickets ADD COLUMN delete_reason TEXT;

-- 索引优化：排除已删除工单的查询
CREATE INDEX IF NOT EXISTS idx_tickets_deleted ON tickets(is_deleted);

-- ============================================================
-- 2. 扩展 ticket_activities 活动类型 (field_updated)
-- ============================================================
-- 注意：activity_type 已包含 'field_update'，可直接使用

-- ============================================================
-- 3. 创建审计日志表 (可选，用于详细追踪)
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_field_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,          -- 字段名
    old_value TEXT,                    -- 旧值 (JSON 序列化)
    new_value TEXT,                    -- 新值 (JSON 序列化)
    change_reason TEXT,                -- 修正理由 (强制审计字段必填)
    changed_by INTEGER NOT NULL,
    changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ticket ON ticket_field_audit_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_field ON ticket_field_audit_log(field_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON ticket_field_audit_log(changed_at);
