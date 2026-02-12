const Database = require('better-sqlite3');
const db = new Database('longhorn.db');
db.pragma('foreign_keys = OFF');

console.log('=== 修复工单客户上下文数据 ===\n');

// 1. 首先检查并创建缺失的客户账户
const customersToCreate = [
  { name: 'BBC Studios', type: 'ORGANIZATION', region: 'UK', email: 'tech@bbcstudios.com' },
  { name: 'CVP UK', type: 'ORGANIZATION', region: 'UK', email: 'rental@cvp.com' },
  { name: 'Warner Bros UK', type: 'ORGANIZATION', region: 'UK', email: 'production@warnerbros.co.uk' },
  { name: 'German Film Academy', type: 'ORGANIZATION', region: 'EU', email: 'equipment@filmakademie.de' },
  { name: 'Netflix EU', type: 'ORGANIZATION', region: 'EU', email: 'production@netflix.eu' },
  { name: 'Los Angeles Film School', type: 'ORGANIZATION', region: 'US', email: 'equipment@lafilm.edu' },
  { name: 'Hollywood Rentals', type: 'ORGANIZATION', region: 'US', email: 'rental@hollywoodrentals.com' },
  { name: 'Singapore Media Corp', type: 'ORGANIZATION', region: 'APAC', email: 'tech@sgmediacorp.sg' },
  { name: 'ITV Studios', type: 'ORGANIZATION', region: 'UK', email: 'production@itvstudios.com' },
  { name: 'Bavaria Film', type: 'ORGANIZATION', region: 'EU', email: 'rental@bavariafilm.de' },
  { name: '上海广播电视台', type: 'ORGANIZATION', region: 'CN', email: 'tech@smg.cn' }
];

console.log('=== 第1步：创建/更新客户账户 ===');
const insertAccount = db.prepare(`
  INSERT OR IGNORE INTO accounts (name, account_type, region, email, created_at, updated_at)
  VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
`);

const customerAccountMap = {};
customersToCreate.forEach(c => {
  // 检查是否已存在
  let existing = db.prepare("SELECT id FROM accounts WHERE name = ?").get(c.name);
  if (!existing) {
    insertAccount.run(c.name, c.type, c.region, c.email);
    existing = db.prepare("SELECT id FROM accounts WHERE name = ?").get(c.name);
    console.log(`  ✓ 创建账户: ${c.name} (ID: ${existing.id})`);
  } else {
    console.log(`  - 已存在: ${c.name} (ID: ${existing.id})`);
  }
  customerAccountMap[c.name] = existing.id;
});

// 获取北京电影学院的ID
const beijingFilm = db.prepare("SELECT id FROM accounts WHERE name = '北京电影学院'").get();
if (beijingFilm) {
  customerAccountMap['北京电影学院'] = beijingFilm.id;
}

console.log('\n=== 第2步：创建联系人 ===');
const contactsToCreate = [
  { name: 'John Harrison', email: 'j.harrison@bbcstudios.com', phone: '+44-20-1234-5001', account: 'BBC Studios' },
  { name: 'Emma Thompson', email: 'e.thompson@cvp.com', phone: '+44-20-1234-5002', account: 'CVP UK' },
  { name: 'David Miller', email: 'd.miller@warnerbros.co.uk', phone: '+44-20-1234-5003', account: 'Warner Bros UK' },
  { name: 'Klaus Weber', email: 'k.weber@filmakademie.de', phone: '+49-711-123-4567', account: 'German Film Academy' },
  { name: 'Marie Dubois', email: 'm.dubois@netflix.eu', phone: '+33-1-2345-6789', account: 'Netflix EU' },
  { name: 'Michael Chen', email: 'm.chen@lafilm.edu', phone: '+1-323-555-0101', account: 'Los Angeles Film School' },
  { name: 'Robert Garcia', email: 'r.garcia@hollywoodrentals.com', phone: '+1-323-555-0102', account: 'Hollywood Rentals' },
  { name: 'Tan Wei Lin', email: 'weilin@sgmediacorp.sg', phone: '+65-6123-4567', account: 'Singapore Media Corp' },
  { name: 'Sarah Brown', email: 's.brown@itvstudios.com', phone: '+44-20-1234-5004', account: 'ITV Studios' },
  { name: 'Hans Schmidt', email: 'h.schmidt@bavariafilm.de', phone: '+49-89-123-4567', account: 'Bavaria Film' },
  { name: '王建国', email: 'wangjianguo@bfa.edu.cn', phone: '+86-10-8888-0001', account: '北京电影学院' },
  { name: '李晓明', email: 'lixiaoming@smg.cn', phone: '+86-21-6666-0001', account: '上海广播电视台' }
];

