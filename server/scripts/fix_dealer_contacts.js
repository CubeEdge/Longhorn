/**
 * 修复经销商联系人数据
 * 
 * 问题：
 * 1. ProAV UK (id=7) 的联系人数据错误
 * 2. 经销商缺少联系人
 * 3. 工单关联的contact_id是客户联系人，需要分开
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'longhorn.db');
const db = new Database(dbPath);

console.log('=== 修复经销商联系人数据 ===\n');

// 1. 查看当前经销商数据
console.log('1. 当前经销商列表：');
const dealers = db.prepare(`
    SELECT id, name, dealer_code FROM accounts WHERE account_type = 'DEALER' ORDER BY id
`).all();
dealers.forEach(d => console.log(`  ID=${d.id}, ${d.name} (${d.dealer_code})`));

// 2. 查看当前经销商的联系人
console.log('\n2. 当前经销商联系人：');
for (const dealer of dealers) {
    const contacts = db.prepare(`
        SELECT id, name, email, job_title FROM contacts WHERE account_id = ?
    `).all(dealer.id);
    console.log(`  ${dealer.name} (ID=${dealer.id}): ${contacts.length}个联系人`);
    contacts.forEach(c => console.log(`    - ${c.name} (${c.email})`));
}

// 3. 为没有联系人的经销商添加联系人
console.log('\n3. 添加/修复经销商联系人...');

const dealerContactsData = {
    // Gafpa Gear (id=1)
    1: [
        { name: 'Michael Rodriguez', email: 'mike@gafpagear.com', job_title: 'Repair Manager', status: 'PRIMARY' },
        { name: 'Lisa Park', email: 'lisa@gafpagear.com', job_title: 'Customer Support', status: 'ACTIVE' }
    ],
    // EU Office (id=2)
    2: [
        { name: 'Pieter van der Berg', email: 'pieter@euoffice.nl', job_title: 'Service Coordinator', status: 'PRIMARY' },
        { name: 'Anna Schmidt', email: 'anna@euoffice.nl', job_title: 'Account Manager', status: 'ACTIVE' }
    ],
    // 1SV (id=3)
    3: [
        { name: 'David Kim', email: 'david@1sv.com', job_title: 'Technical Lead', status: 'PRIMARY' },
        { name: 'Matt Kim', email: 'matt@1sv.com', job_title: 'Support Engineer', status: 'ACTIVE' }
    ],
    // Cinetx (id=4)
    4: [
        { name: 'Robert Taylor', email: 'rob.t@cinetx.com', job_title: 'Field Engineer', status: 'PRIMARY' }
    ],
    // RMK (id=5)
    5: [
        { name: 'Alex Petrov', email: 'alex@rmk.ru', job_title: 'Service Manager', status: 'PRIMARY' }
    ],
    // DP Gadget (id=6)
    6: [
        { name: 'Somchai Prasert', email: 'somchai@dpgadget.co.th', job_title: 'Manager', status: 'PRIMARY' }
    ],
    // ProAV UK (id=7)
    7: [
        { name: 'Max Thompson', email: 'max@proav.co.uk', job_title: 'Technical Director', status: 'PRIMARY' },
        { name: 'Sarah Williams', email: 'sarah.w@proav.co.uk', job_title: 'Sales Manager', status: 'ACTIVE' },
        { name: 'James Chen', email: 'james@proav.co.uk', job_title: 'Service Engineer', status: 'ACTIVE' }
    ]
};

// 先清理经销商的现有联系人（只清理经销商的）
for (const dealerId of Object.keys(dealerContactsData)) {
    db.prepare('DELETE FROM contacts WHERE account_id = ?').run(parseInt(dealerId));
    console.log(`  已清理经销商 ID=${dealerId} 的联系人`);
}

// 添加新的联系人
const insertContact = db.prepare(`
    INSERT INTO contacts (account_id, name, email, job_title, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

for (const [dealerId, contacts] of Object.entries(dealerContactsData)) {
    for (const contact of contacts) {
        insertContact.run(
            parseInt(dealerId),
            contact.name,
            contact.email,
            contact.job_title,
            contact.status
        );
    }
    console.log(`  已为 ${dealers.find(d => d.id === parseInt(dealerId))?.name} 添加 ${contacts.length} 个联系人`);
}

// 4. 验证结果
console.log('\n4. 验证修复结果：');
for (const dealer of dealers) {
    const contacts = db.prepare(`
        SELECT id, name, email, job_title, status FROM contacts WHERE account_id = ?
    `).all(dealer.id);
    console.log(`  ${dealer.name} (ID=${dealer.id}): ${contacts.length}个联系人`);
    contacts.forEach(c => console.log(`    - ${c.name} <${c.email}> [${c.status}]`));
}

// 5. 检查工单关联的客户账户是否有联系人
console.log('\n5. 检查工单关联的客户账户联系人...');
const accountsWithTickets = db.prepare(`
    SELECT DISTINCT a.id, a.name, a.account_type 
    FROM accounts a
    WHERE a.id IN (
        SELECT account_id FROM inquiry_tickets WHERE account_id IS NOT NULL
        UNION SELECT account_id FROM rma_tickets WHERE account_id IS NOT NULL
        UNION SELECT account_id FROM dealer_repairs WHERE account_id IS NOT NULL
    )
    ORDER BY a.id
`).all();

for (const account of accountsWithTickets) {
    const contacts = db.prepare('SELECT COUNT(*) as cnt FROM contacts WHERE account_id = ?').get(account.id);
    if (contacts.cnt === 0) {
        console.log(`  ⚠️ ${account.name} (ID=${account.id}, ${account.account_type}) 没有联系人`);
    } else {
        console.log(`  ✅ ${account.name} (ID=${account.id}): ${contacts.cnt}个联系人`);
    }
}

console.log('\n=== 修复完成 ===');
db.close();
