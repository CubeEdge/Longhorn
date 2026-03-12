SELECT COUNT(*) FROM tickets WHERE datetime(created_at) < datetime('2026-03-08');
SELECT MIN(created_at), MAX(created_at) FROM tickets;
SELECT id, ticket_number, created_at FROM tickets WHERE datetime(created_at) < datetime('2026-03-08') LIMIT 5;
