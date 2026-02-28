/**
 * P2 Test Data Setup Script
 * 
 * Creates users, accounts, devices, and tickets for testing P2 features:
 * - @Mention notifications
 * - Comments/Activity timeline
 * - SLA tracking
 * - View As functionality
 */

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'longhorn.db');
const db = new Database(dbPath);

console.log('='.repeat(60));
console.log(' P2 Test Data Setup');
console.log('='.repeat(60));

// Simple password hash
const hashPassword = (pwd) => bcrypt.hashSync(pwd, 10);

// ==================== 1. Create Users ====================
console.log('\n📋 Creating Users...');

const users = [
  { username: 'bishan', password: 'bishan123', role: 'Manager', department_name: 'OP', user_type: 'Employee' },
  { username: 'gaosong', password: 'gaosong123', role: 'Staff', department_name: 'OP', user_type: 'Employee' },
  { username: 'cathy', password: 'cathy123', role: 'Manager', department_name: 'MS', user_type: 'Employee' },
  { username: 'sherry', password: 'sherry123', role: 'Manager', department_name: 'MS', user_type: 'Employee' },
  { username: 'effy', password: 'effy123', role: 'Staff', department_name: 'MS', user_type: 'Employee' },
  { username: 'jihua', password: 'jihua123', role: 'Admin', department_name: 'Executive', user_type: 'Employee' },
];

const insertUser = db.prepare(`
  INSERT OR REPLACE INTO users (username, password, role, department_name, user_type, created_at)
  VALUES (@username, @password, @role, @department_name, @user_type, datetime('now'))
`);

const userIds = {};
for (const user of users) {
  try {
    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);
    if (existing) {
      userIds[user.username] = existing.id;
      console.log(`  ✓ User ${user.username} already exists (ID: ${existing.id})`);
    } else {
      const result = insertUser.run({
        ...user,
        password: hashPassword(user.password)
      });
      userIds[user.username] = result.lastInsertRowid;
      console.log(`  ✓ Created user: ${user.username} (ID: ${result.lastInsertRowid})`);
    }
  } catch (err) {
    console.log(`  ✗ Failed to create ${user.username}: ${err.message}`);
  }
}

// ==================== 2. Create Test Accounts ====================
console.log('\n📋 Creating Test Accounts...');

const accounts = [
  { name: 'Test Customer A', account_type: 'INDIVIDUAL', region: 'China', email: 'customer_a@test.com', phone: '13800000001', dealer_code: null, dealer_level: null },
  { name: 'Test Dealer B', account_type: 'DEALER', region: 'Europe', email: 'dealer_b@test.com', phone: '13800000002', dealer_code: 'TD-B001', dealer_level: 'Gold' },
  { name: 'Beijing Film Studio', account_type: 'ORGANIZATION', region: 'China', email: 'bfs@test.com', phone: '13800000003', dealer_code: null, dealer_level: null },
];

const insertAccount = db.prepare(`
  INSERT INTO accounts (name, account_type, region, email, phone, dealer_code, dealer_level, created_at, updated_at)
  VALUES (@name, @account_type, @region, @email, @phone, @dealer_code, @dealer_level, datetime('now'), datetime('now'))
`);

const accountIds = {};
for (const account of accounts) {
  try {
    const existing = db.prepare('SELECT id FROM accounts WHERE name = ?').get(account.name);
    if (existing) {
      accountIds[account.name] = existing.id;
      console.log(`  ✓ Account ${account.name} already exists (ID: ${existing.id})`);
    } else {
      const result = insertAccount.run(account);
      accountIds[account.name] = result.lastInsertRowid;
      console.log(`  ✓ Created account: ${account.name} (ID: ${result.lastInsertRowid})`);
    }
  } catch (err) {
    console.log(`  ✗ Failed to create ${account.name}: ${err.message}`);
  }
}

// ==================== 3. Create Installed Base (Devices) ====================
console.log('\n📋 Creating Installed Base (Devices)...');

// Use existing product IDs (from products table)
const devices = [
  { account: 'Test Customer A', product_id: 1, serial_number: 'TEST-MAVO8K-001', purchase_date: '2024-06-15' },  // MAVO Edge 8K
  { account: 'Test Customer A', product_id: 5, serial_number: 'TEST-TERRA-001', purchase_date: '2023-11-20' },   // Terra 4K
  { account: 'Test Dealer B', product_id: 2, serial_number: 'TEST-MAVO6K-001', purchase_date: '2025-01-10' },    // MAVO Edge 6K
  { account: 'Beijing Film Studio', product_id: 4, serial_number: 'TEST-MAVOLF-001', purchase_date: '2024-03-22' }, // MAVO LF
  { account: 'Beijing Film Studio', product_id: 6, serial_number: 'TEST-EAGLE-001', purchase_date: '2024-04-01' },  // Eagle SDI
];

const insertDevice = db.prepare(`
  INSERT INTO account_devices (account_id, product_id, serial_number, purchase_date, device_status, created_at, updated_at)
  VALUES (@account_id, @product_id, @serial_number, @purchase_date, 'ACTIVE', datetime('now'), datetime('now'))
`);

