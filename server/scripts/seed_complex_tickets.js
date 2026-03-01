const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../longhorn.db');
const db = new Database(DB_PATH, { verbose: null });

console.log('[Seed] Starting Complex Tickets Seeding...');

// Dates
const now = new Date();
const daysAgo = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString();
};
const minsAgo = (n) => {
    const d = new Date(now);
    d.setMinutes(d.getMinutes() - n);
    return d.toISOString();
};

// 1. Prepare Users
const usersToCreate = [
    { username: 'Effy', password: '123', role: 'Support', department_id: 2, user_type: 'Employee', created_at: daysAgo(100) },
    { username: 'Manager', password: '123', role: 'Admin', department_id: 2, user_type: 'Employee', created_at: daysAgo(100) },
    { username: 'ZhangOP', password: '123', role: 'Engineer', department_id: 3, user_type: 'Employee', created_at: daysAgo(100) },
    { username: 'AliceFinance', password: '123', role: 'Admin', department_id: 4, user_type: 'Employee', created_at: daysAgo(100) },
    { username: 'cathy', password: '123', role: 'Lead', department_id: 2, user_type: 'Employee', created_at: daysAgo(150) },
    { username: 'LiRD', password: '123', role: 'Engineer', department_id: 3, user_type: 'Employee', created_at: daysAgo(120) },
];

