/**
 * SLA Engine Service
 * P2 架构升级 - SLA 计算与管理
 * 
 * 参考: Service_PRD.md 1.2, Service_DataModel.md 2.1
 */

// SLA 时长矩阵 (单位: 小时)
const SLA_MATRIX = {
  P0: {
    first_response: 2,     // 首次响应
    solution: 4,           // 方案输出
    quote: 24,             // 报价输出
    close: 36              // 工单完结
  },
  P1: {
    first_response: 8,
    solution: 24,
    quote: 48,
    close: 72              // 3 工作日
  },
  P2: {
    first_response: 24,
    solution: 48,
    quote: 120,            // 5 天
    close: 168             // 7 工作日
  }
};

// 节点到 SLA 类型的映射
const NODE_SLA_TYPE_MAP = {
  // Inquiry 流程
  draft: 'first_response',
  in_progress: 'solution',
  waiting_customer: null,  // 等待客户不计 SLA
  resolved: null,
  auto_closed: null,
  converted: null,
  
  // RMA 流程
  submitted: 'first_response',
  ms_review: 'solution',
  op_receiving: 'solution',
  op_diagnosing: 'solution',
  op_repairing: 'close',
  op_qa: 'close',
  ms_closing: 'close',
  
  // SVC 流程
  ge_review: 'first_response',
  dl_receiving: 'solution',
  dl_repairing: 'close',
  dl_qa: 'close',
  ge_closing: 'close',
  
  // 终态
  closed: null,
  cancelled: null
};

// SLA 状态阈值
const WARNING_THRESHOLD = 0.25;  // 剩余 25% 时间时警告

/**
 * 计算 SLA 截止时间
 * @param {string} priority - P0/P1/P2
 * @param {string} currentNode - 当前状态机节点
 * @param {Date|string} nodeEnteredAt - 进入节点时间
 * @returns {Date|null} SLA 截止时间，如果该节点不计 SLA 返回 null
 */
function calculateSlaDue(priority, currentNode, nodeEnteredAt) {
  const slaType = NODE_SLA_TYPE_MAP[currentNode];
  if (!slaType) return null;
  
  const matrix = SLA_MATRIX[priority] || SLA_MATRIX.P2;
  const hours = matrix[slaType];
  if (!hours) return null;
  
  const enteredTime = new Date(nodeEnteredAt);
  const dueTime = new Date(enteredTime.getTime() + hours * 60 * 60 * 1000);
  
  return dueTime;
}

/**
 * 检查并计算 SLA 状态
 * @param {Object} ticket - 工单对象 (需包含 priority, current_node, node_entered_at, sla_due_at)
 * @returns {Object} { sla_status, remaining_hours, remaining_percent }
 */
function checkSlaStatus(ticket) {
  const { priority, current_node, node_entered_at, sla_due_at } = ticket;
  
  // 如果该节点不计 SLA
  const slaType = NODE_SLA_TYPE_MAP[current_node];
  if (!slaType || !sla_due_at) {
    return { sla_status: 'normal', remaining_hours: null, remaining_percent: null };
  }
  
  const now = new Date();
  const dueTime = new Date(sla_due_at);
  const enteredTime = new Date(node_entered_at);
  
  // 计算总时长和剩余时长
  const totalMs = dueTime.getTime() - enteredTime.getTime();
  const remainingMs = dueTime.getTime() - now.getTime();
  const remainingHours = remainingMs / (1000 * 60 * 60);
  const remainingPercent = remainingMs / totalMs;
  
  let sla_status = 'normal';
  
  if (remainingMs <= 0) {
    sla_status = 'breached';  // 已超时
  } else if (remainingPercent <= WARNING_THRESHOLD) {
    sla_status = 'warning';   // 即将超时
  }
  
  return {
    sla_status,
    remaining_hours: Math.max(0, remainingHours),
    remaining_percent: Math.max(0, remainingPercent)
  };
}