for (const device of devices) {
  try {
    const accountId = accountIds[device.account];
    if (!accountId) {
      console.log(`  ✗ Account not found for device: ${device.serial_number}`);
      continue;
    }
    const existing = db.prepare('SELECT id FROM account_devices WHERE serial_number = ?').get(device.serial_number);
    if (existing) {
      console.log(`  ✓ Device ${device.serial_number} already exists`);
    } else {
      insertDevice.run({
        account_id: accountId,
        product_id: device.product_id,
        serial_number: device.serial_number,
        purchase_date: device.purchase_date
      });
      console.log(`  ✓ Created device: ${device.serial_number} (Product ID: ${device.product_id})`);
    }
  } catch (err) {
    console.log(`  ✗ Failed to create device ${device.serial_number}: ${err.message}`);
  }
}

// ==================== 4. Create Test Inquiry Tickets ====================
console.log('\n📋 Creating Test Inquiry Tickets...');

// Get next ticket number
const getNextTicketNumber = () => {
  const seq = db.prepare('SELECT MAX(CAST(SUBSTR(ticket_number, 5) AS INTEGER)) as max_num FROM inquiry_tickets').get();
  const nextNum = (seq.max_num || 0) + 1;
  return `SVC-${String(nextNum).padStart(6, '0')}`;
};

const inquiryTickets = [
  {
    problem_summary: 'MAVO Edge 8K 开机黑屏问题',
    service_type: 'Technical',
    channel: 'WeChat',
    account: 'Test Customer A',
    serial_number: 'TEST-MAVO8K-001',
    handler: 'gaosong',
    status: 'InProgress',
    communication_log: '客户反映摄影机开机后显示器无画面输出。已远程协助检查HDMI线缆连接正常。'
  },
  {
    problem_summary: 'Terra 4K 传感器清洁咨询',
    service_type: 'Consultation',
    channel: 'Email',
    account: 'Test Customer A',
    serial_number: 'TEST-TERRA-001',
    handler: 'effy',
    status: 'AwaitingFeedback',
    communication_log: '客户询问传感器清洁方法和注意事项。已发送清洁指南PDF。等待客户确认是否需要返厂清洁。'
  },
  {
    problem_summary: 'MAVO Edge 6K 固件升级后录制异常 - 需要 @bishan 协助',
    service_type: 'Technical',
    channel: 'Phone',
    account: 'Test Dealer B',
    serial_number: 'TEST-MAVO6K-001',
    handler: 'cathy',
    status: 'InProgress',
    communication_log: '经销商反映客户机器升级固件后出现录制中断问题。@bishan 请协助分析固件日志。'
  },
  {
    problem_summary: 'MAVO LF 镜头卡口松动 - 建议升级为RMA',
    service_type: 'Technical',
    channel: 'WeChat',
    account: 'Beijing Film Studio',
    serial_number: 'TEST-MAVOLF-001',
    handler: 'sherry',
    status: 'Pending',
    communication_log: '客户反映镜头安装后有轻微晃动。初步判断需要返厂检修卡口组件。@gaosong 请评估是否需要升级为RMA工单。'
  },
];

const insertTicket = db.prepare(`
  INSERT INTO inquiry_tickets (
    ticket_number, customer_name, customer_contact, account_id, serial_number,
    service_type, channel, problem_summary, communication_log, status,
    handler_id, created_by, created_at, updated_at
  ) VALUES (
    @ticket_number, @customer_name, @customer_contact, @account_id, @serial_number,
    @service_type, @channel, @problem_summary, @communication_log, @status,
    @handler_id, @created_by, datetime('now'), datetime('now')
  )
`);

for (const ticket of inquiryTickets) {
  try {
    const accountId = accountIds[ticket.account];
    const handlerId = userIds[ticket.handler];
    const account = db.prepare('SELECT name, email FROM accounts WHERE id = ?').get(accountId);
    
    const ticketNumber = getNextTicketNumber();
    insertTicket.run({
      ticket_number: ticketNumber,
      customer_name: account?.name || ticket.account,
      customer_contact: account?.email || '',
      account_id: accountId,
      serial_number: ticket.serial_number,
      service_type: ticket.service_type,
      channel: ticket.channel,
      problem_summary: ticket.problem_summary,
      communication_log: ticket.communication_log,
      status: ticket.status,
      handler_id: handlerId,
      created_by: userIds['jihua'] || 1
    });
    console.log(`  ✓ Created inquiry ticket: ${ticketNumber} - ${ticket.problem_summary.substring(0, 30)}...`);
  } catch (err) {
    console.log(`  ✗ Failed to create ticket: ${err.message}`);
  }
}

// ==================== 5. Create Test RMA Tickets ====================
console.log('\n📋 Creating Test RMA Tickets...');

// Check RMA table structure
const rmaTableInfo = db.prepare("PRAGMA table_info(rma_tickets_new)").all();
console.log(`  RMA table columns: ${rmaTableInfo.map(c => c.name).slice(0, 10).join(', ')}...`);

