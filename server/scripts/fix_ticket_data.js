#!/usr/bin/env node
/**
 * 工单数据完整性修复脚本
 * 根据Service PRD P2规范调整工单数据
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'longhorn.db');
const db = new Database(DB_PATH);

// 启用外键约束
db.pragma('foreign_keys = ON');

// ==================== 配置 ====================
const USERS = {
  CATHY: 4,      // MS Lead
  SHERRY: 5,     // MS Lead
  BISHAN: 2,     // OP Lead
  GAOSONG: 3,    // OP Member
  EFFY: 6,       // MS Member
  JIHUA: 7,      // Admin
  SYSTEM: 1
};

const USER_NAMES = {
  [USERS.CATHY]: 'Cathy',
  [USERS.SHERRY]: 'Sherry',
  [USERS.BISHAN]: 'Bishan',
  [USERS.GAOSONG]: 'Gaosong',
  [USERS.EFFY]: 'Effy',
  [USERS.JIHUA]: 'Jihua',
  [USERS.SYSTEM]: 'System'
};

// P2规范的状态映射 - 必须符合数据库CHECK约束
const STATUS_MAPPING = {
  // 旧状态 -> 新状态 (必须符合: open, in_progress, waiting, resolved, closed, cancelled)
  'Pending': 'open',
  'InProgress': 'in_progress',
  'AwaitingFeedback': 'waiting',
  'Resolved': 'resolved',
  'AutoClosed': 'closed',
  'Upgraded': 'closed',
  'new': 'open',
  'processing': 'in_progress',
  'awaiting_customer': 'waiting',
  'awaiting_parts': 'waiting',
  'repairing': 'in_progress',
  'qa_check': 'in_progress',
  'converted': 'closed',
  'open': 'open',
  'closed': 'closed',
  'in_progress': 'in_progress',
  'resolved': 'resolved',
  'draft': 'open',
  'cancelled': 'cancelled'
};

// 节点映射 - 根据状态映射到对应节点
const NODE_MAPPING = {
  'open': 'MARKET',
  'in_progress': 'MARKET',
  'waiting': 'MARKET',
  'resolved': 'MARKET',
  'closed': 'MARKET',
  'cancelled': 'MARKET'
};

// ==================== 辅助函数 ====================
function generateTicketNumber(type, date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yymm = yy + mm;
  
  // 获取当前序列号
  const seqRow = db.prepare(`
    SELECT last_sequence FROM ticket_sequences 
    WHERE ticket_type = ? AND year_month = ?
  `).get(type, yymm);
  
  let seq = 1;
  if (seqRow) {
    seq = seqRow.last_sequence + 1;
    db.prepare(`
      UPDATE ticket_sequences SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP
      WHERE ticket_type = ? AND year_month = ?
    `).run(seq, type, yymm);
  } else {
    db.prepare(`
      INSERT INTO ticket_sequences (ticket_type, year_month, last_sequence)
      VALUES (?, ?, 1)
    `).run(type, yymm);
  }
  
  const seqStr = String(seq).padStart(4, '0');
  
  if (type === 'inquiry') {
    return `K${yymm}-${seqStr}`;
  } else if (type === 'rma') {
    return `RMA-D-${yymm}-${seqStr}`;
  } else if (type === 'svc') {
    return `SVC-D-${yymm}-${seqStr}`;
  }
  return `${type.toUpperCase()}-${yymm}-${seqStr}`;
}

function randomUser(userIds) {
  return userIds[Math.floor(Math.random() * userIds.length)];
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// ==================== 1. 修复现有工单数据 ====================
function fixExistingTickets() {
  console.log('\n=== 修复现有工单数据 ===');
  
  const tickets = db.prepare('SELECT * FROM tickets').all();
  let fixed = 0;
  
  const updateStmt = db.prepare(`
    UPDATE tickets SET
      current_node = ?,
      status = ?,
      submitted_by = COALESCE(submitted_by, ?),
      assigned_to = COALESCE(assigned_to, ?),
      created_by = COALESCE(created_by, ?),
      node_entered_at = COALESCE(node_entered_at, created_at),
      sla_due_at = COALESCE(sla_due_at, datetime(created_at, '+2 days')),
      sla_status = COALESCE(sla_status, 'normal'),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  tickets.forEach(ticket => {
    // 标准化状态
    let newStatus = STATUS_MAPPING[ticket.status] || ticket.status;
    if (!newStatus) newStatus = 'new';
    
    // 确定节点
    let node = ticket.current_node;
    if (!node || node === 'draft' || node === 'converted') {
      node = NODE_MAPPING[newStatus] || 'MARKET';
    }
    
    // 分配用户
    const msUsers = [USERS.CATHY, USERS.SHERRY, USERS.EFFY];
    const opUsers = [USERS.BISHAN, USERS.GAOSONG];
    
    let assignee = ticket.assigned_to;
    if (!assignee) {
      if (node === 'OPS') {
        assignee = randomUser(opUsers);
      } else {
        assignee = randomUser(msUsers);
      }
    }
    
    const creator = ticket.created_by || ticket.submitted_by || randomUser(msUsers);
    const submitter = ticket.submitted_by || creator;
    
    updateStmt.run(
      node,
      newStatus,
      submitter,
      assignee,
      creator,
      ticket.id
    );
    
    fixed++;
  });
  
  console.log(`✓ 修复了 ${fixed} 个工单`);
}

// ==================== 2. 创建RMA和SVC工单 ====================
function createRMAAndSVCTickets() {
  console.log('\n=== 创建RMA和SVC工单 ===');
  
  // 获取现有客户和产品
  const accounts = db.prepare('SELECT id, name FROM accounts LIMIT 20').all();
  const products = db.prepare('SELECT id, model_name FROM products').all();
  
  if (accounts.length === 0 || products.length === 0) {
    console.log('✗ 没有足够的客户或产品数据');
    return;
  }
  
  const msUsers = [USERS.CATHY, USERS.SHERRY, USERS.EFFY];
  const opUsers = [USERS.BISHAN, USERS.GAOSONG];
  
  // RMA问题类型 - 必须符合 issue_type CHECK约束
  const rmaIssues = [
    { type: 'production', category: 'Sensor', sub: 'Dead Pixels', desc: '发现传感器有坏点，影响拍摄质量' },
    { type: 'customer_return', category: 'Body', sub: 'Button Issue', desc: '录制按钮偶尔无响应' },
    { type: 'customer_return', category: 'Screen', sub: 'LCD Damage', desc: '屏幕出现亮线，需要更换' },
    { type: 'production', category: 'Firmware', sub: 'Boot Failure', desc: '固件升级后无法正常启动' },
    { type: 'shipping', category: 'Battery', sub: 'Charging Issue', desc: '电池无法充满，充电到80%停止' }
  ];
  
  // SVC问题类型 - 必须符合 issue_type CHECK约束
  const svcIssues = [
    { type: 'internal_sample', category: 'Cleaning', desc: '定期清洁维护，传感器除尘' },
    { type: 'internal_sample', category: 'Color', desc: '色彩校准服务' },
    { type: 'production', category: 'Firmware', desc: '固件升级和优化' },
    { type: 'customer_return', category: 'Mechanical', desc: '机械部件维修' }
  ];
  
  const insertTicket = db.prepare(`
    INSERT INTO tickets (
      ticket_number, ticket_type, current_node, status, priority,
      node_entered_at, sla_due_at, sla_status,
      account_id, contact_id, product_id, serial_number,
      issue_type, issue_category, issue_subcategory,
      problem_summary, problem_description,
      submitted_by, assigned_to, created_by,
      is_warranty, channel_code,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  // 创建15个RMA工单
  let rmaCount = 0;
  for (let i = 0; i < 15; i++) {
    const account = accounts[Math.floor(Math.random() * accounts.length)];
    const product = products[Math.floor(Math.random() * products.length)];
    const issue = rmaIssues[Math.floor(Math.random() * rmaIssues.length)];
    const submitter = randomUser(msUsers);
    const assignee = randomUser(opUsers);
    
    const statuses = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const node = NODE_MAPPING[status] || 'OPS';
    
    const createdAt = randomDate(new Date('2025-01-01'), new Date());
    
    try {
      insertTicket.run(
        generateTicketNumber('rma', createdAt),
        'rma',
        node,
        status,
        Math.random() > 0.7 ? 'P1' : 'P2',
        createdAt.toISOString(),
        new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        'normal',
        account.id,
        null,
        product.id,
        `SN${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        issue.type,
        issue.category,
        issue.sub,
        `${product.model_name} ${issue.sub}问题`,
        issue.desc,
        submitter,
        assignee,
        submitter,
        Math.random() > 0.3 ? 1 : 0,
        'D',
        createdAt.toISOString(),
        createdAt.toISOString()
      );
      rmaCount++;
    } catch (e) {
      console.error('RMA创建失败:', e.message);
    }
  }
  
  // 创建10个SVC工单
  let svcCount = 0;
  for (let i = 0; i < 10; i++) {
    const account = accounts[Math.floor(Math.random() * accounts.length)];
    const product = products[Math.floor(Math.random() * products.length)];
    const issue = svcIssues[Math.floor(Math.random() * svcIssues.length)];
    const submitter = randomUser(msUsers);
    const assignee = randomUser(opUsers);
    
    const statuses = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const node = NODE_MAPPING[status] || 'OPS';
    
    const createdAt = randomDate(new Date('2025-01-01'), new Date());
    
    try {
      insertTicket.run(
        generateTicketNumber('svc', createdAt),
        'svc',
        node,
        status,
        'P2',
        createdAt.toISOString(),
        new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        'normal',
        account.id,
        null,
        product.id,
        `SN${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        issue.type,
        issue.category,
        null,
        `${product.model_name} ${issue.category}服务`,
        issue.desc,
        submitter,
        assignee,
        submitter,
        0,
        'D',
        createdAt.toISOString(),
        createdAt.toISOString()
      );
      svcCount++;
    } catch (e) {
      console.error('SVC创建失败:', e.message);
    }
  }
  
  console.log(`✓ 创建了 ${rmaCount} 个RMA工单, ${svcCount} 个SVC工单`);
}

// ==================== 3. 添加Activities和Participants ====================
function addActivitiesAndParticipants() {
  console.log('\n=== 添加Activities和Participants ===');
  
  const tickets = db.prepare('SELECT * FROM tickets').all();
  const msUsers = [USERS.CATHY, USERS.SHERRY, USERS.EFFY];
  const opUsers = [USERS.BISHAN, USERS.GAOSONG];
  const allUsers = [...msUsers, ...opUsers];
  
  const insertActivity = db.prepare(`
    INSERT INTO ticket_activities (
      ticket_id, activity_type, content, content_html, metadata,
      visibility, actor_id, actor_name, actor_role, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertParticipant = db.prepare(`
    INSERT OR IGNORE INTO ticket_participants (
      ticket_id, user_id, role, added_by, join_method, notify_level, joined_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  let activityCount = 0;
  let participantCount = 0;
  
  // 评论模板
  const comments = [
    { user: USERS.CATHY, text: '客户反馈问题已记录，正在安排检测。' },
    { user: USERS.SHERRY, text: '@Bishan 请帮忙确认一下这个故障现象。' },
    { user: USERS.BISHAN, text: '收到，已经安排技术人员检测，预计明天出结果。' },
    { user: USERS.GAOSONG, text: '检测结果：确认是硬件故障，需要更换主板。' },
    { user: USERS.EFFY, text: '已联系客户确认维修方案，客户同意付费维修。' },
    { user: USERS.CATHY, text: '@Sherry 这个工单需要升级处理，客户是VIP。' },
    { user: USERS.SHERRY, text: '好的，我来跟进，优先安排。' },
    { user: USERS.BISHAN, text: '维修完成，已做完整测试，可以发货。' },
    { user: USERS.GAOSONG, text: '配件已更换，固件已升级到最新版本。' },
    { user: USERS.EFFY, text: '客户已确认收到设备，问题已解决。' }
  ];
  
  tickets.forEach(ticket => {
    // 添加参与者
    const participants = new Set();
    
    // 创建者/提交者
    if (ticket.submitted_by) {
      participants.add(ticket.submitted_by);
      insertParticipant.run(
        ticket.id, ticket.submitted_by, 'owner', null, 'auto', 'all', ticket.created_at
      );
      participantCount++;
    }
    
    // 处理人
    if (ticket.assigned_to && !participants.has(ticket.assigned_to)) {
      participants.add(ticket.assigned_to);
      insertParticipant.run(
        ticket.id, ticket.assigned_to, 'assignee', ticket.submitted_by || USERS.CATHY, 'invite', 'all', ticket.created_at
      );
      participantCount++;
    }
    
    // 随机添加2-4个协作者
    const numParticipants = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numParticipants; i++) {
      const userId = randomUser(allUsers);
      if (!participants.has(userId)) {
        participants.add(userId);
        insertParticipant.run(
          ticket.id, userId, 'mentioned', ticket.submitted_by || USERS.CATHY, 'mention', 'all', ticket.created_at
        );
        participantCount++;
      }
    }
    
    // 添加活动记录
    const numActivities = 3 + Math.floor(Math.random() * 5);
    const participantArray = Array.from(participants);
    
    for (let i = 0; i < numActivities; i++) {
      const comment = comments[Math.floor(Math.random() * comments.length)];
      const actorId = participantArray[Math.floor(Math.random() * participantArray.length)];
      const actorName = USER_NAMES[actorId] || 'Unknown';
      
      // 随机时间
      const activityTime = new Date(ticket.created_at);
      activityTime.setHours(activityTime.getHours() + i * 2 + Math.floor(Math.random() * 5));
      
      // 检查是否包含@提及
      const mentions = [];
      if (comment.text.includes('@')) {
        if (comment.text.includes('@Bishan')) mentions.push({ user_id: USERS.BISHAN, name: 'Bishan' });
        if (comment.text.includes('@Sherry')) mentions.push({ user_id: USERS.SHERRY, name: 'Sherry' });
      }
      
      const metadata = mentions.length > 0 ? JSON.stringify({ mentioned_users: mentions }) : null;
      
      insertActivity.run(
        ticket.id,
        'comment',
        comment.text,
        `<p>${comment.text}</p>`,
        metadata,
        'internal',
        actorId,
        actorName,
        'Member',
        activityTime.toISOString()
      );
      activityCount++;
    }
    
    // 添加状态变更记录
    if (ticket.status !== 'new') {
      const statusFlow = ['new', 'processing', 'awaiting_parts', 'repairing', 'resolved'];
      const currentIndex = statusFlow.indexOf(ticket.status);
      
      for (let i = 1; i <= currentIndex && i < statusFlow.length; i++) {
        const fromStatus = statusFlow[i - 1];
        const toStatus = statusFlow[i];
        const actorId = ticket.assigned_to || randomUser(allUsers);
        
        const changeTime = new Date(ticket.created_at);
        changeTime.setHours(changeTime.getHours() + i * 8);
        
        insertActivity.run(
          ticket.id,
          'status_change',
          `状态从 ${fromStatus} 变更为 ${toStatus}`,
          `<p>状态从 <strong>${fromStatus}</strong> 变更为 <strong>${toStatus}</strong></p>`,
          JSON.stringify({ from_status: fromStatus, to_status: toStatus }),
          'internal',
          actorId,
          USER_NAMES[actorId] || 'Unknown',
          'Member',
          changeTime.toISOString()
        );
        activityCount++;
      }
    }
  });
  
  console.log(`✓ 添加了 ${activityCount} 个活动记录, ${participantCount} 个参与者`);
}

// ==================== 4. 生成数据报告 ====================
function generateReport() {
  console.log('\n=== 生成数据报告 ===');
  
  const report = {
    timestamp: new Date().toISOString(),
    users: [],
    departments: [],
    tickets: {
      inquiry: [],
      rma: [],
      svc: []
    },
    accounts: [],
    products: []
  };
  
  // 用户
  report.users = db.prepare(`
    SELECT u.id, u.username, u.role, u.department_name, u.user_type,
           COUNT(DISTINCT tp.ticket_id) as ticket_count
    FROM users u
    LEFT JOIN ticket_participants tp ON u.id = tp.user_id
    GROUP BY u.id
  `).all();
  
  // 部门
  report.departments = db.prepare('SELECT * FROM departments').all();
  
  // 工单 - 按类型
  ['inquiry', 'rma', 'svc'].forEach(type => {
    report.tickets[type] = db.prepare(`
      SELECT t.*,
             a.name as account_name,
             p.model_name as product_name,
             u1.username as assigned_name,
             u2.username as submitted_name,
             COUNT(DISTINCT ta.id) as activity_count,
             COUNT(DISTINCT tp.user_id) as participant_count
      FROM tickets t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN products p ON t.product_id = p.id
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.submitted_by = u2.id
      LEFT JOIN ticket_activities ta ON t.id = ta.ticket_id
      LEFT JOIN ticket_participants tp ON t.id = tp.ticket_id
      WHERE t.ticket_type = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).all(type);
  });
  
  // 客户
  report.accounts = db.prepare(`
    SELECT a.*,
           COUNT(DISTINCT t.id) as ticket_count
    FROM accounts a
    LEFT JOIN tickets t ON a.id = t.account_id
    GROUP BY a.id
    ORDER BY ticket_count DESC
  `).all();
  
  // 产品
  report.products = db.prepare(`
    SELECT p.*,
           COUNT(DISTINCT t.id) as ticket_count
    FROM products p
    LEFT JOIN tickets t ON p.id = t.product_id
    GROUP BY p.id
  `).all();
  
  // 保存报告
  const fs = require('fs');
  const reportPath = path.join(__dirname, '..', 'data_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`✓ 报告已保存到: ${reportPath}`);
  
  // 打印摘要
  console.log('\n========== 数据报告摘要 ==========');
  console.log(`\n【用户】(${report.users.length}人)`);
  report.users.forEach(u => {
    console.log(`  - ${u.username} (${u.role}, ${u.department_name || '无部门'}): 参与${u.ticket_count}个工单`);
  });
  
  console.log(`\n【部门】(${report.departments.length}个)`);
  report.departments.forEach(d => {
    console.log(`  - ${d.name} (${d.code})`);
  });
  
  console.log(`\n【工单】`);
  Object.keys(report.tickets).forEach(type => {
    console.log(`  ${type.toUpperCase()}: ${report.tickets[type].length}个`);
    report.tickets[type].slice(0, 5).forEach(t => {
      console.log(`    - ${t.ticket_number}: ${t.status} (${t.account_name}, ${t.activity_count}活动, ${t.participant_count}参与者)`);
    });
    if (report.tickets[type].length > 5) {
      console.log(`    ... 还有 ${report.tickets[type].length - 5} 个`);
    }
  });
  
  console.log(`\n【客户】(${report.accounts.length}个)`);
  report.accounts.slice(0, 10).forEach(a => {
    console.log(`  - ${a.name}: ${a.ticket_count}个工单`);
  });
  
  console.log(`\n【产品】(${report.products.length}个)`);
  report.products.forEach(p => {
    console.log(`  - ${p.model_name}: ${p.ticket_count}个工单`);
  });
  
  return report;
}

// ==================== 主程序 ====================
console.log('=== 工单数据完整性修复 ===');
console.log('数据库:', DB_PATH);

try {
  // 开始事务
  db.exec('BEGIN TRANSACTION');
  
  // 1. 修复现有工单
  fixExistingTickets();
  
  // 2. 创建RMA和SVC工单
  createRMAAndSVCTickets();
  
  // 3. 添加Activities和Participants
  addActivitiesAndParticipants();
  
  // 4. 生成报告
  const report = generateReport();
  
  // 提交事务
  db.exec('COMMIT');
  
  console.log('\n=== 修复完成 ===');
  
} catch (error) {
  console.error('\n✗ 错误:', error.message);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}
