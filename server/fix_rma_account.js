const db = require('better-sqlite3')('longhorn.db');

// 查找 RMA 工单
const rmaTicket = db.prepare(`
    SELECT id, ticket_number, serial_number, dealer_id 
    FROM tickets 
    WHERE ticket_number = 'RMA-D-2601-0001'
`).get();

console.log('Found RMA ticket:', rmaTicket);

if (!rmaTicket) {
    console.log('RMA ticket not found');
    process.exit(0);
}

// 检查是否已有 account_id
if (rmaTicket.account_id) {
    console.log('Ticket already has account_id:', rmaTicket.account_id);
    process.exit(0);
}

// 查找经销商信息
const dealer = db.prepare(`
    SELECT id, name, dealer_code 
    FROM accounts 
    WHERE id = ? AND account_type = 'DEALER'
`).get(rmaTicket.dealer_id);

if (!dealer) {
    console.log('Dealer not found for dealer_id:', rmaTicket.dealer_id);
    process.exit(0);
}

console.log('Associated dealer:', dealer);

// 创建客户账户
const customerName = `${dealer.name} Customer - ${rmaTicket.serial_number}`;
const insertResult = db.prepare(`
    INSERT INTO accounts (name, account_type, country, province, city, created_at, updated_at)
    VALUES (?, 'INDIVIDUAL', 'CN', 'Beijing', 'Beijing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`).run(customerName);

const accountId = insertResult.lastInsertRowid;
console.log('Created new account:', { id: accountId, name: customerName });

// 更新工单的 account_id
db.prepare(`
    UPDATE tickets SET account_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
`).run(accountId, rmaTicket.id);

console.log('✓ Updated ticket with account_id:', accountId);

// 创建联系人
db.prepare(`
    INSERT INTO contacts (account_id, name, email, phone, status, is_primary, created_at)
    VALUES (?, ?, '', '', 'ACTIVE', 1, CURRENT_TIMESTAMP)
`).run(accountId, `${dealer.name} Contact`);

console.log('✓ Created primary contact for account');

db.close();
console.log('\n✅ Migration complete!');
