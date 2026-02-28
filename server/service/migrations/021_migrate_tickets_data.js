/**
 * Migration 021: Migrate Legacy Ticket Data to Unified Tickets Table
 * 
 * 从旧表迁移数据到统一 tickets 表:
 * - inquiry_tickets -> tickets (ticket_type='inquiry')
 * - rma_tickets -> tickets (ticket_type='rma')
 * - dealer_repairs -> tickets (ticket_type='svc')
 * 
 * 运行方式: node server/service/migrations/021_migrate_tickets_data.js
 */

const sqlite3 = require('better-sqlite3');
const path = require('path');

// 使用主数据库 longhorn.db，而不是 service.sqlite
const DB_PATH = path.join(__dirname, '../../longhorn.db');

// Status mapping: old status -> {current_node, status}
const INQUIRY_STATUS_MAP = {
  'InProgress': { current_node: 'in_progress', status: 'in_progress' },
  'AwaitingFeedback': { current_node: 'waiting_customer', status: 'waiting' },
  'Resolved': { current_node: 'resolved', status: 'resolved' },
  'AutoClosed': { current_node: 'auto_closed', status: 'closed' },
  'Upgraded': { current_node: 'converted', status: 'closed' }
};

const RMA_STATUS_MAP = {
  'Pending': { current_node: 'submitted', status: 'open' },
  'MSReview': { current_node: 'ms_review', status: 'in_progress' },
  'Receiving': { current_node: 'op_receiving', status: 'in_progress' },
  'Diagnosing': { current_node: 'op_diagnosing', status: 'in_progress' },
  'Repairing': { current_node: 'op_repairing', status: 'in_progress' },
  'QA': { current_node: 'op_qa', status: 'in_progress' },
  'MSClosing': { current_node: 'ms_closing', status: 'in_progress' },
  'Closed': { current_node: 'closed', status: 'closed' },
  'Cancelled': { current_node: 'cancelled', status: 'cancelled' }
};

const SVC_STATUS_MAP = {
  'InProgress': { current_node: 'dl_repairing', status: 'in_progress' },
  'Completed': { current_node: 'closed', status: 'closed' }
};

// Priority mapping: old repair_priority -> new priority
const PRIORITY_MAP = {
  'R1': 'P0',
  'R2': 'P1',
  'R3': 'P2'
};

