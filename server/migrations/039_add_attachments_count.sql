-- Add attachments_count column to tickets table
ALTER TABLE tickets ADD COLUMN attachments_count INTEGER DEFAULT 0;

-- Update existing tickets with their attachment counts
UPDATE tickets 
SET attachments_count = (
    SELECT COUNT(*) 
    FROM ticket_attachments 
    WHERE ticket_attachments.ticket_id = tickets.id
);
