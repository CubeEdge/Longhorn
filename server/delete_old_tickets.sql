-- 首先查询要删除的工单数量
SELECT 'Tickets to delete before 2026-03-08:' as description, COUNT(*) as count FROM tickets WHERE datetime(created_at) < datetime('2026-03-08');

-- 显示最早和最晚的工单日期
SELECT 'Date range in database:' as description, MIN(created_at) as earliest, MAX(created_at) as latest FROM tickets;