/**
 * 节点变更时更新 SLA 字段
 * @param {Object} db - better-sqlite3 数据库实例
 * @param {number} ticketId - 工单 ID
 * @param {string} newNode - 新节点
 * @param {string} priority - 优先级
 * @returns {Object} 更新后的 SLA 信息
 */
function updateSlaOnNodeChange(db, ticketId, newNode, priority) {
  const now = new Date().toISOString();
  
  // 计算新节点的 SLA 截止时间
  const slaDue = calculateSlaDue(priority, newNode, now);
  const slaDueStr = slaDue ? slaDue.toISOString() : null;
  
  // 检查是否超时（针对旧节点）
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  let breachCounter = ticket?.breach_counter || 0;
  
  if (ticket?.sla_due_at) {
    const oldDue = new Date(ticket.sla_due_at);
    if (new Date() > oldDue) {
      breachCounter += 1;  // 旧节点超时，累加计数
    }
  }
  
  // 更新工单
  const updateStmt = db.prepare(`
    UPDATE tickets SET
      current_node = ?,
      node_entered_at = ?,
      sla_due_at = ?,
      sla_status = 'normal',
      breach_counter = ?,
      status_changed_at = ?,
      updated_at = ?
    WHERE id = ?
  `);
  
  updateStmt.run(newNode, now, slaDueStr, breachCounter, now, now, ticketId);
  
  return {
    current_node: newNode,
    node_entered_at: now,
    sla_due_at: slaDueStr,
    sla_status: 'normal',
    breach_counter: breachCounter
  };
}

/**
 * 批量检查所有工单的 SLA 状态（用于定时任务）
 * @param {Object} db - better-sqlite3 数据库实例
 * @returns {Object} { updated: number, warnings: [], breaches: [] }
 */
function batchCheckSlaStatus(db) {
  const now = new Date().toISOString();
  
  // 获取所有非终态且有 SLA 截止时间的工单
  const tickets = db.prepare(`
    SELECT id, ticket_number, priority, current_node, node_entered_at, sla_due_at, sla_status, assigned_to
    FROM tickets
    WHERE sla_due_at IS NOT NULL
      AND status NOT IN ('closed', 'cancelled', 'resolved')
  `).all();
  
  const warnings = [];
  const breaches = [];
  let updated = 0;
  
  const updateStmt = db.prepare(`
    UPDATE tickets SET sla_status = ?, updated_at = ? WHERE id = ?
  `);
  
  for (const ticket of tickets) {
    const { sla_status, remaining_percent } = checkSlaStatus(ticket);
    
    // 如果状态有变化，更新数据库
    if (sla_status !== ticket.sla_status) {
      updateStmt.run(sla_status, now, ticket.id);
      updated++;
      
      // 记录警告和超时
      if (sla_status === 'warning' && ticket.sla_status === 'normal') {
        warnings.push({
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
          assigned_to: ticket.assigned_to,
          remaining_percent
        });
      } else if (sla_status === 'breached') {
        breaches.push({
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
          assigned_to: ticket.assigned_to
        });
      }
    }
  }
  
  return { updated, warnings, breaches };
}

/**
 * 获取 SLA 时长矩阵
 */
function getSlaMatrix() {
  return SLA_MATRIX;
}

/**
 * 格式化剩余时间为人类可读字符串
 * @param {number} hours - 剩余小时数
 * @returns {string} 格式化后的字符串
 */
function formatRemainingTime(hours) {
  if (hours <= 0) return '已超时';
  
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} 分钟`;
  } else if (hours < 24) {
    return `${Math.round(hours)} 小时`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    if (remainingHours > 0) {
      return `${days} 天 ${remainingHours} 小时`;
    }
    return `${days} 天`;
  }
}

module.exports = {
  SLA_MATRIX,
  NODE_SLA_TYPE_MAP,
  calculateSlaDue,
  checkSlaStatus,
  updateSlaOnNodeChange,
  batchCheckSlaStatus,
  getSlaMatrix,
  formatRemainingTime
};
