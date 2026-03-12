const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

// 首先查询要删除的工单数量
const count = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE datetime(created_at) < datetime('2026-03-08')").get();
console.log('Tickets to delete before 2026-03-08:', count.count);

// 查询日期范围
const range = db.prepare("SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM tickets").get();
console.log('Date range:', range);

if (count.count > 0) {
    // 开始事务
    db.prepare('BEGIN TRANSACTION').run();
    
    try {
        // 获取要删除的工单ID列表
        const ticketsToDelete = db.prepare("SELECT id, ticket_number, created_at FROM tickets WHERE datetime(created_at) < datetime('2026-03-08')").all();
        console.log('Tickets to be deleted:', ticketsToDelete.map(t => t.ticket_number));
        
        // 删除相关表数据（外键约束）
        // 先删除工单相关的活动记录
        const deleteActivities = db.prepare("DELETE FROM activities WHERE ticket_id IN (SELECT id FROM tickets WHERE datetime(created_at) < datetime('2026-03-08'))");
        const activitiesResult = deleteActivities.run();
        console.log('Deleted activities:', activitiesResult.changes);
        
        // 删除工单
        const deleteTickets = db.prepare("DELETE FROM tickets WHERE datetime(created_at) < datetime('2026-03-08')");
        const ticketsResult = deleteTickets.run();
        console.log('Deleted tickets:', ticketsResult.changes);
        
        // 提交事务
        db.prepare('COMMIT').run();
        console.log('Deletion completed successfully!');
        
        // 验证删除后的数量
        const remainingCount = db.prepare("SELECT COUNT(*) as count FROM tickets").get();
        console.log('Remaining tickets:', remainingCount.count);
        
    } catch (error) {
        // 回滚事务
        db.prepare('ROLLBACK').run();
        console.error('Error during deletion:', error);
        process.exit(1);
    }
} else {
    console.log('No tickets to delete.');
}

db.close();
