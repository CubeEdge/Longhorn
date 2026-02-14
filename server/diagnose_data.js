#!/usr/bin/env node
/**
 * 数据诊断脚本 - 分析工单数据问题
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

console.log('========================================');
console.log('工单数据诊断');
console.log('========================================\n');

// 1. 查看 contacts 表数据
console.log('1. Contacts 表数据:');
const contacts = db.prepare('SELECT id, name, account_id, job_title, status FROM contacts').all();
console.log(JSON.stringify(contacts, null, 2));

// 2. 查看 dealer_repairs 表数据
console.log('\n2. Dealer Repairs 数据:');
const repairs = db.prepare(`
    SELECT dr.id, dr.ticket_number, dr.customer_name, dr.customer_contact, 
           dr.problem_description, dr.account_id, dr.contact_id,
           a.name as account_name,
           c.name as contact_name
    FROM dealer_repairs dr
    LEFT JOIN accounts a ON dr.account_id = a.id
    LEFT JOIN contacts c ON dr.contact_id = c.id
    ORDER BY dr.id
`).all();
repairs.forEach(r => {
    console.log(`  ${r.ticket_number}: customer_name="${r.customer_name}", contact="${r.customer_contact}", account=${r.account_id}(${r.account_name}), contact_id=${r.contact_id}(${r.contact_name}), desc="${(r.problem_description || '').substring(0, 30)}..."`);
});

// 3. 查看 accounts 和 contacts 的关联
console.log('\n3. Account -> Contacts 关联:');
const accountContacts = db.prepare(`
    SELECT a.id as account_id, a.name as account_name, 
           c.id as contact_id, c.name as contact_name, c.status
    FROM accounts a
    LEFT JOIN contacts c ON c.account_id = a.id
    WHERE a.account_type IN ('INDIVIDUAL', 'ORGANIZATION')
    ORDER BY a.id
`).all();
accountContacts.forEach(ac => {
    console.log(`  Account ${ac.account_id}(${ac.account_name}) -> Contact ${ac.contact_id}(${ac.contact_name}) [${ac.status}]`);
});

// 4. 统计数据
console.log('\n4. 统计数据:');
const drStats = db.prepare('SELECT status, COUNT(*) as count FROM dealer_repairs GROUP BY status').all();
console.log('  Dealer Repairs by status:', drStats);

const drTotal = db.prepare('SELECT COUNT(*) as total FROM dealer_repairs').get();
console.log('  Total dealer_repairs:', drTotal.total);

const rmaStats = db.prepare('SELECT status, COUNT(*) as count FROM rma_tickets GROUP BY status').all();
console.log('  RMA Tickets by status:', rmaStats);

const rmaTotal = db.prepare('SELECT COUNT(*) as total FROM rma_tickets').get();
console.log('  Total rma_tickets:', rmaTotal.total);

// 5. 创建时间分析
console.log('\n5. 创建时间分析:');
const drCreated = db.prepare('SELECT id, ticket_number, status, created_at FROM dealer_repairs ORDER BY created_at DESC').all();
drCreated.forEach(r => {
    const age = Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
    console.log(`  ${r.ticket_number} | ${r.status.padEnd(16)} | ${r.created_at} | ${age}天前`);
});

console.log('\n========================================');
console.log('诊断完成');
console.log('========================================');

db.close();