const insertContact = db.prepare(`
  INSERT OR IGNORE INTO contacts (name, email, phone, account_id, created_at, updated_at)
  VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
`);

const contactMap = {};
contactsToCreate.forEach(c => {
  const accountId = customerAccountMap[c.account];
  if (!accountId) {
    console.log(`  ✗ 跳过: ${c.name} (账户 ${c.account} 不存在)`);
    return;
  }
  
  let existing = db.prepare("SELECT id FROM contacts WHERE email = ?").get(c.email);
  if (!existing) {
    insertContact.run(c.name, c.email, c.phone, accountId);
    existing = db.prepare("SELECT id FROM contacts WHERE email = ?").get(c.email);
    console.log(`  ✓ 创建联系人: ${c.name} -> ${c.account} (ID: ${existing.id})`);
  } else {
    console.log(`  - 已存在: ${c.name} (ID: ${existing.id})`);
  }
  contactMap[c.account] = existing.id;
});

// 获取经销商ID映射
console.log('\n=== 第3步：获取经销商映射 ===');
const dealers = db.prepare("SELECT id, name FROM accounts WHERE account_type = 'DEALER'").all();
const dealerMap = {};
dealers.forEach(d => {
  dealerMap[d.name] = d.id;
  console.log(`  经销商: ${d.name} (ID: ${d.id})`);
});

// 更新咨询工单
console.log('\n=== 第4步：更新咨询工单 ===');
const inquiryUpdates = [
  { ticket: 'K2602-0001', customer: 'BBC Studios', dealer: 'ProAV UK' },
  { ticket: 'K2602-0002', customer: 'German Film Academy', dealer: 'Gafpa Gear' },
  { ticket: 'K2602-0003', customer: 'Los Angeles Film School', dealer: '1SV' },
  { ticket: 'K2602-0004', customer: 'Singapore Media Corp', dealer: 'DP Gadget' },
  { ticket: 'K2602-0005', customer: '北京电影学院', dealer: null },
  { ticket: 'K2602-0006', customer: 'ITV Studios', dealer: 'ProAV UK' },
  { ticket: 'K2602-0007', customer: 'Bavaria Film', dealer: 'Gafpa Gear' }
];

const updateInquiry = db.prepare(`
  UPDATE inquiry_tickets 
  SET account_id = ?, contact_id = ?, dealer_id = ?, customer_name = ?
  WHERE ticket_number = ?
`);

inquiryUpdates.forEach(u => {
  const accountId = customerAccountMap[u.customer];
  const contactId = contactMap[u.customer] || null;
  const dealerId = u.dealer ? dealerMap[u.dealer] : null;
  
  updateInquiry.run(accountId, contactId, dealerId, u.customer, u.ticket);
  console.log(`  ✓ ${u.ticket}: account=${accountId}, contact=${contactId}, dealer=${dealerId}`);
});

// 更新经销商维修单
console.log('\n=== 第5步：更新经销商维修单 ===');
const repairUpdates = [
  { ticket: 'SVC-D-2602-0001', customer: 'BBC Studios', dealer: 'ProAV UK' },
  { ticket: 'SVC-D-2602-0002', customer: 'CVP UK', dealer: 'ProAV UK' },
  { ticket: 'SVC-D-2602-0003', customer: 'Warner Bros UK', dealer: 'ProAV UK' },
  { ticket: 'SVC-D-2602-0004', customer: 'German Film Academy', dealer: 'Gafpa Gear' },
  { ticket: 'SVC-D-2602-0005', customer: 'Netflix EU', dealer: 'Gafpa Gear' },
  { ticket: 'SVC-D-2602-0006', customer: 'Los Angeles Film School', dealer: '1SV' },
  { ticket: 'SVC-D-2602-0007', customer: 'Hollywood Rentals', dealer: '1SV' },
  { ticket: 'SVC-D-2602-0008', customer: 'Singapore Media Corp', dealer: 'DP Gadget' },
  { ticket: 'SVC-D-2602-0009', customer: 'ITV Studios', dealer: 'ProAV UK' },
  { ticket: 'SVC-D-2602-0010', customer: 'Bavaria Film', dealer: 'Gafpa Gear' }
];

