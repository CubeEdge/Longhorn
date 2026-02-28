/**
 * SLA Validation & Performance Optimization Script
 * P2 架构升级验证
 * 
 * 运行: node server/scripts/validate_sla.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../longhorn.db');
const db = new Database(DB_PATH);

console.log('=== SLA 验证与性能优化 ===\n');

// ==============================
// 1. SLA 数据完整性验证
// ==============================

function validateSlaData() {
  console.log('1. SLA 数据完整性检查...\n');
  
  // 检查所有开放工单是否有 SLA 字段
  const openTickets = db.prepare(`
    SELECT id, ticket_number, priority, current_node, sla_status, sla_due_at, node_entered_at
    FROM tickets
    WHERE status NOT IN ('closed', 'cancelled', 'resolved')
  `).all();
  
  console.log(`   开放工单总数: ${openTickets.length}`);
  
  const issues = [];
  
  for (const ticket of openTickets) {
    // 检查优先级
    if (!['P0', 'P1', 'P2'].includes(ticket.priority)) {
      issues.push(`${ticket.ticket_number}: 无效优先级 "${ticket.priority}"`);
    }
    
    // 检查 SLA 字段
    if (!ticket.node_entered_at) {
      issues.push(`${ticket.ticket_number}: 缺少 node_entered_at`);
    }
    
    // 检查 SLA 状态
    if (!['normal', 'warning', 'breached'].includes(ticket.sla_status)) {
      issues.push(`${ticket.ticket_number}: 无效 SLA 状态 "${ticket.sla_status}"`);
    }
  }
  
  if (issues.length > 0) {
    console.log(`   ⚠️  发现 ${issues.length} 个问题:`);
    issues.slice(0, 5).forEach(i => console.log(`      - ${i}`));
    if (issues.length > 5) console.log(`      ... 还有 ${issues.length - 5} 个问题`);
  } else {
    console.log('   ✓ SLA 数据完整\n');
  }
  
  return issues;
}

// ==============================
// 2. SLA 计算准确性验证
// ==============================

function validateSlaCalculation() {
  console.log('2. SLA 计算准确性验证...\n');
  
  const SLA_MATRIX = {
    P0: { first_response: 2, solution: 4, quote: 24, close: 36 },
    P1: { first_response: 8, solution: 24, quote: 48, close: 72 },
    P2: { first_response: 24, solution: 48, quote: 120, close: 168 }
  };
  
  const tickets = db.prepare(`
    SELECT id, ticket_number, priority, current_node, node_entered_at, sla_due_at
    FROM tickets
    WHERE sla_due_at IS NOT NULL AND status NOT IN ('closed', 'cancelled', 'resolved')
    LIMIT 10
  `).all();
  
  console.log(`   抽样验证 ${tickets.length} 条工单:`);
  
  let correct = 0;
  let incorrect = 0;
  
  for (const ticket of tickets) {
    const matrix = SLA_MATRIX[ticket.priority] || SLA_MATRIX.P2;
    const slaType = getSlaType(ticket.current_node);
    
    if (!slaType) continue;
    
    const hours = matrix[slaType];
    const enteredTime = new Date(ticket.node_entered_at);
    const expectedDue = new Date(enteredTime.getTime() + hours * 60 * 60 * 1000);
    const actualDue = new Date(ticket.sla_due_at);
    
    // 允许 1 分钟误差
    const diff = Math.abs(expectedDue.getTime() - actualDue.getTime());
    
    if (diff < 60000) {
      correct++;
    } else {
      incorrect++;
      console.log(`      ⚠️  ${ticket.ticket_number}: 预期 ${expectedDue.toISOString()}, 实际 ${actualDue.toISOString()}`);
    }
  }
  
  console.log(`   ✓ 正确: ${correct}, 错误: ${incorrect}\n`);
  
  return { correct, incorrect };
}

function getSlaType(node) {
  const mapping = {
    draft: 'first_response',
    in_progress: 'solution',
    submitted: 'first_response',
    ms_review: 'solution',
    op_receiving: 'solution',
    op_diagnosing: 'solution',
    op_repairing: 'close',
    op_qa: 'close',
    ms_closing: 'close',
    ge_review: 'first_response',
    dl_receiving: 'solution',
    dl_repairing: 'close',
    dl_qa: 'close',
    ge_closing: 'close'
  };
  return mapping[node] || null;
}

// ==============================
// 3. 性能优化 - 添加索引
// ==============================

function optimizeIndexes() {
  console.log('3. 性能优化 - 检查索引...\n');
  
  const requiredIndexes = [
    { name: 'idx_tickets_status', sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)' },
    { name: 'idx_tickets_type', sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(ticket_type)' },
    { name: 'idx_tickets_priority', sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority)' },
    { name: 'idx_tickets_sla_status', sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_sla_status ON tickets(sla_status)' },
    { name: 'idx_tickets_sla_due', sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_sla_due ON tickets(sla_due_at)' },
    { name: 'idx_tickets_assigned', sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to)' },
    { name: 'idx_tickets_dealer', sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_dealer ON tickets(dealer_id)' },
    { name: 'idx_tickets_created', sql: 'CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at)' },
    { name: 'idx_activities_ticket', sql: 'CREATE INDEX IF NOT EXISTS idx_activities_ticket ON ticket_activities(ticket_id)' },
    { name: 'idx_activities_created', sql: 'CREATE INDEX IF NOT EXISTS idx_activities_created ON ticket_activities(created_at)' },
    { name: 'idx_notifications_recipient', sql: 'CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id)' },
    { name: 'idx_notifications_read', sql: 'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)' }
  ];
  
  let created = 0;
  
  for (const idx of requiredIndexes) {
    try {
      db.exec(idx.sql);
      created++;
    } catch (err) {
      console.log(`   ⚠️  索引 ${idx.name} 创建失败: ${err.message}`);
    }
  }
  
  console.log(`   ✓ 确保 ${created}/${requiredIndexes.length} 个索引存在\n`);
  
  return created;
}

// ==============================
// 4. 数据统计
// ==============================

function generateStats() {
  console.log('4. 数据统计...\n');
  
  const stats = {
    total: db.prepare('SELECT COUNT(*) as count FROM tickets').get().count,
    by_type: db.prepare(`
      SELECT ticket_type, COUNT(*) as count 
      FROM tickets GROUP BY ticket_type
    `).all(),
    by_status: db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM tickets GROUP BY status
    `).all(),
    by_priority: db.prepare(`
      SELECT priority, COUNT(*) as count 
      FROM tickets GROUP BY priority
    `).all(),
    by_sla: db.prepare(`
      SELECT sla_status, COUNT(*) as count 
      FROM tickets WHERE status NOT IN ('closed', 'cancelled', 'resolved')
      GROUP BY sla_status
    `).all()
  };
  
  console.log(`   总工单数: ${stats.total}`);
  console.log(`   按类型: ${stats.by_type.map(t => `${t.ticket_type}(${t.count})`).join(', ')}`);
  console.log(`   按状态: ${stats.by_status.map(t => `${t.status}(${t.count})`).join(', ')}`);
  console.log(`   按优先级: ${stats.by_priority.map(t => `${t.priority}(${t.count})`).join(', ')}`);
  console.log(`   开放工单 SLA: ${stats.by_sla.map(t => `${t.sla_status}(${t.count})`).join(', ')}`);
  console.log();
  
  return stats;
}

// ==============================
// 运行验证
// ==============================

try {
  validateSlaData();
  validateSlaCalculation();
  optimizeIndexes();
  generateStats();
  
  console.log('=== 验证完成 ===\n');
} catch (err) {
  console.error('验证出错:', err);
} finally {
  db.close();
}