if (rmaTableInfo.length > 0) {
  const getNextRmaNumber = () => {
    const seq = db.prepare('SELECT MAX(CAST(SUBSTR(ticket_number, 5) AS INTEGER)) as max_num FROM rma_tickets_new WHERE ticket_number LIKE "RMA-%"').get();
    const nextNum = (seq.max_num || 0) + 1;
    return `RMA-${String(nextNum).padStart(6, '0')}`;
  };

  const rmaTickets = [
    {
      account: 'Test Customer A',
      serial_number: 'TEST-MAVO8K-001',
      fault_description: 'HDMI输出板故障，需要更换',
      repair_priority: 'High',
      handler: 'gaosong'
    },
    {
      account: 'Beijing Film Studio',
      serial_number: 'TEST-MAVOLF-001',
      fault_description: '镜头卡口组件松动，需要重新校准固定',
      repair_priority: 'Normal',
      handler: 'bishan'
    }
  ];
  
  for (const rma of rmaTickets) {
    try {
      const accountId = accountIds[rma.account];
      const handlerId = userIds[rma.handler];
      const ticketNumber = getNextRmaNumber();
      
      // Insert using actual column names
      const stmt = db.prepare(`
        INSERT INTO rma_tickets_new (
          ticket_number, serial_number, problem_description, 
          repair_priority, customer_id, assigned_to, 
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'Pending', datetime('now'), datetime('now'))
      `);
      stmt.run(ticketNumber, rma.serial_number, rma.fault_description, rma.repair_priority, accountId, handlerId);
      
      console.log(`  ✓ Created RMA ticket: ${ticketNumber} - ${rma.fault_description.substring(0, 30)}...`);
    } catch (err) {
      console.log(`  ✗ Failed to create RMA: ${err.message}`);
    }
  }
}

// ==================== 6. Create Activity Timeline Entries ====================
console.log('\n📋 Creating Activity Timeline (Comments)...');

// Check if ticket_activities table exists
const activityTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_activities'").get();

if (activityTable) {
  // Get user info for actor_name
  const getUserInfo = (username) => {
    const user = db.prepare('SELECT id, username, role FROM users WHERE username = ?').get(username);
    return user || { id: 1, username: 'system', role: 'admin' };
  };

  // Get inquiry ticket IDs
  const ticketIds = db.prepare('SELECT id, ticket_number FROM inquiry_tickets ORDER BY id DESC LIMIT 4').all();
  console.log(`  Found ${ticketIds.length} recent tickets for comments`);

  const activities = [
    { ticket_idx: 0, user: 'gaosong', type: 'comment', content: '已联系客户，确认是HDMI线缆问题，建议更换原厂线缆测试' },
    { ticket_idx: 0, user: 'bishan', type: 'comment', content: '@gaosong 如果换线后仍有问题，请安排返厂检测' },
    { ticket_idx: 2, user: 'cathy', type: 'comment', content: '固件日志已收集，@bishan 请帮忙分析' },
    { ticket_idx: 2, user: 'bishan', type: 'comment', content: '日志分析完成，是固件v2.1.5的已知问题，建议降级到v2.1.4' },
    { ticket_idx: 3, user: 'sherry', type: 'status_change', content: '状态更新: Pending → InProgress' },
  ];

  const insertActivity = db.prepare(`
    INSERT INTO ticket_activities (ticket_id, activity_type, content, actor_id, actor_name, actor_role, created_at)
    VALUES (@ticket_id, @activity_type, @content, @actor_id, @actor_name, @actor_role, datetime('now'))
  `);

  for (const activity of activities) {
    try {
      const ticket = ticketIds[activity.ticket_idx];
      if (!ticket) {
        console.log(`  ✗ Ticket index ${activity.ticket_idx} not found`);
        continue;
      }
      const userInfo = getUserInfo(activity.user);
      
      insertActivity.run({
        ticket_id: ticket.id,
        activity_type: activity.type,
        content: activity.content,
        actor_id: userInfo.id,
        actor_name: userInfo.username,
        actor_role: userInfo.role
      });
      console.log(`  ✓ Created activity: ${activity.user} ${activity.type} on ${ticket.ticket_number}`);
    } catch (err) {
      console.log(`  ✗ Failed to create activity: ${err.message}`);
    }
  }
} else {
  console.log('  ⚠ ticket_activities table not found, skipping...');
}

// ==================== Summary ====================
console.log('\n' + '='.repeat(60));
console.log(' Setup Complete!');
console.log('='.repeat(60));
console.log('\n  Test Users Created:');
users.forEach(u => {
  console.log(`    - ${u.username} (${u.role}, ${u.department_name}) - Password: ${u.password}`);
});
console.log('\n  Test Accounts:', Object.keys(accountIds).length);
console.log('  Test Devices:', devices.length);
console.log('  Test Inquiry Tickets:', inquiryTickets.length);
console.log('\n  Ready for P2 feature testing!');
console.log('='.repeat(60));

db.close();
