const Database = require('better-sqlite3');
const db = new Database('longhorn.db');

console.log('=== 咨询工单检查 ===');
const inquiries = db.prepare('SELECT ticket_number, problem_summary, status FROM inquiry_tickets ORDER BY id DESC LIMIT 10').all();
console.log(`总数: ${db.prepare('SELECT COUNT(*) as cnt FROM inquiry_tickets').get().cnt}`);
inquiries.forEach(t => {
  console.log(`  ${t.ticket_number} | ${t.problem_summary?.substring(0,40)} | ${t.status}`);
});

console.log('\n=== RMA返厂单检查 ===');
const rmas = db.prepare('SELECT ticket_number, problem_description, status FROM rma_tickets ORDER BY id DESC LIMIT 10').all();
console.log(`总数: ${db.prepare('SELECT COUNT(*) as cnt FROM rma_tickets').get().cnt}`);
rmas.forEach(t => {
  console.log(`  ${t.ticket_number} | ${t.problem_description?.substring(0,40)} | ${t.status}`);
});

console.log('\n=== 经销商维修单检查 ===');
const repairs = db.prepare('SELECT ticket_number, problem_description, status FROM dealer_repairs ORDER BY id DESC LIMIT 10').all();
console.log(`总数: ${db.prepare('SELECT COUNT(*) as cnt FROM dealer_repairs').get().cnt}`);
repairs.forEach(t => {
  console.log(`  ${t.ticket_number} | ${t.problem_description?.substring(0,40)} | ${t.status}`);
});

db.close();
