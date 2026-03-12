const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

// 查询2026年3月8日之前的工单数量
const count = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE datetime(created_at) < datetime('2026-03-08')").get();
console.log('Tickets before 2026-03-08:', count.count);

// 查询日期范围
const range = db.prepare("SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM tickets").get();
console.log('Date range:', range);

// 查询前5条符合条件的工单
const tickets = db.prepare("SELECT id, ticket_number, created_at FROM tickets WHERE datetime(created_at) < datetime('2026-03-08') LIMIT 5").all();
console.log('Sample tickets:', tickets);

db.close();
