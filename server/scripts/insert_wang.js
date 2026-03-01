const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../longhorn.db');
const db = new Database(dbPath, { verbose: console.log });

console.log('--- Inserting Wang Zhihuan Ticket Data ---');

const runTx = db.transaction(() => {
    // 1. Insert Dealer if not exists
    let dealerCinetx = db.prepare(`SELECT id FROM accounts WHERE name = 'Cinetx'`).get();
    if (!dealerCinetx) {
        db.prepare(`INSERT INTO accounts (name, account_type, email, phone) VALUES (?, ?, ?, ?)`).run('Cinetx', 'DEALER', 'contact@cinetx.com', '400-800-8888');
        dealerCinetx = db.prepare(`SELECT id FROM accounts WHERE name = 'Cinetx'`).get();
    }

    // 2. Insert Customer 王之涣
    let customerWang = db.prepare(`SELECT id FROM accounts WHERE name = '王之涣'`).get();
    if (!customerWang) {
        db.prepare(`INSERT INTO accounts (name, account_type, email, phone) VALUES (?, ?, ?, ?)`).run('王之涣', 'INDIVIDUAL', 'wang@example.com', '13800138000');
        customerWang = db.prepare(`SELECT id FROM accounts WHERE name = '王之涣'`).get();
    }

    // 3. Insert specific ticket RMA-D-2601-0001 if not exists
    let existingTicket = db.prepare(`SELECT id FROM tickets WHERE ticket_number = 'RMA-D-2601-0001'`).get();
    let ticketId;
    if (!existingTicket) {
        const result = db.prepare(`
            INSERT INTO tickets (
                ticket_number, ticket_type, current_node, status, 
                account_id, dealer_id, reporter_name, reporter_type,
                serial_number, priority, problem_description,
                assigned_to, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            'RMA-D-2601-0001', 'rma', 'pending_receipt', 'open',
            customerWang.id, dealerCinetx.id, '王之涣', 'customer',
            'ME8K_001', 'P0', '新机开箱发现CMOS有3个坏点，位置在画面中央区域，影响拍摄质量',
            371, 371, '2026-01-17 14:00:00', '2026-01-17 14:00:00'
        );
        ticketId = result.lastInsertRowid;
    } else {
        db.prepare(`
            UPDATE tickets
            SET account_id = ?, dealer_id = ?, reporter_name = '王之涣'
            WHERE ticket_number = 'RMA-D-2601-0001'
        `).run(customerWang.id, dealerCinetx.id);
        ticketId = existingTicket.id;
    }

    console.log(`Inserted/Updated Ticket RMA-D-2601-0001 (ID: ${ticketId}) with Wang Zhihuan and Cinetx.`);
});

runTx();
console.log('--- Done ---');
db.close();