const updateRepair = db.prepare(`
  UPDATE dealer_repairs 
  SET account_id = ?, contact_id = ?, dealer_id = ?, customer_name = ?
  WHERE ticket_number = ?
`);

repairUpdates.forEach(u => {
  const accountId = customerAccountMap[u.customer];
  const contactId = contactMap[u.customer] || null;
  const dealerId = dealerMap[u.dealer];
  
  updateRepair.run(accountId, contactId, dealerId, u.customer, u.ticket);
  console.log(`  ✓ ${u.ticket}: account=${accountId}, contact=${contactId}, dealer=${dealerId}`);
});

// 更新RMA返厂单 - 需要检查字段是否存在
console.log('\n=== 第6步：更新RMA返厂单 ===');

// 检查RMA表是否有account_id字段
const rmaColumns = db.prepare("PRAGMA table_info(rma_tickets)").all();
const hasAccountId = rmaColumns.some(c => c.name === 'account_id');

if (!hasAccountId) {
  console.log('  添加 account_id 和 contact_id 字段到 rma_tickets...');
  db.exec('ALTER TABLE rma_tickets ADD COLUMN account_id INTEGER REFERENCES accounts(id)');
  db.exec('ALTER TABLE rma_tickets ADD COLUMN contact_id INTEGER REFERENCES contacts(id)');
}

const rmaUpdates = [
  { ticket: 'RMA-D-2602-0001', customer: 'BBC Studios', dealer: 'ProAV UK' },
  { ticket: 'RMA-D-2602-0002', customer: 'German Film Academy', dealer: 'Gafpa Gear' },
  { ticket: 'RMA-D-2602-0003', customer: 'Los Angeles Film School', dealer: '1SV' },
  { ticket: 'RMA-C-2602-0001', customer: '北京电影学院', dealer: null },
  { ticket: 'RMA-C-2602-0002', customer: '上海广播电视台', dealer: null },
  { ticket: 'RMA-D-2602-0004', customer: 'Warner Bros UK', dealer: 'ProAV UK' },
  { ticket: 'RMA-D-2602-0005', customer: 'Bavaria Film', dealer: 'Gafpa Gear' }
];

const updateRma = db.prepare(`
  UPDATE rma_tickets 
  SET account_id = ?, contact_id = ?, dealer_id = ?, reporter_name = ?
  WHERE ticket_number = ?
`);

rmaUpdates.forEach(u => {
  const accountId = customerAccountMap[u.customer];
  const contactId = contactMap[u.customer] || null;
  const dealerId = u.dealer ? dealerMap[u.dealer] : null;
  
  updateRma.run(accountId, contactId, dealerId, u.customer, u.ticket);
  console.log(`  ✓ ${u.ticket}: account=${accountId}, contact=${contactId}, dealer=${dealerId}`);
});

// 验证结果
console.log('\n=== 验证结果 ===');
console.log('\n咨询工单:');
const inqs = db.prepare('SELECT ticket_number, account_id, contact_id, dealer_id, customer_name FROM inquiry_tickets').all();
inqs.forEach(i => console.log(`  ${i.ticket_number}: account=${i.account_id}, contact=${i.contact_id}, dealer=${i.dealer_id}, customer=${i.customer_name}`));

console.log('\n经销商维修单:');
const repairs = db.prepare('SELECT ticket_number, account_id, contact_id, dealer_id, customer_name FROM dealer_repairs').all();
repairs.forEach(r => console.log(`  ${r.ticket_number}: account=${r.account_id}, contact=${r.contact_id}, dealer=${r.dealer_id}, customer=${r.customer_name}`));

console.log('\nRMA返厂单:');
const rmas = db.prepare('SELECT ticket_number, account_id, contact_id, dealer_id, reporter_name FROM rma_tickets').all();
rmas.forEach(r => console.log(`  ${r.ticket_number}: account=${r.account_id}, contact=${r.contact_id}, dealer=${r.dealer_id}, reporter=${r.reporter_name}`));

console.log('\n=== 修复完成 ===');
db.close();
