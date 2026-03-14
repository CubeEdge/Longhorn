const db = require('better-sqlite3')('./longhorn.db');
const ticketNumber = process.argv[2] || 'RMA-D-2603-0013';

const ticket = db.prepare("SELECT id, ticket_number FROM tickets WHERE ticket_number = ?").get(ticketNumber);
console.log('Ticket:', JSON.stringify(ticket));

if (ticket) {
    // 工单级别附件
    const ticketAttachments = db.prepare('SELECT id, activity_id, file_name FROM ticket_attachments WHERE ticket_id = ?').all(ticket.id);
    console.log('\nAll attachments for ticket (by ticket_id):', ticketAttachments.length);
    ticketAttachments.forEach(a => console.log(' -', JSON.stringify(a)));
    
    // 获取所有活动ID
    const activities = db.prepare('SELECT id, activity_type FROM ticket_activities WHERE ticket_id = ?').all(ticket.id);
    const activityIds = activities.map(a => a.id);
    console.log('\nActivity IDs:', activityIds);
    
    // 通过activity_id查询附件
    if (activityIds.length > 0) {
        const actAttachments = db.prepare(`SELECT * FROM ticket_attachments WHERE activity_id IN (${activityIds.join(',')})`).all();
        console.log('\nAttachments by activity_ids:', actAttachments.length);
        actAttachments.forEach(a => console.log(' -', JSON.stringify(a)));
    }
    
    // 检查诊断报告活动141
    console.log('\nDiagnostic activity 141 attachments:');
    const diagAtt = db.prepare('SELECT * FROM ticket_attachments WHERE activity_id = 141').all();
    console.log('Count:', diagAtt.length);
    diagAtt.forEach(a => console.log(' -', JSON.stringify(a)));
    
    // 看一下ticket_attachments表的结构和数据
    console.log('\nRecent 5 attachments in DB:');
    const recentAtt = db.prepare('SELECT id, ticket_id, activity_id, file_name FROM ticket_attachments ORDER BY id DESC LIMIT 5').all();
    recentAtt.forEach(a => console.log(' -', JSON.stringify(a)));
}