function migrateData() {
  const db = sqlite3(DB_PATH);
  const now = new Date().toISOString();
  
  console.log('=== P2 数据迁移开始 ===\n');
  console.log(`数据库: ${DB_PATH}\n`);
  
  // 检查 tickets 表是否已有数据
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
  if (existingCount.count > 0) {
    console.log(`ℹ️  tickets 表已有 ${existingCount.count} 条记录，跳过迁移`);
    console.log('   如需重新迁移，请先清空 tickets 表');
    db.close();
    return;
  }
  
  // Begin transaction
  db.exec('BEGIN TRANSACTION');
  
  try {
    // 1. Migrate inquiry_tickets
    console.log('1. 迁移咨询工单 (inquiry_tickets)...');
    const inquiryTickets = db.prepare('SELECT * FROM inquiry_tickets').all();
    
    const insertInquiry = db.prepare(`
      INSERT INTO tickets (
        ticket_number, ticket_type, current_node, status,
        account_id, contact_id, dealer_id,
        reporter_name, reporter_type,
        product_id, serial_number,
        service_type, channel, problem_summary, communication_log, resolution,
        submitted_by, assigned_to, created_by,
        first_response_at,
        parent_ticket_id,
        priority, sla_status, breach_counter,
        created_at, updated_at
      ) VALUES (
        @ticket_number, 'inquiry', @current_node, @status,
        @account_id, NULL, @dealer_id,
        @customer_name, 'customer',
        @product_id, @serial_number,
        @service_type, @channel, @problem_summary, @communication_log, @resolution,
        @created_by, @handler_id, @created_by,
        @first_response_at,
        NULL,
        'P2', 'normal', 0,
        @created_at, @updated_at
      )
    `);
    
    let inquiryCount = 0;
    for (const ticket of inquiryTickets) {
      const statusMapping = INQUIRY_STATUS_MAP[ticket.status] || { current_node: 'draft', status: 'open' };
      
      insertInquiry.run({
        ticket_number: ticket.ticket_number,
        current_node: statusMapping.current_node,
        status: statusMapping.status,
        account_id: ticket.customer_id,
        dealer_id: ticket.dealer_id,
        customer_name: ticket.customer_name,
        product_id: ticket.product_id,
        serial_number: ticket.serial_number,
        service_type: ticket.service_type?.toLowerCase() || 'consultation',
        channel: ticket.channel?.toLowerCase(),
        problem_summary: ticket.problem_summary,
        communication_log: ticket.communication_log,
        resolution: ticket.resolution,
        handler_id: ticket.handler_id,
        created_by: ticket.created_by,
        first_response_at: ticket.first_response_at,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at
      });
      inquiryCount++;
    }
    console.log(`   ✓ 已迁移 ${inquiryCount} 条咨询工单\n`);
    
    // 2. Migrate rma_tickets (try rma_tickets_new first, fallback to rma_tickets)
    console.log('2. 迁移 RMA 工单...');
    let rmaTickets = [];
    try {
      rmaTickets = db.prepare('SELECT * FROM rma_tickets_new').all();
      console.log('   使用表: rma_tickets_new');
    } catch (e) {
      try {
        rmaTickets = db.prepare('SELECT * FROM rma_tickets').all();
        console.log('   使用表: rma_tickets');
      } catch (e2) {
        console.log('   ⚠️  RMA 表不存在，跳过');
      }
    }
    
    const insertRma = db.prepare(`
      INSERT INTO tickets (
        ticket_number, ticket_type, current_node, status,
        channel_code,
        account_id, contact_id, dealer_id,
        reporter_name, reporter_type,
        product_id, serial_number, firmware_version, hardware_version,
        issue_type, issue_category, issue_subcategory, severity,
        problem_description, solution_for_customer, is_warranty,
        repair_content, problem_analysis,
        submitted_by, assigned_to, created_by,
        payment_channel, payment_amount, payment_date,
        feedback_date, received_date, completed_date,
        approval_status, approved_by, approved_at,
        parent_ticket_id,
        priority, sla_status, breach_counter,
        created_at, updated_at
      ) VALUES (
        @ticket_number, 'rma', @current_node, @status,
        @channel_code,
        @account_id, NULL, @dealer_id,
        @reporter_name, @reporter_type,
        @product_id, @serial_number, @firmware_version, @hardware_version,
        @issue_type, @issue_category, @issue_subcategory, @severity,
        @problem_description, @solution_for_customer, @is_warranty,
        @repair_content, @problem_analysis,
        @submitted_by, @assigned_to, @submitted_by,
        @payment_channel, @payment_amount, @payment_date,
        @feedback_date, @received_date, @completed_date,
        @approval_status, @approved_by, @approved_at,
        @parent_ticket_id,
        @priority, 'normal', 0,
        @created_at, @updated_at
      )
    `);
    
    let rmaCount = 0;
    for (const ticket of rmaTickets) {
      const statusMapping = RMA_STATUS_MAP[ticket.status] || { current_node: 'submitted', status: 'open' };
      const priority = PRIORITY_MAP[ticket.repair_priority] || 'P2';
      const reporterType = ticket.channel_code === 'D' ? 'dealer' : (ticket.channel_code === 'I' ? 'internal' : 'customer');
      
      // Find corresponding inquiry ticket id in new table if exists
      let parentTicketId = null;
      if (ticket.inquiry_ticket_id) {
        const parentRow = db.prepare('SELECT id FROM tickets WHERE ticket_type = ? AND ticket_number = (SELECT ticket_number FROM inquiry_tickets WHERE id = ?)').get('inquiry', ticket.inquiry_ticket_id);
        if (parentRow) parentTicketId = parentRow.id;
      }
      
      insertRma.run({
        ticket_number: ticket.ticket_number,
        current_node: statusMapping.current_node,
        status: statusMapping.status,
        channel_code: ticket.channel_code || 'D',
        account_id: ticket.customer_id,
        dealer_id: ticket.dealer_id,
        reporter_name: ticket.reporter_name,
        reporter_type: reporterType,
        product_id: ticket.product_id,
        serial_number: ticket.serial_number,
        firmware_version: ticket.firmware_version,
        hardware_version: ticket.hardware_version,
        issue_type: ticket.issue_type,
        issue_category: ticket.issue_category,
        issue_subcategory: ticket.issue_subcategory,
        severity: ticket.severity || 3,
        problem_description: ticket.problem_description,
        solution_for_customer: ticket.solution_for_customer,
        is_warranty: ticket.is_warranty,
        repair_content: ticket.repair_content,
        problem_analysis: ticket.problem_analysis,
        submitted_by: ticket.submitted_by,
        assigned_to: ticket.assigned_to,
        payment_channel: ticket.payment_channel,
        payment_amount: ticket.payment_amount || 0,
        payment_date: ticket.payment_date,
        feedback_date: ticket.feedback_date,
        received_date: ticket.received_date,
        completed_date: ticket.completed_date,
        approval_status: ticket.approval_status,
        approved_by: ticket.approved_by,
        approved_at: ticket.approved_at,
        parent_ticket_id: parentTicketId,
        priority: priority,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at
      });
      rmaCount++;
    }
    console.log(`   ✓ 已迁移 ${rmaCount} 条 RMA 工单\n`);
    
    // 3. Migrate dealer_repairs (try dealer_repairs_new first, fallback to dealer_repairs)
    console.log('3. 迁移经销商维修单...');
    let svcTickets = [];
    try {
      svcTickets = db.prepare('SELECT * FROM dealer_repairs_new').all();
      console.log('   使用表: dealer_repairs_new');
    } catch (e) {
      try {
        svcTickets = db.prepare('SELECT * FROM dealer_repairs').all();
        console.log('   使用表: dealer_repairs');
      } catch (e2) {
        console.log('   ⚠️  经销商维修表不存在，跳过');
      }
    }
    
    const insertSvc = db.prepare(`
      INSERT INTO tickets (
        ticket_number, ticket_type, current_node, status,
        channel_code,
        account_id, contact_id, dealer_id,
        reporter_name, reporter_type,
        product_id, serial_number,
        issue_category, issue_subcategory,
        problem_description, repair_content,
        parent_ticket_id,
        priority, sla_status, breach_counter,
        created_at, updated_at
      ) VALUES (
        @ticket_number, 'svc', @current_node, @status,
        'D',
        @account_id, NULL, @dealer_id,
        @customer_name, 'dealer',
        @product_id, @serial_number,
        @issue_category, @issue_subcategory,
        @problem_description, @repair_content,
        @parent_ticket_id,
        'P2', 'normal', 0,
        @created_at, @updated_at
      )
    `);
    
    let svcCount = 0;
    for (const ticket of svcTickets) {
      const statusMapping = SVC_STATUS_MAP[ticket.status] || { current_node: 'closed', status: 'closed' };
      
      // Find corresponding inquiry ticket id in new table if exists
      let parentTicketId = null;
      if (ticket.inquiry_ticket_id) {
        const parentRow = db.prepare('SELECT id FROM tickets WHERE ticket_type = ? AND ticket_number = (SELECT ticket_number FROM inquiry_tickets WHERE id = ?)').get('inquiry', ticket.inquiry_ticket_id);
        if (parentRow) parentTicketId = parentRow.id;
      }
      
      insertSvc.run({
        ticket_number: ticket.ticket_number,
        current_node: statusMapping.current_node,
        status: statusMapping.status,
        account_id: ticket.customer_id,
        dealer_id: ticket.dealer_id,
        customer_name: ticket.customer_name,
        product_id: ticket.product_id,
        serial_number: ticket.serial_number,
        issue_category: ticket.issue_category,
        issue_subcategory: ticket.issue_subcategory,
        problem_description: ticket.problem_description,
        repair_content: ticket.repair_content,
        parent_ticket_id: parentTicketId,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at
      });
      svcCount++;
    }
    console.log(`   ✓ 已迁移 ${svcCount} 条经销商维修单\n`);
    
    // Commit transaction
    db.exec('COMMIT');
    
    // Summary
    console.log('=== 迁移完成 ===');
    console.log(`总计: ${inquiryCount + rmaCount + svcCount} 条工单`);
    console.log(`  - inquiry: ${inquiryCount}`);
    console.log(`  - rma: ${rmaCount}`);
    console.log(`  - svc: ${svcCount}`);
    
    // Verify
    const totalInNew = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
    console.log(`\n验证: tickets 表共有 ${totalInNew.count} 条记录`);
    
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('迁移失败:', err);
    throw err;
  } finally {
    db.close();
  }
}

// Run if called directly
if (require.main === module) {
  migrateData();
}

module.exports = { migrateData };
