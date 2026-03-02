#!/usr/bin/env node
/**
 * 工单状态修复脚本
 * 将数据库中的统一状态映射回前端期望的特定状态
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'longhorn.db');
const db = new Database(DB_PATH);

// 启用外键约束
db.pragma('foreign_keys = ON');

console.log('=== 工单状态映射修复 ===');

// ==================== 状态映射定义 ====================

// RMA 状态映射 (open/in_progress/waiting/resolved/closed -> Pending/Confirming/Diagnosing/InRepair/Repaired/Shipped/Completed/Cancelled)
const RMA_STATUS_MAP = {
  'open': 'Pending',        // 新工单 -> 待收货
  'in_progress': 'Diagnosing',  // 处理中 -> 检测中
  'waiting': 'InRepair',    // 等待中 -> 维修中
  'resolved': 'Repaired',   // 已解决 -> 已修复
  'closed': 'Completed',    // 已关闭 -> 已完成
  'cancelled': 'Cancelled'  // 已取消 -> 已取消
};

// 咨询工单状态映射
const INQUIRY_STATUS_MAP = {
  'open': 'Pending',        // 新工单 -> 待处理
  'in_progress': 'InProgress',  // 处理中 -> 处理中
  'waiting': 'AwaitingFeedback', // 等待中 -> 待客户反馈
  'resolved': 'Resolved',   // 已解决 -> 已解决
  'closed': 'AutoClosed',   // 已关闭 -> 自动关闭
  'cancelled': 'Upgraded'   // 已取消 -> 已升级 (作为默认)
};

// SVC 状态映射 (与RMA类似)
const SVC_STATUS_MAP = {
  'open': 'Pending',
  'in_progress': 'Diagnosing',
  'waiting': 'InRepair',
  'resolved': 'Repaired',
  'closed': 'Completed',
  'cancelled': 'Cancelled'
};

// ==================== 修复函数 ====================

function fixRMAStatus() {
  console.log('\n--- 修复 RMA 工单状态 ---');
  
  let updated = 0;
  const tickets = db.prepare("SELECT id, status FROM tickets WHERE ticket_type = 'rma'").all();
  
  const updateStmt = db.prepare("UPDATE tickets SET status = ? WHERE id = ?");
  
  tickets.forEach(ticket => {
    const newStatus = RMA_STATUS_MAP[ticket.status] || ticket.status;
    if (newStatus !== ticket.status) {
      updateStmt.run(newStatus, ticket.id);
      updated++;
    }
  });
  
  console.log(`✓ 更新了 ${updated} 个 RMA 工单状态`);
  return updated;
}

function fixInquiryStatus() {
  console.log('\n--- 修复咨询工单状态 ---');
  
  let updated = 0;
  const tickets = db.prepare("SELECT id, status FROM tickets WHERE ticket_type = 'inquiry'").all();
  
  const updateStmt = db.prepare("UPDATE tickets SET status = ? WHERE id = ?");
  
  tickets.forEach(ticket => {
    const newStatus = INQUIRY_STATUS_MAP[ticket.status] || ticket.status;
    if (newStatus !== ticket.status) {
      updateStmt.run(newStatus, ticket.id);
      updated++;
    }
  });
  
  console.log(`✓ 更新了 ${updated} 个咨询工单状态`);
  return updated;
}

function fixSVCStatus() {
  console.log('\n--- 修复 SVC 工单状态 ---');
  
  let updated = 0;
  const tickets = db.prepare("SELECT id, status FROM tickets WHERE ticket_type = 'svc'").all();
  
  const updateStmt = db.prepare("UPDATE tickets SET status = ? WHERE id = ?");
  
  tickets.forEach(ticket => {
    const newStatus = SVC_STATUS_MAP[ticket.status] || ticket.status;
    if (newStatus !== ticket.status) {
      updateStmt.run(newStatus, ticket.id);
      updated++;
    }
  });
  
  console.log(`✓ 更新了 ${updated} 个 SVC 工单状态`);
  return updated;
}

// ==================== 修复 current_node ====================

function fixCurrentNode() {
  console.log('\n--- 修复 current_node 字段 ---');
  
  // 根据 ticket_type 和 status 设置合适的 current_node
  const nodeMapping = {
    'rma': {
      'Pending': 'submitted',
      'Confirming': 'ms_review',
      'Diagnosing': 'op_diagnosing',
      'InRepair': 'op_repairing',
      'Repaired': 'op_qa',
      'Shipped': 'ms_closing',
      'Completed': 'closed',
      'Cancelled': 'closed'
    },
    'svc': {
      'Pending': 'submitted',
      'Confirming': 'ge_review',
      'Diagnosing': 'dl_repairing',
      'InRepair': 'dl_repairing',
      'Repaired': 'dl_qa',
      'Shipped': 'ge_closing',
      'Completed': 'closed',
      'Cancelled': 'closed'
    },
    'inquiry': {
      'Pending': 'draft',
      'InProgress': 'in_progress',
      'AwaitingFeedback': 'waiting_customer',
      'Resolved': 'resolved',
      'AutoClosed': 'auto_closed',
      'Upgraded': 'converted'
    }
  };
  
  let updated = 0;
  const tickets = db.prepare("SELECT id, ticket_type, status FROM tickets").all();
  
  const updateStmt = db.prepare("UPDATE tickets SET current_node = ? WHERE id = ?");
  
  tickets.forEach(ticket => {
    const typeMap = nodeMapping[ticket.ticket_type];
    if (typeMap) {
      const newNode = typeMap[ticket.status];
      if (newNode) {
        updateStmt.run(newNode, ticket.id);
        updated++;
      }
    }
  });
  
  console.log(`✓ 更新了 ${updated} 个工单的 current_node`);
  return updated;
}

// ==================== 主程序 ====================

try {
  db.exec('BEGIN TRANSACTION');
  
  const rmaUpdated = fixRMAStatus();
  const inquiryUpdated = fixInquiryStatus();
  const svcUpdated = fixSVCStatus();
  const nodeUpdated = fixCurrentNode();
  
  db.exec('COMMIT');
  
  console.log('\n=== 修复完成 ===');
  console.log(`RMA: ${rmaUpdated} 个`);
  console.log(`咨询: ${inquiryUpdated} 个`);
  console.log(`SVC: ${svcUpdated} 个`);
  console.log(`节点: ${nodeUpdated} 个`);
  
  // 验证结果
  console.log('\n=== 状态分布验证 ===');
  const statusDist = db.prepare(`
    SELECT ticket_type, status, COUNT(*) as count 
    FROM tickets 
    GROUP BY ticket_type, status
    ORDER BY ticket_type, status
  `).all();
  
  statusDist.forEach(row => {
    console.log(`${row.ticket_type}: ${row.status} = ${row.count}`);
  });
  
} catch (error) {
  console.error('\n✗ 错误:', error.message);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}
