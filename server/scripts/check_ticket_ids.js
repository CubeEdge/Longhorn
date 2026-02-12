const Database = require('better-sqlite3');
const db = new Database('longhorn.db');

console.log('=== 客户账户 (ORGANIZATION/INDIVIDUAL) ===');
const accounts = db.prepare("SELECT id, name, account_type FROM accounts WHERE account_type != 'DEALER' ORDER BY id").all();
accounts.forEach(a => console.log(`  ID: ${a.id} | ${a.name} | ${a.account_type}`));

console.log('\n=== 联系人 ===');
const contacts = db.prepare('SELECT id, name, account_id, email FROM contacts LIMIT 30').all();
contacts.forEach(c => console.log(`  ID: ${c.id} | account: ${c.account_id} | ${c.name} | ${c.email}`));

console.log('\n=== RMA工单 ===');
const rmas = db.prepare('SELECT id, ticket_number, customer_id, dealer_id, reporter_name FROM rma_tickets ORDER BY id').all();
rmas.forEach(r => console.log(`  ID: ${r.id} | ${r.ticket_number} | customer_id: ${r.customer_id} | dealer_id: ${r.dealer_id} | reporter: ${r.reporter_name}`));

console.log('\n=== 咨询工单 ===');
const inqs = db.prepare('SELECT id, ticket_number, account_id, contact_id, customer_name, dealer_id FROM inquiry_tickets ORDER BY id').all();
inqs.forEach(r => console.log(`  ID: ${r.id} | ${r.ticket_number} | account_id: ${r.account_id} | contact_id: ${r.contact_id} | customer: ${r.customer_name} | dealer_id: ${r.dealer_id}`));

console.log('\n=== 经销商维修单 ===');
const repairs = db.prepare('SELECT id, ticket_number, account_id, contact_id, customer_name, dealer_id FROM dealer_repairs ORDER BY id').all();
repairs.forEach(r => console.log(`  ID: ${r.id} | ${r.ticket_number} | account_id: ${r.account_id} | contact_id: ${r.contact_id} | customer: ${r.customer_name} | dealer_id: ${r.dealer_id}`));

db.close();
