#!/usr/bin/env node
/**
 * 修复工单数据 - 同步 customer_name 和 contact_id
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

console.log('========================================');
console.log('修复工单数据');
console.log('========================================\n');

// 1. 修复 dealer_repairs: 同步 customer_name 从 account，contact_id 从 contacts
console.log('1. 修复 dealer_repairs 的 customer_name 和 contact_id:');

// 获取所有 dealer_repairs
const repairs = db.prepare('SELECT id, ticket_number, customer_name, account_id FROM dealer_repairs').all();

const updateRepair = db.prepare(`
    UPDATE dealer_repairs 
    SET customer_name = ?, customer_contact = ?, contact_id = ?
    WHERE id = ?
`);

let repairUpdated = 0;
for (const r of repairs) {
    if (!r.account_id) continue;
    
    // 获取 account 信息
    const account = db.prepare('SELECT name FROM accounts WHERE id = ?').get(r.account_id);
    if (!account) continue;
    
    // 获取主要联系人
    const contact = db.prepare(`
        SELECT id, name, email FROM contacts 
        WHERE account_id = ? AND status = 'PRIMARY'
        LIMIT 1
    `).get(r.account_id);
    
    const newCustomerName = account.name;
    const newCustomerContact = contact ? contact.name : null;
    const newContactId = contact ? contact.id : null;
    
    if (newCustomerName !== r.customer_name) {
        console.log(`  ${r.ticket_number}: "${r.customer_name}" -> "${newCustomerName}", contact_id=${newContactId}(${newCustomerContact})`);
        updateRepair.run(newCustomerName, newCustomerContact, newContactId, r.id);
        repairUpdated++;
    } else if (!r.contact_id && contact) {
        // 只更新 contact_id
        db.prepare('UPDATE dealer_repairs SET contact_id = ?, customer_contact = ? WHERE id = ?')
          .run(contact.id, contact.name, r.id);
        console.log(`  ${r.ticket_number}: contact_id=null -> ${contact.id}(${contact.name})`);
        repairUpdated++;
    }
}
console.log(`  更新了 ${repairUpdated} 条记录\n`);

// 2. 修复 rma_tickets
console.log('2. 修复 rma_tickets 的 contact_id:');

const rmas = db.prepare('SELECT id, ticket_number, account_id, contact_id FROM rma_tickets').all();

let rmaUpdated = 0;
for (const r of rmas) {
    if (!r.account_id || r.contact_id) continue;
    
    const contact = db.prepare(`
        SELECT id, name FROM contacts 
        WHERE account_id = ? AND status = 'PRIMARY'
        LIMIT 1
    `).get(r.account_id);
    
    if (contact) {
        db.prepare('UPDATE rma_tickets SET contact_id = ? WHERE id = ?').run(contact.id, r.id);
        console.log(`  ${r.ticket_number}: contact_id=null -> ${contact.id}(${contact.name})`);
        rmaUpdated++;
    }
}
console.log(`  更新了 ${rmaUpdated} 条记录\n`);

// 3. 修复 inquiry_tickets
console.log('3. 修复 inquiry_tickets 的 contact_id:');

const inquiries = db.prepare('SELECT id, ticket_number, account_id, contact_id FROM inquiry_tickets').all();

let inquiryUpdated = 0;
for (const r of inquiries) {
    if (!r.account_id || r.contact_id) continue;
    
    const contact = db.prepare(`
        SELECT id, name FROM contacts 
        WHERE account_id = ? AND status = 'PRIMARY'
        LIMIT 1
    `).get(r.account_id);
    
    if (contact) {
        db.prepare('UPDATE inquiry_tickets SET contact_id = ? WHERE id = ?').run(contact.id, r.id);
        console.log(`  ${r.ticket_number}: contact_id=null -> ${contact.id}(${contact.name})`);
        inquiryUpdated++;
    }
}
console.log(`  更新了 ${inquiryUpdated} 条记录\n`);

// 4. 验证修复结果
console.log('========================================');
console.log('验证修复结果');
console.log('========================================\n');

const repairsAfter = db.prepare(`
    SELECT dr.ticket_number, dr.customer_name, dr.customer_contact, 
           a.name as account_name, c.name as contact_name
    FROM dealer_repairs dr
    LEFT JOIN accounts a ON dr.account_id = a.id
    LEFT JOIN contacts c ON dr.contact_id = c.id
`).all();

repairsAfter.forEach(r => {
    const match = r.customer_name === r.account_name ? '✓' : '✗';
    console.log(`  ${match} ${r.ticket_number}: customer_name="${r.customer_name}", contact="${r.customer_contact}", account="${r.account_name}"`);
});

console.log('\n========================================');
console.log('修复完成');
console.log('========================================');

db.close();
