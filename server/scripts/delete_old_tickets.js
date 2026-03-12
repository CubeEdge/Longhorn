/**
 * Delete all tickets created before 2026-03-08 (test data cleanup)
 * Run on remote server: node scripts/delete_old_tickets.js
 */

const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "longhorn.db");
const db = new Database(dbPath);

const CUTOFF_DATE = '2026-03-08';

// Disable foreign key checks for deletion
db.pragma('foreign_keys = OFF');

console.log(`\n=== 删除 ${CUTOFF_DATE} 之前的测试工单 ===\n`);

// Step 1: Preview tickets to be deleted
const ticketsToDelete = db.prepare(`
    SELECT id, ticket_number, ticket_type, created_at 
    FROM tickets 
    WHERE created_at < ?
    ORDER BY created_at DESC
`).all(CUTOFF_DATE);

console.log(`找到 ${ticketsToDelete.length} 个需要删除的工单:`);
ticketsToDelete.forEach(t => {
    console.log(`  - ${t.ticket_number} (${t.ticket_type}) 创建于 ${t.created_at}`);
});

if (ticketsToDelete.length === 0) {
    console.log('\n没有需要删除的工单。');
    db.close();
    process.exit(0);
}

// Get ticket IDs for related data cleanup
const ticketIds = ticketsToDelete.map(t => t.id);
const placeholders = ticketIds.map(() => '?').join(',');

// Step 2: Delete related data in correct order (check if table exists first)
console.log('\n开始删除关联数据...');

// Helper function to check if table exists
function tableExists(tableName) {
    const result = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
    return !!result;
}

// Delete ticket_activities
if (tableExists('ticket_activities')) {
    const activitiesDeleted = db.prepare(`DELETE FROM ticket_activities WHERE ticket_id IN (${placeholders})`).run(...ticketIds);
    console.log(`  删除活动记录: ${activitiesDeleted.changes} 条`);
}

// Delete ticket_files (may not exist in some environments)
if (tableExists('ticket_files')) {
    const filesDeleted = db.prepare(`DELETE FROM ticket_files WHERE ticket_id IN (${placeholders})`).run(...ticketIds);
    console.log(`  删除文件关联: ${filesDeleted.changes} 条`);
}

// Delete ticket_collaborators
if (tableExists('ticket_collaborators')) {
    const collabDeleted = db.prepare(`DELETE FROM ticket_collaborators WHERE ticket_id IN (${placeholders})`).run(...ticketIds);
    console.log(`  删除协作人员: ${collabDeleted.changes} 条`);
}

// Delete repair_reports
if (tableExists('repair_reports')) {
    const reportsDeleted = db.prepare(`DELETE FROM repair_reports WHERE ticket_id IN (${placeholders})`).run(...ticketIds);
    console.log(`  删除维修报告: ${reportsDeleted.changes} 条`);
}

// Delete proforma_invoices
if (tableExists('proforma_invoices')) {
    const piDeleted = db.prepare(`DELETE FROM proforma_invoices WHERE ticket_id IN (${placeholders})`).run(...ticketIds);
    console.log(`  删除PI发票: ${piDeleted.changes} 条`);
}

// Step 3: Delete tickets themselves
const ticketsDeleted = db.prepare(`DELETE FROM tickets WHERE created_at < ?`).run(CUTOFF_DATE);
console.log(`  删除工单: ${ticketsDeleted.changes} 条`);

console.log(`\n✅ 清理完成！共删除 ${ticketsDeleted.changes} 个工单及其关联数据。`);

// Re-enable foreign key checks
db.pragma('foreign_keys = ON');

db.close();