const userMap = {};
for (const u of usersToCreate) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(u.username);
    if (!existing) {
        const info = db.prepare(`
            INSERT INTO users (username, password, role, department_id, user_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(u.username, u.password, u.role, u.department_id, u.user_type, u.created_at);
        userMap[u.username] = { id: info.lastInsertRowid, name: u.username, role: u.role };
    } else {
        userMap[u.username] = { id: existing.id, name: existing.username, role: existing.role || u.role };
    }
}

// Ensure Admin user exists
let adminUser = db.prepare("SELECT id, username FROM users WHERE username='admin'").get();
if (!adminUser) adminUser = { id: 1, username: 'admin' };

// 2. Prepare Customers
const customersData = [
    { name: 'Netflix US', email: 'netflix@us.com', tier: 'VVIP', account_type: 'ORGANIZATION' },
    { name: 'ARRI Rental', email: 'arri@rental.com', tier: 'VIP', account_type: 'ORGANIZATION' },
    { name: 'Panavision', email: 'panavision@pv.com', tier: 'VIP', account_type: 'ORGANIZATION' },
    { name: 'Indie Studio', email: 'indie@studio.com', tier: 'STANDARD', account_type: 'INDIVIDUAL' }
];

const custMap = {};
for (const c of customersData) {
    const existing = db.prepare('SELECT id FROM accounts WHERE name = ?').get(c.name);
    if (!existing) {
        const info = db.prepare(`
            INSERT INTO accounts (name, email, service_tier, account_type, is_active) VALUES (?, ?, ?, ?, ?)
        `).run(c.name, c.email, c.tier, c.account_type, 1);
        custMap[c.name] = info.lastInsertRowid;
    } else {
        custMap[c.name] = existing.id;
    }
}

// 3. Prepare Products & Dealers
const dealer = db.prepare("SELECT id, name FROM accounts WHERE account_type = 'Dealer' LIMIT 1").get() || { id: 1, name: 'ProAV UK' };

const productsToCreate = [
    { model: 'MAVO Edge 8K', sn: '123456' },
    { model: 'Eagle SDI', sn: 'EAGLE_999' },
    { model: 'MAVO Edge 6K', sn: 'ME6K_555' }
];

const prodMap = {};
for (const p of productsToCreate) {
    const existing = db.prepare('SELECT id FROM products WHERE serial_number = ?').get(p.sn);
    if (!existing) {
        const info = db.prepare('INSERT INTO products (model_name, serial_number, product_line) VALUES (?, ?, ?)')
            .run(p.model, p.sn, 'Camera');
        prodMap[p.sn] = info.lastInsertRowid;
    } else {
        prodMap[p.sn] = existing.id;
    }
}

// Helper functions for tickets
const insertTicket = (data) => {
    const info = db.prepare(`
        INSERT INTO tickets (
            ticket_number, ticket_type, current_node, status, priority, 
            sla_due_at, sla_status, account_id, dealer_id, reporter_name,
            product_id, serial_number, problem_summary, problem_description,
            assigned_to, submitted_by, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?
        )
    `).run(
        data.ticket_number, data.ticket_type, data.current_node, data.status, data.priority,
        data.sla_due_at || null, data.sla_status || 'normal', data.account_id, data.dealer_id, data.reporter_name,
        data.product_id, data.serial_number, data.problem_summary, data.problem_description,
        data.assigned_to, data.submitted_by, data.created_at, data.updated_at
    );
    return info.lastInsertRowid;
};

const insertActivity = (ticketId, type, content, actor, visibility = 'all', metadata = null, createdAt) => {
    db.prepare(`
        INSERT INTO ticket_activities (
            ticket_id, activity_type, content, visibility, actor_id, actor_name, 
            actor_role, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        ticketId, type, content, visibility, actor.id === 0 ? null : actor.id, actor.name,
        actor.role || 'MS', metadata ? JSON.stringify(metadata) : null, createdAt || new Date().toISOString()
    );
};

// ==========================================
// Seed 10 Complex Tickets
// ==========================================
console.log('[Seed] Seeding Tickets & Timelines...');

db.prepare("DELETE FROM ticket_activities WHERE ticket_id IN (SELECT id FROM tickets WHERE ticket_number LIKE '%-DEMO')").run();
db.prepare("DELETE FROM tickets WHERE ticket_number LIKE '%-DEMO'").run();

// Scenario 1: Waiver Approval Flow with VIP tag and Mentions
let tId = insertTicket({
    ticket_number: 'K2603-0001-DEMO', ticket_type: 'inquiry', current_node: 'ms_review', status: 'in_progress', priority: 'P1',
    account_id: custMap['ARRI Rental'], reporter_name: 'Max',
    product_id: prodMap['123456'], serial_number: '123456',
    problem_summary: 'Waiver request for out-of-warranty repair', problem_description: 'Customer demands free repair. Very strong.',
    assigned_to: userMap['Effy'].id, submitted_by: userMap['Effy'].id,
    created_at: minsAgo(60), updated_at: minsAgo(5)
});
insertActivity(tId, 'status_change', '状态变更: draft → ms_review', userMap['Effy'], 'all', { from_node: 'draft', to_node: 'ms_review' }, minsAgo(60));
insertActivity(tId, 'comment', '@[Manager](' + userMap['Manager'].id + ') 这个客户很强势，这次能不能免单？(VIP 客户)', userMap['Effy'], 'internal', null, minsAgo(50));
insertActivity(tId, 'system_event', 'Effy 发起了审批申请\\n类型：报价豁免 (Waiver)\\n金额：$800.00 -> $0.00\\n理由：VIP 客户关系维护\\n状态：待经理审批', { id: 0, name: 'System', role: 'sys' }, 'all', {}, minsAgo(49));
insertActivity(tId, 'system_event', 'Manager 已批准备注：同意，但请提醒客户下次必须按流程。', userMap['Manager'], 'all', {}, minsAgo(45));
insertActivity(tId, 'comment', '收到，已经和客户沟通完毕！', userMap['Effy'], 'all', null, minsAgo(5));

// Scenario 2: RMA Handled by OP Zhang with Dealer and VVIP
tId = insertTicket({
    ticket_number: 'RMA-C-2603-001-DEMO', ticket_type: 'rma', current_node: 'op_diagnosing', status: 'in_progress', priority: 'P0',
    account_id: custMap['Netflix US'], dealer_id: dealer.id, reporter_name: 'Netflix Prod Team',
    product_id: prodMap['123456'], serial_number: '123456',
    problem_summary: 'Sensor artifact during 8K record', problem_description: 'Need urgent diagnosis in lab.',
    assigned_to: userMap['ZhangOP'].id, submitted_by: adminUser.id,
    created_at: minsAgo(120), updated_at: minsAgo(10),
    sla_due_at: minsAgo(1), sla_status: 'breached'  // Tested Overdue!
});
insertActivity(tId, 'comment', 'Received device. The IB snapshot shows Netflix US, MAVO Edge 8K. Dealer is ProAV. Running CMOS test.', userMap['ZhangOP'], 'internal', null, minsAgo(60));
insertActivity(tId, 'system_event', 'SLA 已经超时 (P0)', { id: 0, name: 'System', role: 'sys' }, 'internal', null, minsAgo(1));

// Scenario 3: Assignee Change & Finance Payment Check
tId = insertTicket({
    ticket_number: 'RMA-C-2603-002-DEMO', ticket_type: 'rma', current_node: 'ge_closing', status: 'in_progress', priority: 'P2',
    account_id: custMap['Panavision'], reporter_name: 'John',
    product_id: prodMap['EAGLE_999'], serial_number: 'EAGLE_999',
    problem_summary: 'Eagle SDI screen burn', problem_description: 'Screen replacement required.',
    assigned_to: userMap['AliceFinance'].id, submitted_by: userMap['Effy'].id,
    created_at: daysAgo(2), updated_at: minsAgo(30)
});
insertActivity(tId, 'assignment_change', '指派变更: 从 Effy 变更为 AliceFinance', userMap['Effy'], 'all', { from: userMap['Effy'].id, to: userMap['AliceFinance'].id }, daysAgo(1));
insertActivity(tId, 'comment', '@[Effy](' + userMap['Effy'].id + ') 客户已经汇款，请确认发货。', userMap['AliceFinance'], 'all', null, minsAgo(30));

// Scenario 4: Standard Customer - Inquiry waiting for approval
tId = insertTicket({
    ticket_number: 'K2603-0004-DEMO', ticket_type: 'inquiry', current_node: 'waiting_customer', status: 'waiting', priority: 'P2',
    account_id: custMap['Indie Studio'], reporter_name: 'Indie Dev',
    product_id: prodMap['ME6K_555'], serial_number: 'ME6K_555',
    problem_summary: 'Edge 6K Audio desync', problem_description: 'Audio falls out of sync after 10 mins.',
    assigned_to: userMap['Effy'].id, submitted_by: userMap['Effy'].id,
    created_at: daysAgo(5), updated_at: daysAgo(1),
    sla_due_at: daysAgo(3), sla_status: 'breached'
});
insertActivity(tId, 'comment', 'Requested log files from user.', userMap['Effy'], 'all', null, daysAgo(4));

// Scenarios 5 - 6: Padding simple SVC combinations
for (let i = 5; i <= 6; i++) {
    const isOverdue = i % 2 === 0;
    const isVip = i % 3 === 0;
    insertTicket({
        ticket_number: `SVC-D-2603-00${i}-DEMO`, ticket_type: 'svc', current_node: 'dl_repairing', status: 'in_progress', priority: isOverdue ? 'P0' : 'P2',
        account_id: isVip ? custMap['Netflix US'] : custMap['Indie Studio'], dealer_id: dealer.id, reporter_name: 'Dealer Tech',
        product_id: prodMap['123456'], serial_number: '123456',
        problem_summary: 'Random error code E0' + i, problem_description: 'Standard repair procedure initiated.',
        assigned_to: userMap['Effy'].id, submitted_by: adminUser.id,
        created_at: daysAgo(i), updated_at: minsAgo(i * 10),
        sla_due_at: isOverdue ? minsAgo(5) : null, sla_status: isOverdue ? 'warning' : 'normal'
    });
}

// Scenario 7: Water Damage Assessment RMA mapped to R&D and Lead
tId = insertTicket({
    ticket_number: 'RMA-C-2603-007-DEMO', ticket_type: 'rma', current_node: 'op_diagnosing', status: 'in_progress', priority: 'P0',
    account_id: custMap['ARRI Rental'], reporter_name: 'Site Operator',
    product_id: prodMap['123456'], serial_number: '123456',
    problem_summary: 'Water damage during heavy rain shoot', problem_description: 'Camera submerged for 2 mins.',
    assigned_to: userMap['ZhangOP'].id, submitted_by: userMap['Effy'].id,
    created_at: daysAgo(3), updated_at: minsAgo(15)
});
insertActivity(tId, 'comment', 'Machine received. Severe water damage on main board.', userMap['ZhangOP'], 'internal', null, daysAgo(2));
insertActivity(tId, 'comment', `@[LiRD](${userMap['LiRD'].id}) 原件腐蚀严重，能否尝试飞线修复，还是需要直接换主板？`, userMap['ZhangOP'], 'internal', null, daysAgo(1));
insertActivity(tId, 'comment', `@[ZhangOP](${userMap['ZhangOP'].id}) 看了你发的图，无法飞线。直接走整板更换流程吧。`, userMap['LiRD'], 'internal', null, minsAgo(120));
insertActivity(tId, 'comment', `@[cathy](${userMap['cathy'].id}) 客户是 VIP，换主板报价太高客户在犹豫，能否申请物料 8 折折扣？`, userMap['Effy'], 'internal', null, minsAgo(40));
insertActivity(tId, 'comment', `@[Effy](${userMap['Effy'].id}) 已特批 8 折，请系统发起报价给客户。`, userMap['cathy'], 'internal', null, minsAgo(15));

// Scenario 8: Glitch display issue - R&D debugging
tId = insertTicket({
    ticket_number: 'RMA-D-2603-008-DEMO', ticket_type: 'rma', current_node: 'ms_review', status: 'in_progress', priority: 'P1',
    dealer_id: dealer.id, reporter_name: 'Dealer ProAV Support',
    product_id: prodMap['ME6K_555'], serial_number: 'ME6K_555',
    problem_summary: 'Intermittent purple artifact on SDI OUT', problem_description: 'Only happens when recording frame rate > 60fps.',
    assigned_to: userMap['LiRD'].id, submitted_by: userMap['Effy'].id,
    created_at: daysAgo(7), updated_at: minsAgo(90)
});
insertActivity(tId, 'comment', `@[LiRD](${userMap['LiRD'].id}) 经销商那边说升级了最新固件还是有这个问题，麻烦看一下是不是 FPGA 烧了？`, userMap['Effy'], 'internal', null, daysAgo(6));
insertActivity(tId, 'comment', `让他们提取一下 error.log 给我，重点看 timestamp 和 sync bits 错位。`, userMap['LiRD'], 'internal', null, daysAgo(5));
insertActivity(tId, 'attachment', 'Attached: syslog_dump.zip', userMap['Effy'], 'all', null, daysAgo(3));
insertActivity(tId, 'comment', `确认是 FPGA 硬件缺陷导致的包丢失。需要发回原厂重置 BGA。`, userMap['LiRD'], 'internal', null, minsAgo(90));

// Scenario 9: Trade-In consultation RMA
tId = insertTicket({
    ticket_number: 'RMA-C-2603-009-DEMO', ticket_type: 'rma', current_node: 'resolved', status: 'resolved', priority: 'P2',
    account_id: custMap['Panavision'], reporter_name: 'Fleet Manager',
    product_id: prodMap['123456'], serial_number: '123456',
    problem_summary: 'Camera dropped from drone - Total loss', problem_description: 'Case cracked, mount deformed.',
    assigned_to: userMap['AliceFinance'].id, submitted_by: userMap['ZhangOP'].id,
    created_at: daysAgo(10), updated_at: daysAgo(1)
});
insertActivity(tId, 'comment', `定损完成，维修价格超过新机的 70%。@[AliceFinance](${userMap['AliceFinance'].id}) 转给销售看下能否走"以旧换新"？`, userMap['ZhangOP'], 'internal', null, daysAgo(8));
insertActivity(tId, 'comment', `好的，我已经联系客户推了换新方案，客户同意折抵废旧机。`, userMap['AliceFinance'], 'internal', null, daysAgo(2));
insertActivity(tId, 'status_change', 'Status changed to: resolved (Trade-in Completed)', userMap['AliceFinance'], 'all', { from_node: 'waiting_customer', to_node: 'resolved' }, daysAgo(1));

// Scenario 10: Simple port replacement but Escalated
tId = insertTicket({
    ticket_number: 'RMA-C-2603-010-DEMO', ticket_type: 'rma', current_node: 'op_repairing', status: 'in_progress', priority: 'P0',
    account_id: custMap['Netflix US'], reporter_name: 'Netflix B Unit',
    product_id: prodMap['EAGLE_999'], serial_number: 'EAGLE_999',
    problem_summary: 'SDI port loose', problem_description: 'Need new SDI board.',
    assigned_to: userMap['ZhangOP'].id, submitted_by: userMap['Effy'].id,
    created_at: daysAgo(2), updated_at: minsAgo(5),
    sla_due_at: minsAgo(1), sla_status: 'breached'
});
insertActivity(tId, 'system_event', `SLA Breach: Overdue by 2 hours.`, { id: 0, name: 'System', role: 'sys' }, 'all', null, minsAgo(120));
insertActivity(tId, 'comment', `@[ZhangOP](${userMap['ZhangOP'].id}) 这个单子卡了很久了，Netflix 明天要机器首映，今晚加紧修出来！`, userMap['cathy'], 'internal', null, minsAgo(60));
insertActivity(tId, 'comment', `@[cathy](${userMap['cathy'].id}) 收到，已经去物料房领了配件，晚上搞定并发测试。`, userMap['ZhangOP'], 'internal', null, minsAgo(5));

console.log('[Seed] Successfully generated 10 complex tickets and timelines!');
