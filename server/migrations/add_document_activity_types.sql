-- 迁移: 为 ticket_activities 表添加 document_published 和 document_recalled 活动类型
-- 原因: 维修报告和PI发布/撤回操作需要记录在时间轴中
-- SQLite 不支持直接 ALTER CHECK 约束，需要重建表

PRAGMA foreign_keys=OFF;

-- 1. 创建临时表，包含新的 CHECK 约束
CREATE TABLE ticket_activities_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL CHECK(activity_type IN (
        'status_change',
        'comment',
        'internal_note',
        'attachment',
        'mention',
        'participant_added',
        'assignment_change',
        'priority_change',
        'sla_breach',
        'field_update',
        'ticket_linked',
        'system_event',
        'diagnostic_report',
        'soft_delete',
        'creation',
        'document_published',
        'document_recalled',
        'system'
    )),
    content TEXT,
    content_html TEXT,
    metadata TEXT,
    visibility TEXT DEFAULT 'all' CHECK(visibility IN ('all', 'internal', 'customer')),
    actor_id INTEGER,
    actor_name TEXT,
    actor_role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- 2. 复制所有数据（显式列出列名）
INSERT INTO ticket_activities_new (id, ticket_id, activity_type, content, content_html, metadata, visibility, actor_id, actor_name, actor_role, created_at)
SELECT id, ticket_id, activity_type, content, content_html, metadata, visibility, actor_id, actor_name, actor_role, created_at
FROM ticket_activities;

-- 3. 删除旧表
DROP TABLE ticket_activities;

-- 4. 重命名新表
ALTER TABLE ticket_activities_new RENAME TO ticket_activities;

-- 5. 重建索引
CREATE INDEX IF NOT EXISTS idx_activities_ticket ON ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON ticket_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON ticket_activities(actor_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON ticket_activities(created_at);

PRAGMA foreign_keys=ON;
