-- Add is_edited and edited_at columns to ticket_activities table
-- These columns track when an activity has been edited

-- Check and add is_edited column
ALTER TABLE ticket_activities ADD COLUMN is_edited INTEGER DEFAULT 0;

-- Check and add edited_at column  
ALTER TABLE ticket_activities ADD COLUMN edited_at TEXT;
