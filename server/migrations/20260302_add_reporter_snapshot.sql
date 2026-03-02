-- 1. 为基础工单表加入 reporter_snapshot
ALTER TABLE tickets ADD COLUMN reporter_snapshot TEXT;

-- 2. 为咨询工单表加入 reporter_snapshot
ALTER TABLE inquiry_tickets ADD COLUMN reporter_snapshot TEXT;
