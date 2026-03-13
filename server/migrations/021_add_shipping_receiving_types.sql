-- Migration: Add shipping_info and receiving_info to ticket_activities activity_type CHECK constraint
-- This migration recreates the ticket_activities table with the new constraint

PRAGMA foreign_keys=OFF;

-- Step 1: Create new table with updated CHECK constraint
CREATE TABLE IF NOT EXISTS ticket_activities_new (
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
        'system',
        'op_repair_report',
        'shipping_info',
        'receiving_info'
    )),
    content TEXT,
    content_html TEXT,
    metadata TEXT,
    visibility TEXT DEFAULT 'all' CHECK(visibility IN ('all', 'internal', 'customer')),
    actor_id INTEGER,
    actor_name TEXT,
    actor_role TEXT,
    is_edited INTEGER DEFAULT 0,
    edited_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- Step 2: Copy data from old table to new table
INSERT INTO ticket_activities_new (id, ticket_id, activity_type, content, content_html, metadata, visibility, actor_id, actor_name, actor_role, is_edited, edited_at, created_at)
SELECT id, ticket_id, activity_type, content, content_html, metadata, visibility, actor_id, actor_name, actor_role, COALESCE(is_edited, 0), edited_at, created_at
FROM ticket_activities;

-- Step 3: Drop old table
DROP TABLE ticket_activities;

-- Step 4: Rename new table to original name
ALTER TABLE ticket_activities_new RENAME TO ticket_activities;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_activities_ticket ON ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON ticket_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON ticket_activities(actor_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON ticket_activities(created_at);

PRAGMA foreign_keys=ON;
