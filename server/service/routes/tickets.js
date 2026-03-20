/**
 * Unified Tickets Routes (统一工单 API)
 * P2 架构升级 - 单表多态设计
 * 
 * 支持工单类型: inquiry, rma, svc
 * 参考: Service_API.md Section 22
 */

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const slaService = require('../sla_service');
const { hasGlobalAccess } = require('../middleware/permission');

module.exports = function (db, authenticate, serviceUpload) {
    const router = express.Router();

    // PRD §7.1 - 强制审计字段清单 (Audit Field Whitelist)
    const AUDIT_FIELDS = [
        // 设备标识 (Identity)
        'serial_number', 'product_id',
        // 主体归属 (Ownership)
        'account_id', 'contact_id', 'dealer_id',
        // 内容与诊断 (Content)
        'problem_summary', 'problem_description', 'repair_content',
        // 经济责任 (Financial)
        'is_warranty', 'payment_amount',
        // 时效契约 (SLA)
        'priority', 'sla_due_at',
        // 原始证据 (Proof)
        'reporter_snapshot'
    ];

    // PRD §7.1 - 终结期节点 (禁止普通用户修改)
    const FINALIZED_NODES = ['resolved', 'closed', 'auto_closed', 'converted', 'cancelled'];

    // 字段名称映射 (用于时间轴显示)
    const FIELD_LABELS = {
        serial_number: '序列号',
        product_id: '产品型号',
        account_id: '关联公司',
        contact_id: '联系人',
        dealer_id: '经销商',
        problem_summary: '问题简述',
        problem_description: '详细描述',
        repair_content: '维修内容',
        is_warranty: '保修判定',
        payment_amount: '金额',
        priority: '优先级',
        current_node: '当前节点',
        assigned_to: '指派人',
        sla_due_at: 'SLA死线',
        reporter_snapshot: '报修人快照'
    };

    const DEPARTMENT_NODES = {
        'MS': ['draft', 'submitted', 'ms_review', 'waiting_customer', 'ms_closing', 'handling', 'awaiting_customer'],
        'OP': ['op_receiving', 'op_diagnosing', 'op_repairing', 'op_shipping', 'op_shipping_transit', 'op_qa'],
        'GE': ['ge_review', 'ge_closing'],
        'RD': ['op_diagnosing', 'op_repairing']
    };

    function getDeptCode(user) {
        if (!user) return null;
        // First priority: already normalized department_code
        if (user.department_code && /^[A-Z]{2,3}$/.test(user.department_code)) return user.department_code;
        // Chinese full name mapping (production DB stores Chinese names)
        const chineseMap = {
            '市场部': 'MS', '生产运营部': 'OP', '运营部': 'OP',
            '研发部': 'RD', '通用台面': 'GE', '综合部': 'GE', '管理层': 'GE'
        };
        if (user.department_code && chineseMap[user.department_code]) return chineseMap[user.department_code];
        if (user.department_name && chineseMap[user.department_name]) return chineseMap[user.department_name];
        // Legacy: parse from parentheses format e.g. "Market (MS)"
        if (user.department_name) {
            const match = user.department_name.match(/\(([A-Z]+)\)/);
            if (match) return match[1];
            if (/^[A-Z]{2,3}$/.test(user.department_name)) return user.department_name;
        }
        return null;
    }

    /**
     * Generate Ticket Number based on type
     * inquiry: KYYMM-XXXX
     * rma: RMA-{C/D}-YYMM-XXXX
     * svc: SVC-D-YYMM-XXXX
     */
    function generateTicketNumber(ticketType, channelCode = 'D') {
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yearMonth = yy + mm;

        // Get or create sequence
        const existing = db.prepare(`
            SELECT last_sequence FROM ticket_sequences 
            WHERE ticket_type = ? AND (channel_code = ? OR channel_code IS NULL) AND year_month = ?
        `).get(ticketType, channelCode, yearMonth);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare(`
                UPDATE ticket_sequences SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE ticket_type = ? AND (channel_code = ? OR channel_code IS NULL) AND year_month = ?
            `).run(seq, ticketType, channelCode, yearMonth);
        } else {
            seq = 1;
            db.prepare(`
                INSERT INTO ticket_sequences (ticket_type, channel_code, year_month, last_sequence) 
                VALUES (?, ?, ?, ?)
            `).run(ticketType, ticketType === 'inquiry' ? null : channelCode, yearMonth, seq);
        }

        const seqStr = seq <= 9999
            ? String(seq).padStart(4, '0')
            : seq.toString(16).toUpperCase().padStart(4, '0');

        switch (ticketType) {
            case 'inquiry':
                return `K${yearMonth}-${seqStr}`;
            case 'rma':
                return `RMA-${channelCode}-${yearMonth}-${seqStr}`;
            case 'svc':
                return `SVC-D-${yearMonth}-${seqStr}`;
            default:
                return `TKT-${yearMonth}-${seqStr}`;
        }
    }

    /**
     * Auto-assign a ticket based on department dispatch rules
     */
    function autoAssignTicket(id, nodeId, ticketType, actorId = null) {
        try {
            let targetAssigneeId = null;
            let assignLogContent = '';

            // Find the department for this node
            let targetDept = null;

            // Priority: if node starts with department prefix, use that department
            if (nodeId.startsWith('op_')) {
                targetDept = 'OP';
            } else if (nodeId.startsWith('ms_')) {
                targetDept = 'MS';
            } else if (nodeId.startsWith('ge_')) {
                targetDept = 'GE';
            } else if (nodeId.startsWith('rd_')) {
                targetDept = 'RD';
            } else {
                // Generic fallback search
                for (const [dept, nodes] of Object.entries(DEPARTMENT_NODES)) {
                    if (nodes.includes(nodeId)) {
                        targetDept = dept;
                        break;
                    }
                }
            }

            if (!targetDept) return;

            // 1. Get the department Info (code column stores 'OP', 'MS', etc.)
            const dept = db.prepare('SELECT id, auto_dispatch_enabled, lead_id FROM departments WHERE code = ?').get(targetDept);
            if (!dept) return;

            // 2. Fetch dispatch rule ONLY IF auto_dispatch is ON

            if (dept.auto_dispatch_enabled === 1) {
                const rule = db.prepare(`
                    SELECT default_assignee_id 
                    FROM dispatch_rules 
                    WHERE department_id = ? AND ticket_type = ? AND node_key = ? AND is_enabled = 1
                `).get(dept.id, ticketType.toLowerCase(), nodeId);

                if (rule && rule.default_assignee_id) {
                    if (rule.default_assignee_id === -1) {
                        const creator = db.prepare('SELECT submitted_by FROM tickets WHERE id = ?').get(id);
                        if (creator && creator.submitted_by) {
                            targetAssigneeId = creator.submitted_by;
                            assignLogContent = `系统依据 [返回创建人] 规则自动指派给: {assigneeName}`;
                        }
                    } else {
                        targetAssigneeId = rule.default_assignee_id;
                        assignLogContent = `系统依据分发规则自动指派给: {assigneeName}`;
                    }
                }
            }

            // 3. FALLBACK LOGIC (Run if no rule matched OR auto_dispatch was OFF)
            if (!targetAssigneeId) {
                if (targetDept === 'OP') {
                    // OP: No rule → release to department pool (NULL assignee)
                    targetAssigneeId = null;
                } else if (targetDept === 'MS') {
                    // MS: No rule → find last MS handler for this ticket
                    const lastDeptOwner = db.prepare(`
                        SELECT tp.user_id 
                        FROM ticket_participants tp
                        JOIN users u ON tp.user_id = u.id
                        WHERE tp.ticket_id = ? AND u.department_id = ? AND tp.role = 'assignee'
                        ORDER BY tp.joined_at DESC
                        LIMIT 1
                    `).get(id, dept.id);

                    if (lastDeptOwner) {
                        targetAssigneeId = lastDeptOwner.user_id;
                        assignLogContent = `系统依据 [返回本部门原处理人] 规则自动指派给: {assigneeName}`;
                    } else {
                        // 优先 1：如果是本部门成员创建，或者具备 Global 权限/管理员，指派给创建人进行处理
                        const creator = db.prepare(`
                            SELECT t.submitted_by, u.department_id, u.user_type, u.role, u.username
                            FROM tickets t 
                            JOIN users u ON t.submitted_by = u.id 
                            WHERE t.id = ?
                        `).get(id);

                        const isPrivileged = creator && (
                            creator.department_id === dept.id || 
                            creator.user_type === 'Global' || 
                            creator.username === 'admin'
                        );

                        if (isPrivileged) {
                            targetAssigneeId = creator.submitted_by;
                            assignLogContent = `系统依据 [指派提交者] 规则自动指派给: {assigneeName}`;
                        } else if (dept.lead_id) {
                            // 优先 2：部门负责人
                            targetAssigneeId = dept.lead_id;
                            assignLogContent = `系统依据 [部门负责人] 防呆规则自动指派给: {assigneeName}`;
                        } else {
                            targetAssigneeId = null;
                        }
                    }
                } else {
                    // GE/RD: Fallback to department Lead if exists
                    if (dept.lead_id) {
                        targetAssigneeId = dept.lead_id;
                        assignLogContent = `系统依据 [部门负责人] 规则自动指派给: {assigneeName}`;
                    } else {
                        // Fallback: creator (only if they are in target dept)
                        const creator = db.prepare(`
                            SELECT t.submitted_by, u.department_id 
                            FROM tickets t 
                            JOIN users u ON t.submitted_by = u.id 
                            WHERE t.id = ?
                        `).get(id);

                        if (creator && creator.department_id === dept.id) {
                            targetAssigneeId = creator.submitted_by;
                            assignLogContent = `系统依据 [返回创建人] 防呆规则自动指派给: {assigneeName}`;
                        } else {
                            targetAssigneeId = null;
                        }
                    }
                }
            }     // 4. APPLY ASSIGNMENT OR CROSS-DEPT CLEARANCE
            const now = new Date().toISOString();
            const ticket = db.prepare('SELECT assigned_to FROM tickets WHERE id = ?').get(id);
            const oldAssigneeId = ticket ? ticket.assigned_to : null;

            if (targetAssigneeId) {
                // Apply the found assignee
                db.prepare(`
                    UPDATE tickets SET 
                        assigned_to = ?, 
                        updated_at = ?
                    WHERE id = ?
                `).run(targetAssigneeId, now, id);

                // Add activity
                const assignee = db.prepare('SELECT username, display_name FROM users WHERE id = ?').get(targetAssigneeId);
                const assigneeName = assignee ? (assignee.display_name || assignee.username) : '未知负责人';

                let content = assignLogContent.replace('{assigneeName}', assigneeName);
                if (oldAssigneeId && oldAssigneeId !== targetAssigneeId) {
                    const oldAssignee = db.prepare('SELECT username, display_name FROM users WHERE id = ?').get(oldAssigneeId);
                    const oldName = oldAssignee ? (oldAssignee.display_name || oldAssignee.username) : '原负责人';
                    content = `[系统分发]: 对接人从 "${oldName}" 变更为 "${assigneeName}"。`;
                }

                db.prepare(`
                    INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                    VALUES (?, 'assignment_change', ?, ?, ?, 'System', 'Automation', 'all')
                `).run(
                    id,
                    content,
                    JSON.stringify({ from_user_id: oldAssigneeId, to_user_id: targetAssigneeId, is_auto: true }),
                    actorId // Pass the triggering user ID if available
                );

                // Add as participant
                db.prepare(`
                    INSERT OR IGNORE INTO ticket_participants (ticket_id, user_id, role, join_method, joined_at)
                    VALUES (?, ?, 'assignee', 'auto', ?)
                `).run(id, targetAssigneeId, now);

                db.prepare(`
                    UPDATE ticket_participants SET role = 'assignee' WHERE ticket_id = ? AND user_id = ?
                `).run(id, targetAssigneeId);

                // Send notification for auto-assignment
                try {
                    const ticketData = db.prepare('SELECT ticket_number FROM tickets WHERE id = ?').get(id);
                    if (ticketData && targetAssigneeId !== actorId) {
                        db.prepare(`
                            INSERT INTO notifications (
                                recipient_id, notification_type, title, content, icon,
                                related_type, related_id, action_url, metadata, created_at
                            ) VALUES (?, 'assignment', ?, ?, 'user', 'ticket', ?, ?, ?, ?)
                        `).run(
                            targetAssigneeId,
                            `工单已自动指派给您`,
                            `工单 ${ticketData.ticket_number}`,
                            id,
                            `/service/tickets/${id}`,
                            JSON.stringify({ ticket_number: ticketData.ticket_number, is_auto: true }),
                            now
                        );
                    }
                } catch (e) {
                    console.error('[Tickets] Auto-assignment notification error:', e.message);
                }

                console.log(`[Tickets] Ticket ${id} auto-assigned to ${targetAssigneeId} for node ${nodeId}`);
            } else {
                // targetAssigneeId is null (no rule and no fallback found)
                const now = new Date().toISOString();
                const ticket = db.prepare('SELECT assigned_to FROM tickets WHERE id = ?').get(id);
                const oldAssigneeId = ticket ? ticket.assigned_to : null;

                if (oldAssigneeId) {
                    const currentAssignee = db.prepare('SELECT department_id FROM users WHERE id = ?').get(oldAssigneeId);

                    const isCrossDept = currentAssignee && currentAssignee.department_id !== dept.id;
                    const shouldClear = isCrossDept || (dept.auto_dispatch_enabled === 1 && targetDept === 'OP');

                    if (shouldClear) {
                        const oldUser = db.prepare('SELECT display_name, username FROM users WHERE id = ?').get(oldAssigneeId);
                        const oldName = oldUser ? (oldUser.display_name || oldUser.username) : '原负责人';
                        const reasonDisplay = isCrossDept
                            ? `[跨部门流转] 原负责人 "${oldName}" 不属于当前节点部门，工单已自动进入待分配池`
                            : '系统由于匹配不到分发规则，自动释出工单 (变更为待认领)';

                        db.prepare(`
                            UPDATE tickets SET 
                                assigned_to = NULL, 
                                updated_at = ?
                            WHERE id = ?
                        `).run(now, id);

                        db.prepare(`
                            INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                            VALUES (?, 'assignment_change', ?, ?, ?, 'System', 'Automation', 'all')
                        `).run(
                            id,
                            reasonDisplay,
                            JSON.stringify({ from_user_id: oldAssigneeId, to_user_id: null, is_auto: true, reason: isCrossDept ? 'cross_dept_clear' : 'no_rule_pool' }),
                            actorId
                        );

                        if (isCrossDept) {
                            console.log(`[Tickets] Ticket ${id} cross-dept clear: ${oldName} removed.`);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[Tickets] Auto-assign error:', err);
        }
    }

    /**
     * Map current_node to summary status
     */
    function mapNodeToStatus(node) {
        const mapping = {
            draft: 'open',
            in_progress: 'in_progress',
            handling: 'in_progress', // Inquiry: 处理中
            waiting_customer: 'waiting',
            awaiting_customer: 'waiting', // Inquiry: 等待客户
            submitted: 'open',
            ms_review: 'in_progress',
            ge_review: 'in_progress',
            op_receiving: 'in_progress',
            op_diagnosing: 'in_progress',
            op_repairing: 'in_progress',
            op_shipping: 'in_progress',
            op_shipping_transit: 'in_progress',  // 货代中转待补单
            op_qa: 'in_progress',
            dl_receiving: 'in_progress',
            dl_repairing: 'in_progress',
            dl_qa: 'in_progress',
            ms_closing: 'in_progress',
            ge_closing: 'in_progress',
            resolved: 'resolved',
            closed: 'closed',
            auto_closed: 'closed',
            converted: 'closed',
            cancelled: 'cancelled'
        };
        return mapping[node] || 'open';
    }

    /**
     * Format ticket for API response
     */
    function formatTicket(row, includeDetails = false) {
        const base = {
            id: row.id,
            ticket_number: row.ticket_number,
            ticket_type: row.ticket_type,

            // Status
            current_node: row.current_node,
            status: row.status,

            // SLA
            priority: row.priority,
            sla_due_at: row.sla_due_at,
            sla_status: row.sla_status,
            breach_counter: row.breach_counter,

            // Account/Contact - nested structure for frontend compatibility
            account_id: row.account_id,
            account_name: row.account_name,
            account: row.account_id ? {
                id: row.account_id,
                name: row.account_name,
                account_type: row.account_type,
                service_tier: row.account_service_tier
            } : null,
            contact_id: row.contact_id,
            contact_name: row.contact_name,
            contact: row.contact_id ? {
                id: row.contact_id,
                name: row.contact_name
            } : null,
            dealer_id: row.dealer_id,
            dealer_name: row.dealer_name,
            reporter_name: row.reporter_name,
            reporter_type: row.reporter_type,
            region: row.region,
            reporter_snapshot: row.reporter_snapshot ? JSON.parse(row.reporter_snapshot) : null,
            channel: row.channel,

            // Product - nested structure for frontend compatibility
            product_id: row.product_id,
            product_name: row.product_name,
            product_name_en: row.product_name_en,
            product: row.product_id ? {
                id: row.product_id,
                name: row.product_name
            } : null,
            serial_number: row.serial_number,

            // Assignment
            assigned_to: row.assigned_to,
            assigned_name: row.assigned_name,
            handler: row.assigned_to ? {
                id: row.assigned_to,
                name: row.assigned_name
            } : null,
            submitted_by: row.submitted_by,
            submitted_name: row.submitted_name,

            // Problem summary (needed for list view title)
            problem_summary: row.problem_summary,
            problem_description: row.problem_description,

            // Timestamps
            created_at: row.created_at,
            updated_at: row.updated_at,
            participants: row.participants ? (typeof row.participants === 'string' ? JSON.parse(row.participants) : row.participants) : [],
            snooze_until: row.snooze_until
        };

        if (includeDetails) {
            return {
                ...base,
                // Product details
                firmware_version: row.firmware_version,
                hardware_version: row.hardware_version,

                // Issue classification
                issue_type: row.issue_type,
                issue_category: row.issue_category,
                issue_subcategory: row.issue_subcategory,
                severity: row.severity,

                // Inquiry fields
                service_type: row.service_type,
                channel: row.channel,
                problem_summary: row.problem_summary,
                communication_log: row.communication_log,

                // Problem & solution
                problem_description: row.problem_description,
                solution_for_customer: row.solution_for_customer,
                is_warranty: row.is_warranty,

                // Repair info
                repair_content: row.repair_content,
                problem_analysis: row.problem_analysis,
                resolution: row.resolution,

                // Payment
                payment_channel: row.payment_channel,
                payment_amount: row.payment_amount,
                payment_date: row.payment_date,

                // Dates
                feedback_date: row.feedback_date,
                ship_date: row.ship_date,
                received_date: row.received_date,
                completed_date: row.completed_date,
                first_response_at: row.first_response_at,

                // SLA details
                node_entered_at: row.node_entered_at,

                // Collaboration
                participants: row.participants ? JSON.parse(row.participants) : [],
                snooze_until: row.snooze_until,

                // Links
                parent_ticket_id: row.parent_ticket_id,
                parent_ticket_number: row.parent_ticket_number,
                external_link: row.external_link,

                // Shipping Methods (P2 Phase 2)
                shipping_method: row.shipping_method || 'express',
                forwarder_domestic_tracking: row.forwarder_domestic_tracking,
                forwarder_name: row.forwarder_name,
                forwarder_final_tracking: row.forwarder_final_tracking,
                pickup_person: row.pickup_person,
                associated_order_ref: row.associated_order_ref,

                // Approval
                approval_status: row.approval_status,
                approved_by: row.approved_by,
                approved_at: row.approved_at,

                // Auto close
                auto_close_reminder_sent: row.auto_close_reminder_sent,
                auto_close_at: row.auto_close_at,

                // P2 Warranty Assessment Fields
                technical_damage_status: row.technical_damage_status,
                technical_warranty_suggestion: row.technical_warranty_suggestion,
                warranty_calculation: row.warranty_calculation ? (typeof row.warranty_calculation === 'string' ? JSON.parse(row.warranty_calculation) : row.warranty_calculation) : null,
                ms_review: row.ms_review ? (typeof row.ms_review === 'string' ? JSON.parse(row.ms_review) : row.ms_review) : null,
                final_settlement: row.final_settlement ? (typeof row.final_settlement === 'string' ? JSON.parse(row.final_settlement) : row.final_settlement) : null
            };
        }

        return base;
    }

    // ==============================
    // Routes
    // ==============================

    /**
     * GET /api/v1/tickets
     * List tickets with filters
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                ticket_type,
                status,
                current_node,
                priority,
                sla_status,
                account_id,
                dealer_id,
                assigned_to,
                submitted_by,
                serial_number,
                keyword,
                created_from,
                created_to,
                page = 1,
                page_size = 20,
                sort_by = 'created_at',
                sort_order = 'desc',
                participant_id,
                exclude_assigned_to,
                dept_collab
            } = req.query;

            const user = req.user;
            let conditions = [];
            let params = [];

            const { is_deleted: showDeleted } = req.query;

            // PRD §7.2: 默认排除已删除工单，除非明确指定
            if (showDeleted === '1') {
                conditions.push('t.is_deleted = 1');
            } else {
                conditions.push('(t.is_deleted IS NULL OR t.is_deleted = 0)');
            }

            // Role-based filtering
            // dept_collab: 按部门协作查询时，用部门级 EXISTS 替代个人权限过滤
            if (user.user_type === 'Dealer') {
                conditions.push('t.dealer_id = ?');
                params.push(user.dealer_id);
            } else if (dept_collab) {
                // 部门协作查询：校验用户只能查自己部门，Admin/Exec 可查任意部门
                const userDeptCode = user.department_code || getDeptCode(user);
                if (!['Admin', 'Exec'].includes(user.role) && dept_collab !== userDeptCode) {
                    return res.status(403).json({ success: false, error: '无权查看其他部门的协作工单' });
                }
                // 查询该部门成员被 @mention 的工单（替代个人权限过滤）
                conditions.push(`EXISTS (
                    SELECT 1 FROM ticket_participants tp
                    JOIN users u2 ON tp.user_id = u2.id
                    JOIN departments d2 ON u2.department_id = d2.id
                    WHERE tp.ticket_id = t.id
                    AND tp.role = 'mentioned'
                    AND d2.name = ?
                )`);
                params.push(dept_collab);
            } else if (!hasGlobalAccess(user)) {
                // PRD §2.1: OP/RD see RMA tickets freely, but Inquiry/SVC via JIT only
                conditions.push(`(
                    t.ticket_type = 'rma'
                    OR t.assigned_to = ?
                    OR t.created_by = ?
                    OR t.submitted_by = ?
                    OR EXISTS (
                        SELECT 1 FROM ticket_participants tp 
                        WHERE tp.ticket_id = t.id AND tp.user_id = ?
                    )
                )`);
                params.push(user.id, user.id, user.id, user.id);
            }

            // Filters
            if (ticket_type) {
                conditions.push('t.ticket_type = ?');
                params.push(ticket_type);
            }
            if (status) {
                conditions.push('t.status = ?');
                params.push(status);
            }
            if (current_node) {
                conditions.push('t.current_node = ?');
                params.push(current_node);
            }
            if (priority) {
                conditions.push('t.priority = ?');
                params.push(priority);
            }
            if (sla_status) {
                conditions.push('t.sla_status = ?');
                params.push(sla_status);
            }
            if (account_id) {
                conditions.push('t.account_id = ?');
                params.push(account_id);
            }
            if (dealer_id) {
                conditions.push('t.dealer_id = ?');
                params.push(dealer_id);
            }
            // Support 'me' as special value - resolves to req.user.id (which is view-as user when active)
            const resolveMe = (val) => (val === 'me' ? String(req.user.id) : val);

            if (assigned_to !== undefined && assigned_to !== '') {
                const resolvedAssignedTo = resolveMe(assigned_to);
                if (resolvedAssignedTo === '0' || resolvedAssignedTo === 'null') {
                    const deptCode = getDeptCode(req.user);
                    const relevantNodes = DEPARTMENT_NODES[deptCode];

                    if (relevantNodes && req.user.role !== 'Admin' && req.user.role !== 'Exec') {
                        conditions.push(`t.assigned_to IS NULL AND t.current_node IN (${relevantNodes.map(n => `'${n}'`).join(',')})`);
                    } else {
                        conditions.push('t.assigned_to IS NULL');
                    }
                } else {
                    conditions.push('t.assigned_to = ?');
                    params.push(resolvedAssignedTo);
                }
            }
            if (participant_id) {
                const resolvedParticipantId = resolveMe(participant_id);
                conditions.push(`(t.participants LIKE ? OR EXISTS (SELECT 1 FROM ticket_participants tp WHERE tp.ticket_id = t.id AND tp.user_id = ?))`);
                params.push(`%"${resolvedParticipantId}"%`, resolvedParticipantId);
            }
            if (exclude_assigned_to) {
                const resolvedExclude = resolveMe(exclude_assigned_to);
                conditions.push(`(t.assigned_to IS NULL OR t.assigned_to != ?)`);
                params.push(resolvedExclude);
            }
            if (submitted_by) {
                conditions.push('t.submitted_by = ?');
                params.push(submitted_by);
            }
            if (serial_number) {
                conditions.push('t.serial_number LIKE ?');
                params.push(`%${serial_number}%`);
            }
            if (keyword) {
                conditions.push(`(
                    t.ticket_number LIKE ? OR 
                    t.problem_summary LIKE ? OR 
                    t.problem_description LIKE ? OR
                    t.serial_number LIKE ? OR
                    a.name LIKE ?
                )`);
                const kw = `%${keyword}%`;
                params.push(kw, kw, kw, kw, kw);
            }
            if (created_from) {
                conditions.push('t.created_at >= ?');
                params.push(created_from);
            }
            if (created_to) {
                conditions.push('t.created_at <= ?');
                params.push(created_to);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Validate sort
            const allowedSorts = ['created_at', 'updated_at', 'priority', 'sla_due_at', 'ticket_number'];
            const sortField = allowedSorts.includes(sort_by) ? sort_by : 'created_at';
            const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            // Count total
            const countSql = `SELECT COUNT(*) as total FROM tickets t LEFT JOIN accounts a ON t.account_id = a.id ${whereClause}`;
            const total = db.prepare(countSql).get(...params).total;

            // Paginate
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const limit = parseInt(page_size);

            const sql = `
                SELECT 
                    t.*,
                    a.name as account_name,
                    a.service_tier as account_service_tier,
                    a.account_type as account_type,
                    c.name as contact_name,
                    d.name as dealer_name,
                    p.model_name as product_name,
                    u1.username as assigned_name,
                    u2.username as submitted_name
                FROM tickets t
                LEFT JOIN accounts a ON t.account_id = a.id
                LEFT JOIN contacts c ON t.contact_id = c.id
                LEFT JOIN accounts d ON t.dealer_id = d.id
                LEFT JOIN products p ON t.product_id = p.id
                LEFT JOIN users u1 ON t.assigned_to = u1.id
                LEFT JOIN users u2 ON t.submitted_by = u2.id
                ${whereClause}
                ORDER BY t.${sortField} ${sortDir}
                LIMIT ? OFFSET ?
            `;

            const rows = db.prepare(sql).all(...params, limit, offset);
            const data = rows.map(r => formatTicket(r, false));

            res.json({
                success: true,
                data,
                pagination: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / limit)
                }
            });
        } catch (err) {
            console.error('[Tickets] List error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/v1/tickets/team-stats
     * Get team statistics based on department (PRD v1.7.1 Overview segregation)
     */
    router.get('/team-stats', authenticate, (req, res) => {
        try {
            const user = req.user;
            let targetDept = req.query.dept || getDeptCode(user);

            // Access control for Admin/Exec viewing other depts
            if (req.query.dept && !['Admin', 'Exec'].includes(user.role) && req.query.dept !== getDeptCode(user)) {
                return res.status(403).json({ success: false, error: '无权查看其他部门数据' });
            }

            // Find users in the target department
            let teamUsers = [];
            if (targetDept) {
                const allDepts = db.prepare(`SELECT * FROM departments`).all();
                const matchedDeptIds = allDepts.filter(d =>
                    d.name === targetDept ||
                    (d.code && d.code === targetDept) ||
                    (targetDept === 'OP' && d.name && (d.name.includes('运营') || d.name === 'OP')) ||
                    (targetDept === 'MS' && d.name && (d.name.includes('市场') || d.name === 'MS')) ||
                    (targetDept === 'RD' && d.name && (d.name.includes('研发') || d.name === 'RD')) ||
                    (targetDept === 'GE' && d.name && (d.name.includes('通用') || d.name === 'GE')) ||
                    (targetDept === 'RE' && d.name && (d.name.includes('通用') || d.name === 'RE'))
                ).map(d => d.id);

                if (matchedDeptIds.length > 0) {
                    const placeholders = matchedDeptIds.map(() => '?').join(',');
                    teamUsers = db.prepare(`
                        SELECT id, username, display_name 
                        FROM users 
                        WHERE department_id IN (${placeholders})
                    `).all(...matchedDeptIds);
                }
            } else {
                // Global view for admin if no dept specified
                teamUsers = db.prepare(`SELECT id, username, display_name FROM users`).all();
            }

            const teamUserIds = teamUsers.map(u => u.id);
            const teamUserIdList = teamUserIds.length > 0 ? teamUserIds.join(',') : '0';

            // Base condition for "Department's Tickets"
            // 1. Assigned to member of department
            // 2. Unassigned, but current_node belongs to department
            const relevantNodes = targetDept ? (DEPARTMENT_NODES[targetDept] || []) : Object.values(DEPARTMENT_NODES).flat();
            const nodesList = relevantNodes.length > 0 ? relevantNodes.map(n => `'${n}'`).join(',') : "''";

            // All "open" tickets for the dept
            const openTicketsSql = `
                SELECT 
                    t.id, t.ticket_number, t.ticket_type, t.priority, t.sla_status, 
                    t.current_node, t.assigned_to, t.created_at, t.problem_summary,
                    COALESCE(u.display_name, u.username) as assigned_name,
                    (julianday('now') - julianday(t.created_at)) * 24 as hours_open
                FROM tickets t
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE (t.is_deleted IS NULL OR t.is_deleted = 0)
                AND t.current_node NOT IN ('resolved', 'closed', 'auto_closed', 'converted', 'cancelled')
                AND (
                    t.assigned_to IN (${teamUserIdList}) 
                    OR t.current_node IN (${nodesList})
                )
            `;
            const openTickets = db.prepare(openTicketsSql).all();

            // Closed today by dept
            const todayStr = new Date().toISOString().split('T')[0];
            const closedTodaySql = `
                SELECT COUNT(DISTINCT ta.ticket_id) as count
                FROM ticket_activities ta
                JOIN tickets t ON ta.ticket_id = t.id
                WHERE (t.is_deleted IS NULL OR t.is_deleted = 0)
                AND ta.activity_type = 'STATUS_CHANGE'
                AND json_extract(ta.metadata, '$.new_value') IN ('resolved', 'closed', 'auto_closed')
                AND date(ta.created_at) = ?
                AND ta.actor_id IN (${teamUserIdList})
            `;
            const closedToday = db.prepare(closedTodaySql).get(todayStr)?.count || 0;

            // Stats calculation
            let p0 = 0, p1 = 0, p2 = 0;
            let breachedCount = 0;
            let statusStats = {};
            const handlerMap = {};
            teamUsers.forEach(u => {
                handlerMap[u.id] = { id: u.id, name: u.display_name || u.username, active_tickets: 0 };
            });

            // "Unassigned" bucket
            handlerMap[0] = { id: 0, name: '未分配', active_tickets: 0 };

            const riskTicketsList = [];

            openTickets.forEach(t => {
                if (t.priority === 'P0') p0++;
                else if (t.priority === 'P1') p1++;
                else p2++;

                statusStats[t.current_node] = (statusStats[t.current_node] || 0) + 1;

                if (t.assigned_to && handlerMap[t.assigned_to]) {
                    handlerMap[t.assigned_to].active_tickets++;
                } else if (!t.assigned_to) {
                    handlerMap[0].active_tickets++;
                }

                const isWarning = t.sla_status === 'warning' || t.hours_open > 24;
                const isBreached = t.sla_status === 'breached' || t.hours_open > 48;

                if (isBreached) breachedCount++;

                if (isWarning || isBreached) {
                    riskTicketsList.push({
                        id: t.id,
                        ticket_number: t.ticket_number,
                        ticket_type: t.ticket_type,
                        problem_summary: t.problem_summary || '无描述',
                        sla_status: isBreached ? 'breached' : 'warning',
                        assigned_name: t.assigned_name || '未分配',
                        remaining_hours: Math.max(0, 48 - t.hours_open)
                    });
                }
            });

            // Sort team load
            let teamLoad = Object.values(handlerMap).filter(h => h.active_tickets > 0 || h.id !== 0);
            teamLoad.sort((a, b) => b.active_tickets - a.active_tickets);

            // Pending Approvals
            let approvalCount = 0;
            if (['MS', 'GE'].includes(targetDept) || !targetDept) {
                const approvalSql = `
                    SELECT COUNT(*) as count 
                    FROM tickets 
                    WHERE (is_deleted IS NULL OR is_deleted = 0)
                    AND current_node IN ('ms_review', 'ge_review')
                `;
                approvalCount = db.prepare(approvalSql).get()?.count || 0;
            }

            res.json({
                success: true,
                data: {
                    total_open: openTickets.length,
                    unassigned_count: handlerMap[0]?.active_tickets || 0,
                    total_closed_today: closedToday,
                    avg_response_time: 4.5, // TODO: future SLA extraction
                    sla_breach_rate: openTickets.length > 0 ? (breachedCount / openTickets.length * 100) : 0,
                    by_priority: { P0: p0, P1: p1, P2: p2 },
                    by_status: statusStats,
                    team_load: teamLoad,
                    risk_tickets: riskTicketsList.sort((a, b) => a.remaining_hours - b.remaining_hours).slice(0, 10),
                    approval_count: approvalCount
                }
            });
        } catch (err) {
            console.error('[Tickets] /team-stats error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/v1/tickets/workspace/counts
     * Get counts for Workspace views: My Tasks, Mentioned, Team Queue
     */
    router.get('/workspace/counts', authenticate, (req, res) => {
        try {
            const user = req.user;
            const userId = user.id;

            // 1. My Tasks (Assigned to me, not closed/resolved)
            const myTasksCount = db.prepare(`
                SELECT COUNT(*) as count FROM tickets 
                WHERE assigned_to = ? AND current_node NOT IN ('closed', 'cancelled', 'auto_closed', 'converted', 'resolved')
            `).get(userId).count;

            // 2. Mentioned (In participants, not assigned_to, not closed/resolved)
            // Use existing participant logic
            const mentionedCount = db.prepare(`
                SELECT COUNT(*) as count FROM tickets t
                WHERE EXISTS (SELECT 1 FROM ticket_participants tp WHERE tp.ticket_id = t.id AND tp.user_id = ?)
                AND (t.assigned_to IS NULL OR t.assigned_to != ?)
                AND t.current_node NOT IN ('closed', 'cancelled', 'auto_closed', 'converted', 'resolved')
            `).get(userId, userId).count;

            // 3. Team Hub (All active tickets visible to this user)
            let teamSql = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN (assigned_to IS NULL OR assigned_to = 0) THEN 1 ELSE 0 END) as unassigned
                FROM tickets t
                WHERE t.current_node NOT IN ('closed', 'cancelled', 'auto_closed', 'converted', 'resolved')
                AND (t.is_deleted IS NULL OR t.is_deleted = 0)
            `;

            let teamParams = [];
            if (user.user_type === 'Dealer') {
                teamSql += ' AND t.dealer_id = ?';
                teamParams.push(user.dealer_id);
            } else if (!hasGlobalAccess(user)) {
                // OP/RD: Only see RMA or tickets they are part of
                teamSql += ` AND (
                    t.ticket_type = 'rma'
                    OR t.assigned_to = ?
                    OR t.created_by = ?
                    OR t.submitted_by = ?
                    OR EXISTS (
                        SELECT 1 FROM ticket_participants tp 
                        WHERE tp.ticket_id = t.id AND tp.user_id = ?
                    )
                )`;
                teamParams.push(userId, userId, userId, userId);
            }

            const teamStats = db.prepare(teamSql).get(...teamParams);
            const teamTotalCount = teamStats ? teamStats.total : 0;
            const teamUnassignedCount = teamStats ? (teamStats.unassigned || 0) : 0;

            res.json({
                success: true,
                data: {
                    my_tasks: myTasksCount,
                    mentioned: mentionedCount,
                    team_queue: teamUnassignedCount, // Backwards compatibility
                    team_hub_total: teamTotalCount,
                    team_hub_unclaimed: teamUnassignedCount
                }
            });
        } catch (err) {
            console.error('[Tickets] Workspace counts error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/v1/tickets/stats/summary
     * Get ticket statistics
     */
    router.get('/stats/summary', authenticate, (req, res) => {
        try {
            const { ticket_type, created_from, created_to } = req.query;
            const user = req.user;

            let conditions = [];
            let params = [];

            if (user.user_type === 'Dealer') {
                conditions.push('dealer_id = ?');
                params.push(user.dealer_id);
            }
            if (ticket_type) {
                conditions.push('ticket_type = ?');
                params.push(ticket_type);
            }
            if (created_from) {
                conditions.push('created_at >= ?');
                params.push(created_from);
            }
            if (created_to) {
                conditions.push('created_at <= ?');
                params.push(created_to);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // By status
            const byStatus = db.prepare(`
                SELECT status, COUNT(*) as count FROM tickets ${whereClause} GROUP BY status
            `).all(...params);

            // By priority
            const byPriority = db.prepare(`
                SELECT priority, COUNT(*) as count FROM tickets ${whereClause} GROUP BY priority
            `).all(...params);

            // By SLA status
            const bySla = db.prepare(`
                SELECT sla_status, COUNT(*) as count FROM tickets ${whereClause} AND sla_status IS NOT NULL GROUP BY sla_status
            `).all(...params);

            // By type
            const byType = db.prepare(`
                SELECT ticket_type, COUNT(*) as count FROM tickets ${whereClause} GROUP BY ticket_type
            `).all(...params);

            res.json({
                success: true,
                data: {
                    by_status: byStatus,
                    by_priority: byPriority,
                    by_sla_status: bySla,
                    by_type: byType
                }
            });
        } catch (err) {
            console.error('[Tickets] Stats error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/v1/tickets/mention-stats
     * Get frequently mentioned users for current user (sorted by mention count)
     */
    router.get('/mention-stats', authenticate, (req, res) => {
        try {
            const userId = req.user.id;

            // Get frequently mentioned users sorted by count
            const stats = db.prepare(`
                SELECT 
                    ms.mentioned_user_id as user_id,
                    u.username as name,
                    d.name as department,
                    d.code as dept_code,
                    ms.mention_count,
                    ms.last_mention_at
                FROM user_mention_stats ms
                LEFT JOIN users u ON ms.mentioned_user_id = u.id
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE ms.user_id = ?
                ORDER BY ms.mention_count DESC, ms.last_mention_at DESC
                LIMIT 20
            `).all(userId);

            res.json({
                success: true,
                data: stats
            });
        } catch (err) {
            console.error('[Tickets] Mention stats error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/v1/tickets/invite-stats
     * Get frequently invited users for current user (sorted by invite count)
     */
    router.get('/invite-stats', authenticate, (req, res) => {
        try {
            const userId = req.user.id;

            const stats = db.prepare(`
                SELECT 
                    uis.invited_user_id as user_id,
                    u.username as name,
                    d.name as department,
                    d.code as dept_code,
                    uis.invite_count,
                    uis.last_invite_at
                FROM user_invite_stats uis
                LEFT JOIN users u ON uis.invited_user_id = u.id
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE uis.user_id = ?
                ORDER BY uis.invite_count DESC, uis.last_invite_at DESC
                LIMIT 20
            `).all(userId);

            res.json({
                success: true,
                data: stats
            });
        } catch (err) {
            console.error('[Tickets] Invite stats error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/v1/tickets/:id
     * Get ticket detail
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const { id } = req.params;

            const sql = `
                SELECT 
                    t.*,
                    a.name as account_name,
                    a.service_tier as account_service_tier,
                    a.account_type as account_type,
                    a.region as account_region,
                    a.country as account_country,
                    c.name as contact_name,
                    c.email as contact_email,
                    c.job_title as contact_job_title,
                    d.name as dealer_name,
                    d.dealer_code as dealer_code,
                    p.model_name as product_name,
                    pm.name_en as product_name_en,
                    p.serial_number as product_serial_number,
                    p.firmware_version as product_firmware,
                    p.product_line as product_line,
                    u1.username as assigned_name,
                    d1.name as assigned_dept,
                    u2.username as submitted_name,
                    d2.name as submitted_dept,
                    pt.ticket_number as parent_ticket_number
                FROM tickets t
                LEFT JOIN accounts a ON t.account_id = a.id
                LEFT JOIN contacts c ON t.contact_id = c.id
                LEFT JOIN accounts d ON t.dealer_id = d.id
                LEFT JOIN products p ON t.product_id = p.id
                LEFT JOIN product_models pm ON p.model_name = pm.name_zh
                LEFT JOIN users u1 ON t.assigned_to = u1.id
                LEFT JOIN departments d1 ON u1.department_id = d1.id
                LEFT JOIN users u2 ON t.submitted_by = u2.id
                LEFT JOIN departments d2 ON u2.department_id = d2.id
                LEFT JOIN tickets pt ON t.parent_ticket_id = pt.id
                WHERE t.id = ?
            `;

            const row = db.prepare(sql).get(id);
            if (!row) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            // PRD §7.2: 检查工单是否已被软删除
            if (row.is_deleted === 1) {
                return res.status(410).json({
                    success: false,
                    error: '工单已被删除',
                    deleted_at: row.deleted_at,
                    delete_reason: row.delete_reason
                });
            }

            // Check permission for dealers
            if (req.user.user_type === 'Dealer' && row.dealer_id !== req.user.dealer_id) {
                return res.status(403).json({ success: false, error: '无权访问此工单' });
            }

            // PRD §2.1: Check JIT permission for internal restricted users (OP/RD)
            if (req.user.user_type !== 'Dealer' && !hasGlobalAccess(req.user)) {
                if (row.ticket_type === 'inquiry' || row.ticket_type === 'svc') {
                    const userId = req.user.id;
                    const isRelated = row.assigned_to === userId ||
                        row.created_by === userId ||
                        row.submitted_by === userId;

                    let isParticipant = false;
                    try {
                        const participantCheck = db.prepare(`SELECT 1 FROM ticket_participants WHERE ticket_id = ? AND user_id = ?`).get(id, userId);
                        isParticipant = !!participantCheck;
                    } catch (e) {
                        // table may not exist
                    }

                    if (!isRelated && !isParticipant) {
                        return res.status(403).json({ success: false, error: '仅能访问分配给您或 @ 提及过您的咨询/维修工单' });
                    }
                }
            }

            // If contact_id is null but account_id exists, fetch primary contact
            let contactInfo = {
                contact_id: row.contact_id,
                contact_name: row.contact_name
            };
            if (!row.contact_id && row.account_id) {
                const primaryContact = db.prepare(`
                    SELECT id, name FROM contacts WHERE account_id = ? AND is_primary = 1 LIMIT 1
                `).get(row.account_id);
                if (primaryContact) {
                    contactInfo.contact_id = primaryContact.id;
                    contactInfo.contact_name = primaryContact.name;
                }
            }

            // Calculate SLA remaining time
            const slaInfo = slaService.checkSlaStatus(row);
            const ticketData = {
                ...formatTicket({ ...row, ...contactInfo }, true),
                sla_remaining_hours: slaInfo.remaining_hours,
                sla_remaining_percent: slaInfo.remaining_percent
            };

            // --- Enrichments for detail view ---

            // 1. Account context: ticket stats
            let accountContext = null;
            if (row.account_id) {
                const stats = db.prepare(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN ticket_type = 'inquiry' THEN 1 ELSE 0 END) as inquiry_count,
                        SUM(CASE WHEN ticket_type = 'rma' THEN 1 ELSE 0 END) as rma_count,
                        SUM(CASE WHEN ticket_type = 'svc' THEN 1 ELSE 0 END) as svc_count
                    FROM tickets WHERE account_id = ?
                `).get(row.account_id);

                const contacts = db.prepare(`
                    SELECT id, name, email, job_title, is_primary FROM contacts WHERE account_id = ? ORDER BY is_primary DESC LIMIT 5
                `).all(row.account_id);

                accountContext = {
                    id: row.account_id,
                    name: row.account_name,
                    service_tier: row.account_service_tier,
                    account_type: row.account_type,
                    region: row.account_region,
                    country: row.account_country,
                    ticket_stats: stats || { total: 0, inquiry_count: 0, rma_count: 0, svc_count: 0 },
                    contacts: contacts || []
                };
            }

            // 2. Product context: repair history for this SN
            let productContext = null;
            if (row.product_id) {
                const repairHistory = db.prepare(`
                    SELECT t.id, t.ticket_number, t.ticket_type, t.status, t.current_node, t.problem_summary, t.created_at
                    FROM tickets t
                    WHERE t.product_id = ? AND t.id != ?
                    ORDER BY t.created_at DESC
                    LIMIT 10
                `).all(row.product_id, id);

                productContext = {
                    id: row.product_id,
                    model_name: row.product_name,
                    serial_number: row.product_serial_number || row.serial_number,
                    firmware_version: row.product_firmware,
                    product_line: row.product_line,
                    repair_history: repairHistory || []
                };
            }

            // 3. Activities (倒序) - JOIN users 获取实际姓名
            const rawActivities = db.prepare(`
                SELECT ta.*,
                       COALESCE(u.display_name, u.username) as resolved_actor_name
                FROM ticket_activities ta
                LEFT JOIN users u ON ta.actor_id = u.id
                WHERE ta.ticket_id = ? ORDER BY ta.created_at DESC
            `).all(id);
            
            // 从活动记录计算关键日期
            let activityDates = {
                received_date: null,    // 收货入库日期 (receiving_info活动)
                diagnosis_date: null,   // 检测日期 (diagnostic_report活动)
                repair_date: null       // 维修日期 (op_repair_report活动)
            };
            for (const act of rawActivities) {
                if (act.activity_type === 'receiving_info' && !activityDates.received_date) {
                    activityDates.received_date = act.created_at;
                }
                if (act.activity_type === 'diagnostic_report' && !activityDates.diagnosis_date) {
                    activityDates.diagnosis_date = act.created_at;
                }
                if (act.activity_type === 'op_repair_report' && !activityDates.repair_date) {
                    activityDates.repair_date = act.created_at;
                }
                // 兼容旧数据：如果是comment类型但包含特定关键词
                if (act.activity_type === 'comment' && act.content) {
                    if (!activityDates.received_date && act.content.includes('【完成收货入库】')) {
                        activityDates.received_date = act.created_at;
                    }
                    if (!activityDates.repair_date && act.content.includes('【维修结案报告】')) {
                        activityDates.repair_date = act.created_at;
                    }
                }
            }
            // 将计算出的日期合并到ticketData（如果原数据为空）
            if (activityDates.received_date && !ticketData.received_date) {
                ticketData.received_date = activityDates.received_date;
            }
            if (activityDates.diagnosis_date) {
                ticketData.repair_started_at = activityDates.diagnosis_date;
            }
            if (activityDates.repair_date) {
                ticketData.repair_completed_at = activityDates.repair_date;
            }

            const activities = rawActivities.map(a => {
                const activity = {
                    ...a,
                    metadata: a.metadata ? JSON.parse(a.metadata) : null,
                    actor: a.actor_id ? {
                        id: a.actor_id,
                        name: a.resolved_actor_name || a.actor_name || null,
                        role: a.actor_role
                    } : null
                };

                // Fetch attachments for this activity
                const activityAttachments = db.prepare(`
                    SELECT id, file_name, file_size, file_type, uploaded_at
                    FROM ticket_attachments
                    WHERE activity_id = ?
                `).all(a.id);

                if (activityAttachments.length > 0) {
                    activity.attachments = activityAttachments.map(att => ({
                        ...att,
                        file_url: `/api/v1/system/attachments/${att.id}/download`,
                        thumbnail_url: att.file_type?.startsWith('image/') ? `/api/v1/system/attachments/${att.id}/thumbnail` : null
                    }));
                }
                return activity;
            });

            // 3.5 Ticket-level attachments (包含所有属于该工单的附件，无论是否关联到活动)
            const ticketAttachments = db.prepare(`
                SELECT id, file_name, file_size, file_type, uploaded_at, activity_id
                FROM ticket_attachments
                WHERE ticket_id = ?
            `).all(id);

            const attachments = ticketAttachments.map(att => ({
                ...att,
                file_url: `/api/v1/system/attachments/${att.id}/download`,
                thumbnail_url: att.file_type?.startsWith('image/') ? `/api/v1/system/attachments/${att.id}/thumbnail` : null
            }));

            const attachments_count = db.prepare(`SELECT COUNT(*) as count FROM ticket_attachments WHERE ticket_id = ?`).get(id).count;

            // 4. Participants with role info
            let participants = [];
            try {
                participants = db.prepare(`
                    SELECT tp.user_id, tp.role, tp.join_method, tp.joined_at, u.username as name 
                    FROM ticket_participants tp
                    LEFT JOIN users u ON tp.user_id = u.id
                    WHERE tp.ticket_id = ?
                    ORDER BY 
                        CASE tp.role 
                            WHEN 'owner' THEN 1 
                            WHEN 'assignee' THEN 2 
                            WHEN 'mentioned' THEN 3 
                            ELSE 4 
                        END,
                        tp.joined_at ASC
                `).all(id);
            } catch (_e) {
                // ticket_participants table not yet created
            }

            // Technician View (OP/RD DTO desensitization)
            // PRD §2.2: OP sees technical info only, commercial-sensitive fields hidden
            if (!hasGlobalAccess(req.user)) {
                // Strip payment/commercial fields
                delete ticketData.payment_channel;
                delete ticketData.payment_amount;
                delete ticketData.payment_date;

                // Desensitize reporter snapshot — keep name/role, hide phone/email
                if (ticketData.reporter_snapshot) {
                    ticketData.reporter_snapshot = {
                        name: ticketData.reporter_snapshot.name,
                        role: ticketData.reporter_snapshot.role,
                        source: ticketData.reporter_snapshot.source
                    };
                }

                // Strip account context sensitive details
                if (accountContext) {
                    delete accountContext.service_tier;
                    accountContext.contacts = (accountContext.contacts || []).map(c => ({
                        id: c.id,
                        name: c.name,
                        job_title: c.job_title,
                        is_primary: c.is_primary
                    }));
                }
            }

            res.json({
                success: true,
                data: {
                    ...ticketData,
                    attachments_count: attachments_count || 0
                },
                account: accountContext,
                product: productContext,
                activities: activities || [],
                attachments: attachments || [],
                participants: participants || []
            });
        } catch (err) {
            console.error('[Tickets] Get error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/v1/tickets
     * Create new ticket
     * Supports both JSON and multipart/form-data (with attachments)
     */
    router.post('/', authenticate, serviceUpload.array('attachments', 10), (req, res) => {
        try {
            const {
                ticket_type,
                priority = 'P2',
                channel_code = 'D',

                // Account/Contact
                account_id,
                contact_id,
                dealer_id,
                reporter_name,
                reporter_type,
                region,

                // Product
                product_id,
                serial_number,
                firmware_version,
                hardware_version,

                // Issue
                issue_type,
                issue_category,
                issue_subcategory,
                severity,

                // Inquiry
                service_type,
                channel,
                problem_summary,
                communication_log,

                // Reporter Snapshot
                reporter_snapshot,

                // Problem
                problem_description,
                solution_for_customer,
                is_warranty,

                // Assignment
                assigned_to,

                // Dates
                feedback_date,

                // Parent
                parent_ticket_id
            } = req.body;

            if (!ticket_type || !['inquiry', 'rma', 'svc'].includes(ticket_type)) {
                return res.status(400).json({ success: false, error: '无效的工单类型' });
            }

            // PRD: 以 SN 查询结果为准设置 product_id
            // ⚠️ 前端下拉传入的 product_id 来自 product_models 表，
            //    但 tickets.product_id 外键引用 products（设备台账）表，
            //    因此只有 SN 精确匹配到设备时才设置 product_id
            let finalProductId = null;
            if (serial_number) {
                const device = db.prepare('SELECT id FROM products WHERE serial_number = ?').get(serial_number);
                if (device) {
                    finalProductId = device.id;
                }
                // SN 不在台账 → finalProductId 保持 null
            }
            // 无 SN 时 → finalProductId 保持 null（前端的 product_id 是 product_models.id，不能直接用）

            const now = new Date().toISOString();
            const ticketNumber = generateTicketNumber(ticket_type, channel_code);

            // Determine initial node
            let initialNode = 'submitted';
            if (ticket_type === 'inquiry') initialNode = 'handling';
            if (ticket_type === 'rma') initialNode = 'op_receiving';
            if (ticket_type === 'svc') initialNode = 'submitted';

            // Calculate SLA due
            const slaDue = slaService.calculateSlaDue(db, priority, initialNode, now, ticket_type);
            const slaDueStr = slaDue ? slaDue.toISOString() : null;

            const insertSql = `
                INSERT INTO tickets (
                    ticket_number, ticket_type, current_node, status,
                    priority, node_entered_at, sla_due_at, sla_status,
                    channel_code,
                    reporter_snapshot,
                    account_id, contact_id, dealer_id, reporter_name, reporter_type, region,
                    product_id, serial_number, firmware_version, hardware_version,
                    issue_type, issue_category, issue_subcategory, severity,
                    service_type, channel, problem_summary, communication_log,
                    problem_description, solution_for_customer, is_warranty,
                    submitted_by, assigned_to, created_by,
                    feedback_date,
                    parent_ticket_id,
                    created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?,
                    ?, ?, ?, 'normal',
                    ?,
                    ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?,
                    ?,
                    ?, ?
                )
            `;

            // Handle reporter_snapshot - could be a JSON string from frontend or an object
            let processedSnapshot = null;
            if (reporter_snapshot) {
                if (typeof reporter_snapshot === 'string') {
                    // Already a JSON string from frontend
                    processedSnapshot = reporter_snapshot;
                } else {
                    // Object, need to stringify
                    processedSnapshot = JSON.stringify(reporter_snapshot);
                }
            }

            // 清洗外键 ID：空字符串/非正整数 → null（防止 FK constraint 失败）
            const cleanFk = (v) => {
                if (v === null || v === undefined || v === '' || v === '0') return null;
                const n = parseInt(v, 10);
                return isNaN(n) || n <= 0 ? null : n;
            };

            const result = db.prepare(insertSql).run(
                ticketNumber, ticket_type, initialNode, mapNodeToStatus(initialNode),
                priority, now, slaDueStr,
                channel_code,
                processedSnapshot,
                cleanFk(account_id), cleanFk(contact_id), cleanFk(dealer_id), reporter_name || null, reporter_type || null, region || null,
                cleanFk(finalProductId), serial_number || null, firmware_version || null, hardware_version || null,
                issue_type || null, issue_category || null, issue_subcategory || null, severity || 3,
                service_type || null, channel || null, problem_summary || null, communication_log || null,
                problem_description || null, solution_for_customer || null, is_warranty !== undefined ? is_warranty : 1,
                req.user.id, cleanFk(assigned_to), req.user.id,
                feedback_date || null,
                cleanFk(parent_ticket_id),
                now, now
            );

            // Create initial activity
            const actorName = req.user.display_name || req.user.username || 'system';
            const actorDept = req.user.department_name || req.user.department || 'MS';
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'system_event', ?, ?, ?, ?, ?, 'all')
            `).run(
                result.lastInsertRowid,
                `创建了${ticket_type === 'RMA' ? 'RMA' : ''}工单 ${ticketNumber}`,
                JSON.stringify({ event_type: 'creation', ticket_type, initial_node: initialNode, priority, assigned_to: assigned_to || null }),
                req.user.id,
                actorName,
                actorDept
            );

            // Trigger auto-assignment if not manually assigned to a specific person
            if (!assigned_to) {
                autoAssignTicket(result.lastInsertRowid, initialNode, ticket_type, req.user.id);
            }

            // ====== 处理创建工单时上传的附件 ======
            let attachmentsCount = 0;
            if (req.files && req.files.length > 0) {
                const typeMap = { 'rma': 'RMA', 'inquiry': 'Inquiry', 'svc': 'Inquiry', 'dealer_repair': 'DealerRepair' };
                const typeDir = typeMap[ticket_type.toLowerCase()] || 'Other';
                
                // Base Dir Calculation (Consistent with server/index.js)
                const SERVICE_BASE_DIR = (process.platform === 'darwin' && !__dirname.includes('KineCore'))
                    ? '/Volumes/fileserver/Service'
                    : path.join(__dirname, '../../data/Service');

                const finalTargetDir = path.join(SERVICE_BASE_DIR, 'Tickets', typeDir, ticketNumber);
                fs.ensureDirSync(finalTargetDir);

                req.files.forEach(file => {
                    const finalPath = path.join(finalTargetDir, file.filename);
                    try {
                        // Move from Temp to Final
                        fs.moveSync(file.path, finalPath, { overwrite: true });

                        // In DB we store the path relative to SERVICE_BASE_DIR
                        const dbPath = `Tickets/${typeDir}/${ticketNumber}/${file.filename}`;

                        // 工单级附件：activity_id = NULL
                        db.prepare(`
                            INSERT INTO ticket_attachments (
                                ticket_id, activity_id, file_name, file_path, 
                                file_size, file_type, uploaded_by
                            ) VALUES (?, NULL, ?, ?, ?, ?, ?)
                        `).run(
                            result.lastInsertRowid,
                            file.originalname,
                            dbPath,
                            file.size,
                            file.mimetype,
                            req.user.id
                        );

                        attachmentsCount++;

                        // Fire-and-forget background thumbnail generation for images
                        if (file.mimetype.startsWith('image/')) {
                            const thumbDir = path.resolve(__dirname, '../../data/.thumbnails');
                            fs.ensureDirSync(thumbDir);
                            const thumbFilename = String(dbPath).replace(/[^a-zA-Z0-9.-]/g, '_') + '_thumb.webp';
                            const thumbPath = path.join(thumbDir, thumbFilename);
                            const THUMB_SIZE = 400;
                            
                            const ext = path.extname(finalPath).toLowerCase();
                            const isHeic = ext === '.heic' || ext === '.heif';
                            
                            if (isHeic && process.platform === 'darwin') {
                                // macOS HEIC: use sips + sharp
                                const { exec } = require('child_process');
                                const tempJpg = thumbPath.replace('.webp', '_temp.jpg');
                                exec(`sips -s format jpeg -Z ${THUMB_SIZE} "${finalPath}" --out "${tempJpg}"`, async (err) => {
                                    if (!err) {
                                        try {
                                            const sharp = require('sharp');
                                            await sharp(tempJpg)
                                                .rotate()
                                                .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
                                                .webp({ quality: 80 })
                                                .toFile(thumbPath);
                                            fs.removeSync(tempJpg);
                                        } catch (sharpErr) {
                                            console.error('[Thumb] sharp conversion failed:', sharpErr.message);
                                        }
                                    }
                                });
                            } else {
                                // Non-HEIC: direct sharp processing
                                const sharp = require('sharp');
                                sharp(finalPath)
                                    .rotate()
                                    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
                                    .webp({ quality: 80 })
                                    .toFile(thumbPath)
                                    .catch(e => console.error('[Thumb] Generation failed:', e.message));
                            }
                        }
                    } catch (moveErr) {
                        console.error('[Tickets] Attachment move error:', moveErr.message);
                    }
                });

                // Update attachments_count on ticket
                if (attachmentsCount > 0) {
                    db.prepare('UPDATE tickets SET attachments_count = ? WHERE id = ?')
                        .run(attachmentsCount, result.lastInsertRowid);
                }
            }

            res.json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    ticket_number: ticketNumber,
                    ticket_type,
                    current_node: initialNode,
                    priority
                }
            });
        } catch (err) {
            console.error('[Tickets] Create error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/v1/tickets/:id/transfer
     * 转交工单给其他对接人 (PRD §2.2)
     */
    router.post('/:id/transfer', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { to_user_id, reason } = req.body;

            if (!to_user_id) return res.status(400).json({ success: false, error: '目标处理人 ID 必填' });
            if (!reason) return res.status(400).json({ success: false, error: '转交理由必填' });

            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
            if (!ticket) return res.status(404).json({ success: false, error: '工单不存在' });

            // 权限检查：Assignee 本人、商管部负责人或管理员
            const deptCode = getDeptCode(req.user);
            const isMsLead = deptCode === 'MS' && req.user.role === 'Lead';
            const isAdmin = req.user.role === 'Admin' || req.user.role === 'Exec' || isMsLead;
            const isAssignee = ticket.assigned_to === req.user.id;

            if (!isAdmin && !isAssignee) {
                return res.status(403).json({ success: false, error: '无权转交此工单' });
            }

            const now = new Date().toISOString();
            const fromUser = ticket.assigned_to ? db.prepare('SELECT display_name, username FROM users WHERE id = ?').get(ticket.assigned_to) : null;
            const toUser = db.prepare('SELECT display_name, username FROM users WHERE id = ?').get(to_user_id);
            
            if (!toUser) return res.status(400).json({ success: false, error: '目标用户不存在' });

            const fromName = fromUser ? (fromUser.display_name || fromUser.username) : '未指派';
            const toName = toUser.display_name || toUser.username;

            // 1. 将原有的对接人在参与者中降级为 协作者 ('mentioned')
            if (ticket.assigned_to) {
                db.prepare(`UPDATE ticket_participants SET role = 'mentioned' WHERE ticket_id = ? AND user_id = ? AND role = 'assignee'`).run(id, ticket.assigned_to);
            }

            // 2. 更新工单
            db.prepare('UPDATE tickets SET assigned_to = ?, updated_at = ? WHERE id = ?').run(to_user_id, now, id);

            // 记录时间轴
            const actorName = req.user.display_name || req.user.username;
            const actorDept = req.user.department_name || 'MS';
            
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'assignment_change', ?, ?, ?, ?, ?, 'all')
            `).run(
                id,
                `转交工单: ${fromName} → ${toName}。理由: ${reason}`,
                JSON.stringify({ from_user_id: ticket.assigned_to, to_user_id, reason }),
                req.user.id,
                actorName,
                actorDept
            );

            // 自动加入协作者
            db.prepare(`
                INSERT OR IGNORE INTO ticket_participants (ticket_id, user_id, role, join_method, joined_at)
                VALUES (?, ?, 'assignee', 'auto', ?)
            `).run(id, to_user_id, now);
            db.prepare(`UPDATE ticket_participants SET role = 'assignee' WHERE ticket_id = ? AND user_id = ?`).run(id, to_user_id);

            // 发送通知
            try {
                db.prepare(`
                    INSERT INTO notifications (
                        recipient_id, notification_type, title, content, icon,
                        related_type, related_id, action_url, metadata, created_at
                    ) VALUES (?, 'assignment', ?, ?, 'user', 'ticket', ?, ?, ?, ?)
                `).run(
                    to_user_id,
                    `${actorName} 向您转交了工单`,
                    `工单 ${ticket.ticket_number} (理由: ${reason})`,
                    id,
                    `/service/tickets/${id}`,
                    JSON.stringify({ ticket_number: ticket.ticket_number, assigned_by: actorName }),
                    now
                );
            } catch (e) {
                console.error('[Tickets] Transfer notification error:', e.message);
            }

            res.json({ success: true, message: '工单已成功转交', new_assignee: toName });
        } catch (err) {
            console.error('[Tickets] Transfer error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * PATCH /api/v1/tickets/:id/auto-close
     * 手动调整自动结案时间 (PRD §3.1)
     */
    router.patch('/:id/auto-close', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { auto_close_at, reason } = req.body;

            if (!auto_close_at) return res.status(400).json({ success: false, error: '日期必填' });

            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
            if (!ticket) return res.status(404).json({ success: false, error: '工单不存在' });

            if (ticket.ticket_type !== 'inquiry') {
                return res.status(400).json({ success: false, error: '仅咨询工单支持设置自动结案日期' });
            }

            const now = new Date().toISOString();
            const actorName = req.user.display_name || req.user.username;
            const actorDept = req.user.department_name || 'MS';

            db.prepare('UPDATE tickets SET auto_close_at = ?, updated_at = ? WHERE id = ?').run(auto_close_at, now, id);

            const dateStr = new Date(auto_close_at).toLocaleDateString('zh-CN');
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'field_update', ?, ?, ?, ?, ?, 'all')
            `).run(
                id,
                `调整了自动结案日期至 ${dateStr}。${reason ? '理由: ' + reason : ''}`,
                JSON.stringify({ field: 'auto_close_at', new_value: auto_close_at, reason }),
                req.user.id,
                actorName,
                actorDept
            );

            res.json({ success: true, message: '自动结案日期已更新' });
        } catch (err) {
            console.error('[Tickets] Auto-close update error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * PATCH /api/v1/tickets/:id
     * Update ticket with PRD §7.1 Audited Correction
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;
            const { change_reason } = updates; // 修正理由

            // Get current ticket
            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            // PRD §7.2: Check if ticket is soft-deleted
            if (ticket.is_deleted === 1) {
                return res.status(410).json({ success: false, error: '工单已被删除' });
            }

            // Check permission
            if (req.user.user_type === 'Dealer' && ticket.dealer_id !== req.user.dealer_id) {
                return res.status(403).json({ success: false, error: '无权修改此工单' });
            }

            // PRD §7.1 - 阶梯式锁定检查
            const isFinalized = FINALIZED_NODES.includes(ticket.current_node);
            const deptCode = getDeptCode(req.user);
            const isMsLead = deptCode === 'MS' && req.user.role === 'Lead';
            const isAdmin = req.user.role === 'Admin' || req.user.role === 'Exec' || isMsLead;

            const allowedFields = [
                'priority', 'current_node',
                // Snapshot & Account
                'reporter_snapshot', 'channel',
                'account_id', 'contact_id', 'dealer_id', 'reporter_name', 'reporter_type', 'region',
                'product_id', 'serial_number', 'firmware_version', 'hardware_version',
                'issue_type', 'issue_category', 'issue_subcategory', 'severity',
                'service_type', 'problem_summary', 'communication_log',
                'problem_description', 'solution_for_customer', 'is_warranty',
                'repair_content', 'problem_analysis', 'resolution',
                'assigned_to',
                'payment_channel', 'payment_amount', 'payment_date',
                'feedback_date', 'ship_date', 'received_date', 'completed_date',
                'snooze_until',
                'external_link',
                // RMA Shipping Methods (P2 Phase 2)
                'shipping_method', 'forwarder_domestic_tracking', 'forwarder_name',
                'forwarder_final_tracking', 'pickup_person', 'associated_order_ref',
                // Warranty Assessment Fields (P2)
                'technical_damage_status', 'technical_warranty_suggestion',
                'warranty_calculation', 'ms_review', 'final_settlement'
            ];

            // 1. 检测所有变更的字段 (normalize null/undefined/'' as equivalent)
            // 1. 检测所有变更的字段 (normalize null/undefined/''/0 as equivalent for empty checks where appropriate)
            const normalize = v => (v === null || v === undefined || v === '') ? '' : v;
            const normalizeBool = v => (v === true || v === 1 || v === '1') ? 1 : ((v === false || v === 0 || v === '0') ? 0 : v);

            const allChangedFields = allowedFields.filter(field => {
                const newVal = updates[field];
                if (newVal === undefined) return false;
                const oldVal = ticket[field];

                if (field === 'reporter_snapshot') {
                    const oldStr = typeof oldVal === 'string' ? oldVal : JSON.stringify(oldVal || {});
                    const newStr = typeof newVal === 'string' ? newVal : JSON.stringify(newVal || {});
                    return oldStr !== newStr;
                }

                if (field === 'is_warranty') {
                    return normalizeBool(oldVal) !== normalizeBool(newVal);
                }

                // For numeric fields like payment_amount, ensure type alignment
                if (['payment_amount', 'product_id', 'account_id', 'contact_id', 'dealer_id', 'assigned_to'].includes(field)) {
                    if (normalize(oldVal) === '' && normalize(newVal) === '') return false;
                    return normalize(oldVal).toString() !== normalize(newVal).toString();
                }

                return String(normalize(oldVal)).trim() !== String(normalize(newVal)).trim();
            });

            // 2. 梳理核心审计字段变更
            const coreFieldsChanged = allChangedFields.filter(f => AUDIT_FIELDS.includes(f));

            // 3. 决定记录到 Timeline (field_update) 的字段范围
            // 如果是 Modal 全局编辑，则记录所有变动（剔除专门有 log 的状态、处理人、Snooze 等）；否则只记录核心字段
            const fieldsToLog = updates.is_modal_edit
                ? allChangedFields.filter(f => !['current_node', 'assigned_to', 'priority', 'snooze_until'].includes(f))
                : coreFieldsChanged;

            // 如果触发了高斯模糊全局编辑，或只改了核心字段，必须有理由
            if (fieldsToLog.length > 0 && !change_reason && updates.is_modal_edit) {
                return res.status(400).json({ success: false, error: '修改工单内容需要填写修正理由' });
            }
            if (coreFieldsChanged.length > 0 && !change_reason) {
                return res.status(400).json({
                    success: false,
                    error: '修改核心字段需要填写修正理由',
                    audit_fields: coreFieldsChanged.map(f => FIELD_LABELS[f] || f)
                });
            }

            // 终结期锁定：普通用户禁止修改核心字段
            if (isFinalized && !isAdmin && coreFieldsChanged.length > 0) {
                return res.status(403).json({
                    success: false,
                    error: '工单已终结，仅管理员可修改核心字段',
                    finalized_at: ticket.current_node
                });
            }

            const now = new Date().toISOString();

            // PRD Cross-Dept Protection: Validate that the new assignee belongs to the department of current node
            if (updates.assigned_to !== undefined && updates.assigned_to !== null && updates.assigned_to !== ticket.assigned_to) {
                const targetNode = updates.current_node || ticket.current_node;
                let nodeDept = null;
                if (targetNode.startsWith('op_')) nodeDept = 'OP';
                else if (targetNode.startsWith('ms_')) nodeDept = 'MS';
                else if (targetNode.startsWith('ge_')) nodeDept = 'GE';
                else if (targetNode.startsWith('rd_')) nodeDept = 'RD';

                if (nodeDept) {
                    const newUser = db.prepare(`
                        SELECT u.department_id, d.code as dept_code 
                        FROM users u 
                        LEFT JOIN departments d ON u.department_id = d.id 
                        WHERE u.id = ?
                    `).get(updates.assigned_to);

                    if (newUser && newUser.dept_code !== nodeDept) {
                        console.warn(`[Tickets] Blocked cross-dept manual assignment: User ${updates.assigned_to} (${newUser.dept_code}) to node ${targetNode} (${nodeDept})`);
                        delete updates.assigned_to;
                    }
                }
            }

            const sets = [];
            const params = [];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    sets.push(`${field} = ?`);

                    // Fields that must be stored as JSON strings
                    const jsonFields = ['reporter_snapshot', 'warranty_calculation', 'ms_review', 'final_settlement'];

                    if (jsonFields.includes(field)) {
                        params.push(updates[field] ? JSON.stringify(updates[field]) : null);
                    } else {
                        // SQLite3 cannot bind booleans; convert to integer
                        let val = updates[field];
                        if (typeof val === 'boolean') val = val ? 1 : 0;
                        params.push(val);
                    }
                }
            }

            // PRD §7.1 - 记录字段变更到时间轴及审计日记表
            const actorName = req.user.display_name || req.user.username;
            const actorDept = req.user.department_name || 'MS';

            for (const field of fieldsToLog) {
                const oldVal = ticket[field];
                let newVal = updates[field];

                // 格式化显示值
                let oldDisplay = oldVal;
                let newDisplay = newVal;

                if (field === 'reporter_snapshot') {
                    oldDisplay = oldVal ? '(快照数据)' : '(空)';
                    newDisplay = newVal ? '(快照数据)' : '(空)';
                } else if (field === 'is_warranty') {
                    oldDisplay = oldVal === 1 ? '在保' : '过保';
                    newDisplay = newVal === 1 ? '在保' : '过保';
                } else if (field === 'payment_amount') {
                    oldDisplay = oldVal ? `¥${oldVal}` : '¥0';
                    newDisplay = newVal ? `¥${newVal}` : '¥0';
                }

                const fieldLabel = FIELD_LABELS[field] || field;
                const content = `修改了 [${fieldLabel}]：从 "${oldDisplay || '(空)'}" 变更为 "${newDisplay || '(空)'}"。理由：${change_reason}`;

                // 写入时间轴活动
                db.prepare(`
                    INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                    VALUES (?, 'field_update', ?, ?, ?, ?, ?, 'all')
                `).run(
                    id,
                    content,
                    JSON.stringify({
                        field_name: field,
                        field_label: fieldLabel,
                        old_value: oldVal,
                        new_value: newVal,
                        change_reason: change_reason
                    }),
                    req.user.id,
                    actorName,
                    actorDept
                );

                // 写入详细审计日志
                try {
                    db.prepare(`
                        INSERT INTO ticket_field_audit_log (ticket_id, field_name, old_value, new_value, change_reason, changed_by, changed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        id,
                        field,
                        JSON.stringify(oldVal),
                        JSON.stringify(newVal),
                        change_reason,
                        req.user.id,
                        now
                    );
                } catch (e) {
                    console.error('[Tickets] Audit log write error:', e.message);
                }
            }

            // Handle node change specially (update SLA)
            if (updates.current_node && updates.current_node !== ticket.current_node) {
                const priority = updates.priority || ticket.priority;
                const slaUpdate = slaService.updateSlaOnNodeChange(db, id, updates.current_node, priority);

                const NODE_NAME_MAP = {
                    draft: '草稿',
                    submitted: '已提交',
                    ms_review: '商务审核',
                    op_receiving: '待收货',
                    op_diagnosing: '诊断中',
                    op_repairing: '维修中',
                    op_qa: 'QA检测',
                    op_shipping: '打包发货',
                    op_shipping_transit: '待补外销单号',
                    ms_closing: '待结案',
                    ge_review: '财务审核',
                    ge_closing: '财务结案',
                    resolved: '已解决',
                    closed: '已关闭',
                    waiting_customer: '待反馈'
                };
                const oldNodeName = NODE_NAME_MAP[ticket.current_node] || ticket.current_node;
                const newNodeName = NODE_NAME_MAP[updates.current_node] || updates.current_node;

                // Record activity
                db.prepare(`
                    INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                    VALUES (?, 'status_change', ?, ?, ?, ?, ?, 'all')
                `).run(
                    id,
                    `状态变更: ${oldNodeName} → ${newNodeName}`,
                    JSON.stringify({ from_node: ticket.current_node, to_node: updates.current_node }),
                    req.user.id,
                    actorName,
                    actorDept
                );

                // Auto-assignment logic
                const ttype = updates.ticket_type || ticket.ticket_type;
                autoAssignTicket(id, updates.current_node, ttype, req.user.id);

                // [Update v1.8] Status change notifications to interested parties
                try {
                    const participants = db.prepare('SELECT user_id FROM ticket_participants WHERE ticket_id = ?').all(id);
                    const recipientIds = new Set([
                        ticket.submitted_by,
                        ticket.assigned_to,
                        ...participants.map(p => p.user_id)
                    ]);

                    recipientIds.delete(req.user.id); // Exclude self

                    for (const rid of recipientIds) {
                        if (!rid || rid <= 0) continue;
                        db.prepare(`
                            INSERT INTO notifications (
                                recipient_id, notification_type, title, content, icon,
                                related_type, related_id, action_url, metadata, created_at
                            ) VALUES (?, 'status_change', ?, ?, 'info', 'ticket', ?, ?, ?, ?)
                        `).run(
                            rid,
                            `工单状态变更`,
                            `工单 ${ticket.ticket_number}: ${oldNodeName} → ${newNodeName}`,
                            id,
                            `/service/tickets/${id}`,
                            JSON.stringify({
                                ticket_number: ticket.ticket_number,
                                from_node: ticket.current_node,
                                to_node: updates.current_node,
                                changed_by: actorName
                            }),
                            now
                        );
                    }
                } catch (e) {
                    console.error('[Tickets] Status change notification error:', e.message);
                }

                // Update status field
                sets.push('status = ?');
                params.push(mapNodeToStatus(updates.current_node));
                sets.push('status_changed_at = ?');
                params.push(now);
            }

            // Handle priority change (if not already in audit fields)
            if (updates.priority && updates.priority !== ticket.priority && !coreFieldsChanged.includes('priority')) {
                db.prepare(`
                    INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                    VALUES (?, 'priority_change', ?, ?, ?, ?, ?, 'all')
                `).run(
                    id,
                    `优先级变更: ${ticket.priority} → ${updates.priority}`,
                    JSON.stringify({ from_priority: ticket.priority, to_priority: updates.priority }),
                    req.user.id,
                    actorName,
                    actorDept
                );

                // Recalculate SLA if priority changed
                if (!updates.current_node) {
                    const slaDue = slaService.calculateSlaDue(db, updates.priority, ticket.current_node, ticket.node_entered_at || now, ticket.ticket_type);
                    sets.push('sla_due_at = ?');
                    params.push(slaDue ? slaDue.toISOString() : null);
                }
            }

            // Handle assignment change
            if (updates.assigned_to !== undefined && updates.assigned_to !== ticket.assigned_to) {
                // Resolve names for activity log
                const fromUser = ticket.assigned_to ? db.prepare('SELECT display_name, username FROM users WHERE id = ?').get(ticket.assigned_to) : null;
                const toUser = updates.assigned_to ? db.prepare('SELECT display_name, username FROM users WHERE id = ?').get(updates.assigned_to) : null;

                const fromName = fromUser ? (fromUser.display_name || fromUser.username) : '未指派';
                const toName = toUser ? (toUser.display_name || toUser.username) : '未指派';

                db.prepare(`
                    INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                    VALUES (?, 'assignment_change', ?, ?, ?, ?, ?, 'all')
                `).run(
                    id,
                    `指派人变更: ${fromName} → ${toName}`,
                    JSON.stringify({ from_user_id: ticket.assigned_to, to_user_id: updates.assigned_to }),
                    req.user.id,
                    actorName,
                    actorDept
                );

                if (updates.assigned_to && updates.assigned_to > 0 && updates.assigned_to !== req.user.id) {
                    try {
                        db.prepare(`
                            INSERT INTO notifications (
                                recipient_id, notification_type, title, content, icon,
                                related_type, related_id, action_url, metadata, created_at
                            ) VALUES (?, 'assignment', ?, ?, 'user', 'ticket', ?, ?, ?, ?)
                        `).run(
                            updates.assigned_to,
                            `${actorName} 给您指派了新工单`,
                            `工单 ${ticket.ticket_number}`,
                            id,
                            `/service/tickets/${id}`,
                            JSON.stringify({ ticket_number: ticket.ticket_number, assigned_by: actorName }),
                            now
                        );
                    } catch (e) {
                        console.error('[Tickets] Failed to create assignment notification:', e.message);
                    }
                }

                // P2: Add new assignee as participant automatically
                if (updates.assigned_to && updates.assigned_to > 0) {
                    try {
                        db.prepare(`
                            INSERT OR IGNORE INTO ticket_participants (ticket_id, user_id, role, join_method, joined_at)
                            VALUES (?, ?, 'assignee', 'auto', ?)
                        `).run(id, updates.assigned_to, now);

                        // Also update role to 'assignee' if they were already a participant
                        db.prepare(`
                            UPDATE ticket_participants SET role = 'assignee' WHERE ticket_id = ? AND user_id = ?
                        `).run(id, updates.assigned_to);
                    } catch (e) {
                        console.error('[Tickets] Failed to add assignee as participant:', e.message);
                    }
                }
            }
            if (sets.length === 0) {
                return res.json({ success: true, message: '无更新' });
            }

            sets.push('updated_at = ?');
            params.push(now);
            params.push(id);

            db.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).run(...params);

            res.json({
                success: true,
                message: '更新成功',
                audited_fields: coreFieldsChanged.length > 0 ? coreFieldsChanged : undefined
            });
        } catch (err) {
            console.error('[Tickets] Update error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * DELETE /api/v1/tickets/:id
     * Soft delete ticket (PRD §7.2 墓碑化软删除)
     */
    router.delete('/:id', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { delete_reason } = req.body;

            // 强制要求删除理由
            if (!delete_reason || delete_reason.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '删除工单必须提供删除理由'
                });
            }

            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            // 已删除的工单不能重复删除
            if (ticket.is_deleted === 1) {
                return res.status(410).json({ success: false, error: '工单已被删除' });
            }

            const deptCode = getDeptCode(req.user);
            const isMsLead = deptCode === 'MS' && req.user.role === 'Lead';
            const isAdmin = req.user.role === 'Admin' || req.user.role === 'Exec' || isMsLead;
            const isOwner = ticket.created_by === req.user.id;
            const isDraftOrSubmitted = ['draft', 'submitted'].includes(ticket.current_node);

            // PRD §7.2 权限检查
            // 普通员工：仅允许删除自己创建且处于 draft 或 submitted 状态的工单
            // 管理员：允许删除任何工单
            if (!isAdmin) {
                if (!isOwner) {
                    return res.status(403).json({
                        success: false,
                        error: '仅允许删除自己创建的工单'
                    });
                }
                if (!isDraftOrSubmitted) {
                    return res.status(403).json({
                        success: false,
                        error: '仅允许删除草稿或已提交状态的工单',
                        current_node: ticket.current_node
                    });
                }
            }

            const now = new Date().toISOString();

            // 执行软删除
            db.prepare(`
                UPDATE tickets SET 
                    is_deleted = 1,
                    deleted_at = ?,
                    deleted_by = ?,
                    delete_reason = ?,
                    updated_at = ?
                WHERE id = ?
            `).run(now, req.user.id, delete_reason.trim(), now, id);

            // 记录删除活动到时间轴
            const actorName = req.user.display_name || req.user.username;
            const actorDept = req.user.department_name || 'MS';
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'system_event', ?, ?, ?, ?, ?, 'internal')
            `).run(
                id,
                `工单已删除。理由：${delete_reason.trim()}`,
                JSON.stringify({
                    event_type: 'soft_delete',
                    delete_reason: delete_reason.trim(),
                    deleted_by: req.user.id,
                    deleted_at: now,
                    is_admin_action: isAdmin
                }),
                req.user.id,
                actorName,
                actorDept
            );

            console.log(`[Tickets] Soft deleted ticket ${ticket.ticket_number} by ${actorName}, reason: ${delete_reason.trim()}`);

            res.json({
                success: true,
                message: '工单已删除',
                data: {
                    ticket_number: ticket.ticket_number,
                    deleted_at: now,
                    deleted_by: req.user.id
                }
            });
        } catch (err) {
            console.error('[Tickets] Delete error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/v1/tickets/:id/restore
     * Restore a soft-deleted ticket
     */
    router.post('/:id/restore', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { restore_reason } = req.body;

            if (!restore_reason || restore_reason.trim().length === 0) {
                return res.status(400).json({ success: false, error: '恢复工单必须提供理由' });
            }

            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
            if (!ticket) return res.status(404).json({ success: false, error: '工单不存在' });
            if (ticket.is_deleted !== 1) return res.status(400).json({ success: false, error: '工单未被删除' });

            const deptCode = getDeptCode(req.user);
            const isMsLead = deptCode === 'MS' && req.user.role === 'Lead';
            const isAdmin = req.user.role === 'Admin' || req.user.role === 'Exec' || isMsLead;

            if (!isAdmin) {
                return res.status(403).json({ success: false, error: '仅管理员或市场部负责人可恢复工单' });
            }

            db.prepare(`
                UPDATE tickets SET 
                    is_deleted = 0, 
                    deleted_at = NULL, 
                    deleted_by = NULL, 
                    delete_reason = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(id);

            const actorName = req.user.display_name || req.user.username;
            const actorDept = req.user.department_name || 'MS';
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'system_event', ?, ?, ?, ?, 'internal')
            `).run(id, `工单已从回收站恢复。理由：${restore_reason.trim()}`, req.user.id, actorName, actorDept);

            res.json({ success: true, message: '工单已恢复' });
        } catch (err) {
            console.error('[Tickets] Restore error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/v1/tickets/:id/convert
     * Convert inquiry to RMA or SVC
     */
    router.post('/:id/convert', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { target_type, channel_code = 'D' } = req.body;

            if (!target_type || !['rma', 'svc'].includes(target_type)) {
                return res.status(400).json({ success: false, error: '目标类型必须是 rma 或 svc' });
            }

            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            if (ticket.ticket_type !== 'inquiry') {
                return res.status(400).json({ success: false, error: '只能从咨询工单升级' });
            }

            const now = new Date().toISOString();
            const newTicketNumber = generateTicketNumber(target_type, channel_code);
            
            // Determine initial node based on target type (same as creation logic)
            let initialNode = 'submitted';
            if (target_type === 'rma') initialNode = 'op_receiving';
            if (target_type === 'svc') initialNode = 'submitted';
            
            const priority = ticket.priority || 'P2';

            const slaDue = slaService.calculateSlaDue(db, priority, initialNode, now, target_type);
            const slaDueStr = slaDue ? slaDue.toISOString() : null;

            // Create new ticket
            const insertSql = `
                INSERT INTO tickets (
                    ticket_number, ticket_type, current_node, status,
                    priority, node_entered_at, sla_due_at, sla_status,
                    channel_code,
                    reporter_snapshot,
                    account_id, contact_id, dealer_id, reporter_name, reporter_type, region,
                    product_id, serial_number, firmware_version, hardware_version,
                    issue_type, issue_category, issue_subcategory, severity,
                    problem_description, solution_for_customer, is_warranty,
                    submitted_by, created_by,
                    parent_ticket_id,
                    created_at, updated_at
                ) SELECT
                    ?, ?, ?, ?,
                    ?, ?, ?, 'normal',
                    ?,
                    reporter_snapshot,
                    account_id, contact_id, dealer_id, reporter_name, reporter_type, region,
                    product_id, serial_number, firmware_version, hardware_version,
                    issue_type, issue_category, issue_subcategory, severity,
                    problem_description, solution_for_customer, is_warranty,
                    ?, ?,
                    ?,
                    ?, ?
                FROM tickets WHERE id = ?
            `;

            const result = db.prepare(insertSql).run(
                newTicketNumber, target_type, initialNode, 'open',
                priority, now, slaDueStr,
                channel_code,
                req.user.id, req.user.id,
                id,
                now, now,
                id
            );

            // Mark original as converted
            db.prepare(`
                UPDATE tickets SET 
                    current_node = 'converted', 
                    status = 'closed',
                    status_changed_at = ?,
                    updated_at = ?
                WHERE id = ?
            `).run(now, now, id);

            // Record activities
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'ticket_linked', ?, ?, ?, ?, ?, 'all')
            `).run(
                id,
                `已升级为 ${target_type.toUpperCase()} 工单: ${newTicketNumber}`,
                JSON.stringify({ 
                    linked_ticket_id: result.lastInsertRowid, 
                    linked_ticket_number: newTicketNumber,
                    upgrade_reason: reason || null,
                    upgrade_type: target_type
                }),
                req.user.id,
                req.user.name,
                req.user.department || 'MS'
            );

            // 记录工单关闭原因（系统变更）
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'system_event', ?, ?, ?, ?, ?, 'all')
            `).run(
                id,
                `工单因升级为${target_type.toUpperCase()}工单而关闭`,
                JSON.stringify({ 
                    event_type: 'closed_due_to_upgrade',
                    reason: `升级为${target_type.toUpperCase()}工单: ${newTicketNumber}`,
                    linked_ticket_id: result.lastInsertRowid,
                    linked_ticket_number: newTicketNumber
                }),
                req.user.id,
                req.user.name,
                req.user.department || 'MS'
            );

            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'status_change', ?, ?, ?, ?, ?, 'all')
            `).run(
                result.lastInsertRowid,
                JSON.stringify({ from_node: null, to_node: initialNode, source_ticket: ticket.ticket_number }),
                JSON.stringify({ from_ticket_id: id, from_ticket_number: ticket.ticket_number }),
                req.user.id,
                req.user.name,
                req.user.department || 'MS'
            );

            // Trigger auto-assignment for the new ticket
            autoAssignTicket(result.lastInsertRowid, initialNode, target_type, req.user.id);

            res.json({
                success: true,
                data: {
                    new_ticket_id: result.lastInsertRowid,
                    new_ticket_number: newTicketNumber,
                    target_type,
                    original_ticket_id: id,
                    original_ticket_number: ticket.ticket_number
                }
            });
        } catch (err) {
            console.error('[Tickets] Convert error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });


    /**
     * POST /api/v1/tickets/:id/participants
     * Add a participant (Silent Invite)
     * P2: Records invite stats for memory feature
     */
    router.post('/:id/participants', authenticate, (req, res) => {
        try {
            const ticketId = req.params.id;
            const uids = req.body.user_ids || req.body.user_id;
            const inviterId = req.user.id;

            if (!uids) return res.status(400).json({ success: false, error: 'User IDs required' });

            // Allow multiple users as array, or single
            const uidsArr = Array.isArray(uids) ? uids : [uids];
            const now = new Date().toISOString();

            for (const uid of uidsArr) {
                // Ignore if already exists
                const existing = db.prepare('SELECT id FROM ticket_participants WHERE ticket_id = ? AND user_id = ?').get(ticketId, uid);
                if (!existing) {
                    db.prepare(`
                        INSERT INTO ticket_participants (ticket_id, user_id, role, added_by, join_method, joined_at) 
                        VALUES (?, ?, 'follower', ?, 'invite', ?)
                    `).run(ticketId, uid, inviterId, now);

                    // P2: Update invite stats
                    try {
                        const result = db.prepare(`
                            UPDATE user_invite_stats 
                            SET invite_count = invite_count + 1, last_invite_at = ?
                            WHERE user_id = ? AND invited_user_id = ?
                        `).run(now, inviterId, uid);

                        if (result.changes === 0) {
                            db.prepare(`
                                INSERT INTO user_invite_stats (user_id, invited_user_id, invite_count, last_invite_at)
                                VALUES (?, ?, 1, ?)
                            `).run(inviterId, uid, now);
                        }
                    } catch (e) {
                        console.error('[Tickets] Update invite stats error:', e);
                    }

                    // P2: Add notification
                    if (uid !== inviterId) {
                        try {
                            const currentTicket = db.prepare('SELECT ticket_number FROM tickets WHERE id = ?').get(ticketId);
                            if (currentTicket) {
                                db.prepare(`
                                    INSERT INTO notifications (
                                        recipient_id, notification_type, title, content, icon,
                                        related_type, related_id, action_url, metadata, created_at
                                    ) VALUES (?, 'invite', ?, ?, 'users', 'ticket', ?, ?, ?, ?)
                                `).run(
                                    uid,
                                    `${req.user.display_name || req.user.username} 邀请您加入工单协作`,
                                    `工单 ${currentTicket.ticket_number}`,
                                    ticketId,
                                    `/service/tickets/${ticketId}`,
                                    JSON.stringify({ ticket_number: currentTicket.ticket_number, invited_by: req.user.display_name || req.user.username }),
                                    now
                                );
                            }
                        } catch (e) {
                            console.error('[Tickets] Failed to notify invited participant:', e.message);
                        }
                    }
                }
            }

            res.json({ success: true, message: 'Participants added' });
        } catch (err) {
            console.error('[Tickets] Add participants error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * DELETE /api/v1/tickets/:id/participants/:userId
     * Remove a participant (Leave/Remove)
     */
    router.delete('/:id/participants/:userId', authenticate, (req, res) => {
        try {
            const ticketId = req.params.id;
            const userId = req.params.userId;

            const result = db.prepare('DELETE FROM ticket_participants WHERE ticket_id = ? AND user_id = ?').run(ticketId, userId);

            if (result.changes === 0) {
                return res.status(404).json({ success: false, error: 'Participant not found' });
            }

            res.json({ success: true, message: 'Participant removed' });
        } catch (err) {
            console.error('[Tickets] Remove participant error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });



    /**
     * POST /api/v1/tickets/:id/clean-contact
     * Clean and formalize reporter_snapshot into a real contact
     */
    router.post('/:id/clean-contact', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { account_id, name, phone, email, job_title } = req.body;

            if (!account_id || !name) {
                return res.status(400).json({ success: false, error: '关联公司 ID 和联系人姓名必填' });
            }

            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            // 1. Create Formal Contact
            const insertContactSql = `
                INSERT INTO contacts (
                    account_id, name, phone, email, job_title, status, is_primary
                ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0)
            `;
            const contactResult = db.prepare(insertContactSql).run(
                account_id, name, phone || null, email || null, job_title || null
            );
            const newContactId = contactResult.lastInsertRowid;

            // 2. Clear snapshot and bind formal identities to the ticket
            db.prepare(`
                UPDATE tickets 
                SET account_id = ?, contact_id = ?, reporter_snapshot = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(account_id, newContactId, id);

            // 3. Optional: Add an activity log
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'system', '数据清洗：临时信息已转正', ?, ?, ?, 'all')
            `).run(id, req.user.id, req.user.name, req.user.department || 'MS');

            res.json({ success: true, data: { contact_id: newContactId } });
        } catch (err) {
            console.error('[Tickets] Clean contact error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/v1/tickets/:id/convert-to-account
     * Create account (Individual/Organization) + contact and bind it to ghost ticket
     */
    router.post('/:id/convert-to-account', authenticate, (req, res) => {
        const dbTransaction = db.transaction(() => {
            const { id } = req.params;
            const { account_type = 'INDIVIDUAL', lifecycle_stage = 'PROSPECT', name, phone, email } = req.body;

            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
            if (!ticket) {
                throw new Error('工单不存在');
            }
            if (ticket.account_id) {
                throw new Error('工单已被关联，无法重复入库');
            }

            let snapshot = {};
            if (ticket.reporter_snapshot) {
                try {
                    snapshot = JSON.parse(ticket.reporter_snapshot);
                } catch (e) { }
            }

            const finalName = name || snapshot.name || ticket.contact_name || ticket.reporter_name || '未知访客';
            const finalPhone = phone || snapshot.phone || null;
            const finalEmail = email || snapshot.email || null;

            // 1. Create Account
            const insertAccountSql = `
                INSERT INTO accounts (name, account_type, lifecycle_stage, status, source)
                VALUES (?, ?, ?, 'ACTIVE', 'Manual')
            `;
            const accountResult = db.prepare(insertAccountSql).run(finalName, account_type.toUpperCase(), lifecycle_stage);
            const newAccountId = accountResult.lastInsertRowid;

            // 2. Create Formal Contact
            const insertContactSql = `
                INSERT INTO contacts (
                    account_id, name, phone, email, status, is_primary
                ) VALUES (?, ?, ?, ?, 'ACTIVE', 1)
            `;
            const contactResult = db.prepare(insertContactSql).run(
                newAccountId, finalName, finalPhone, finalEmail
            );
            const newContactId = contactResult.lastInsertRowid;

            // 3. Update Ticket
            db.prepare(`
                UPDATE tickets 
                SET account_id = ?, contact_id = ?, reporter_snapshot = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(newAccountId, newContactId, id);

            // 4. Log Activity
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'system', ?, ?, ?, ?, 'all')
            `).run(
                id,
                `转化为${account_type === 'ORGANIZATION' ? '机构' : '个人'}客户：已建档并绑定`,
                req.user.id,
                req.user.name,
                req.user.department || 'MS'
            );

            return { account_id: newAccountId, contact_id: newContactId };
        });

        try {
            const result = dbTransaction();
            res.json({ success: true, data: result });
        } catch (err) {
            console.error('[Tickets] Convert to account error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });


    /**
     * POST /api/v1/tickets/:id/mark-spam
     * Mark a ghost ticket as spam/closed
     */
    router.post('/:id/mark-spam', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            // Close ticket
            db.prepare(`
                UPDATE tickets 
                SET status = 'CLOSED', resolution_type = 'Rejected', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(id);

            // Log activity
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'system', '已将该工单标记为垃圾信息并关闭', ?, ?, ?, 'all')
            `).run(id, req.user.id, req.user.name, req.user.department || 'MS');

            res.json({ success: true });
        } catch (err) {
            console.error('[Tickets] Mark spam error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/v1/tickets/:id/action
     * 执行工单动作（如结案、转交等）
     */
    router.post('/:id/action', authenticate, (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const { action } = req.body;

            if (!id || !action) {
                return res.status(400).json({ success: false, error: '缺少必要参数' });
            }

            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            if (action === 'settle') {
                // 结案动作：将工单从 ms_closing 移动到 op_shipping
                if (ticket.current_node !== 'ms_closing') {
                    return res.status(400).json({ success: false, error: '工单状态不允许执行此操作' });
                }

                db.prepare('UPDATE tickets SET current_node = ?, updated_at = ? WHERE id = ?')
                    .run('op_shipping', new Date().toISOString(), id);

                // 记录活动
                db.prepare(`
                    INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                    VALUES (?, 'status_change', ?, ?, ?, ?, ?, 'all')
                `).run(
                    id,
                    `状态变更: 最终结案 → 打包发货`,
                    JSON.stringify({ from_node: 'ms_closing', to_node: 'op_shipping' }),
                    req.user.id,
                    req.user.name,
                    req.user.department || 'MS'
                );

                // 触发自动分发规则（含防外泄拦截）
                autoAssignTicket(id, 'op_shipping', ticket.ticket_type, req.user.id);

                return res.json({ success: true, message: '工单已移交至打包发货' });
            }

            return res.status(400).json({ success: false, error: `未知的操作: ${action}` });
        } catch (err) {
            console.error('[Tickets] Action error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/v1/tickets/:id/attachments
     * Upload attachments to ticket
     */
    router.post('/:id/attachments', authenticate, serviceUpload.array('file', 10), async (req, res) => {
        try {
            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            // 权限检查：Admin/Exec/MS Lead/原操作人可以上传
            const canUpload = () => {
                if (req.user.role === 'Admin' || req.user.role === 'Exec') return true;
                const userDept = (req.user.department_code || '').toUpperCase();
                if (req.user.role === 'Lead' && userDept === 'MS') return true;
                if (ticket.submitted_by === req.user.id) return true;
                return false;
            };

            if (!canUpload()) {
                return res.status(403).json({ success: false, error: '无权上传附件' });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ success: false, error: '没有上传文件' });
            }

            const attachments = [];
            for (const file of req.files) {
                const result = db.prepare(`
                    INSERT INTO ticket_attachments (ticket_id, file_name, file_path, file_size, file_type, uploaded_by)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(req.params.id, file.originalname, file.filename, file.size, file.mimetype, req.user.id);

                // 更新工单附件计数
                const countResult = db.prepare('SELECT COUNT(*) as count FROM ticket_attachments WHERE ticket_id = ?').get(req.params.id);
                db.prepare('UPDATE tickets SET attachments_count = ? WHERE id = ?').run(countResult.count, req.params.id);

                attachments.push({
                    id: result.lastInsertRowid,
                    file_name: file.originalname,
                    file_size: file.size,
                    file_type: file.mimetype,
                    file_url: `/api/v1/system/attachments/${result.lastInsertRowid}/download`
                });
            }

            res.status(201).json({ success: true, data: attachments });
        } catch (err) {
            console.error('[Tickets] Upload attachment error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * DELETE /api/v1/tickets/:id/attachments/:attachId
     * Delete attachment from ticket
     */
    router.delete('/:id/attachments/:attachId', authenticate, async (req, res) => {
        try {
            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            const attachment = db.prepare('SELECT * FROM ticket_attachments WHERE id = ? AND ticket_id = ?').get(req.params.attachId, req.params.id);
            if (!attachment) {
                return res.status(404).json({ success: false, error: '附件不存在' });
            }

            // 权限检查：Admin/Exec/MS Lead/上传者本人可以删除
            const canDelete = () => {
                if (req.user.role === 'Admin' || req.user.role === 'Exec') return true;
                const userDept = (req.user.department_code || '').toUpperCase();
                if (req.user.role === 'Lead' && userDept === 'MS') return true;
                if (attachment.uploaded_by === req.user.id) return true;
                return false;
            };

            if (!canDelete()) {
                return res.status(403).json({ success: false, error: '无权删除此附件' });
            }

            // 删除文件
            try {
                const fs = require('fs-extra');
                const path = require('path');
                const { SERVICE_TEMP_DIR } = require('../../index');
                const filePath = path.join(SERVICE_TEMP_DIR, attachment.file_path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (fileErr) {
                console.error('[Tickets] Failed to delete file:', fileErr);
                // 继续删除数据库记录
            }

            // 删除数据库记录
            db.prepare('DELETE FROM ticket_attachments WHERE id = ?').run(req.params.attachId);

            // 更新工单附件计数
            const countResult = db.prepare('SELECT COUNT(*) as count FROM ticket_attachments WHERE ticket_id = ?').get(req.params.id);
            db.prepare('UPDATE tickets SET attachments_count = ? WHERE id = ?').run(countResult.count, req.params.id);

            res.json({ success: true, message: '附件已删除' });
        } catch (err) {
            console.error('[Tickets] Delete attachment error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    return router;
};
