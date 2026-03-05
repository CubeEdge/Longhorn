/**
 * Unified Tickets Routes (统一工单 API)
 * P2 架构升级 - 单表多态设计
 * 
 * 支持工单类型: inquiry, rma, svc
 * 参考: Service_API.md Section 22
 */

const express = require('express');
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
        sla_due_at: 'SLA死线',
        reporter_snapshot: '报修人快照'
    };

    const DEPARTMENT_NODES = {
        'MS': ['draft', 'submitted', 'ms_review', 'waiting_customer', 'ms_closing'],
        'OP': ['op_receiving', 'op_diagnosing', 'op_repairing', 'op_qa'],
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
     * Map current_node to summary status
     */
    function mapNodeToStatus(node) {
        const mapping = {
            draft: 'open',
            in_progress: 'in_progress',
            waiting_customer: 'waiting',
            submitted: 'open',
            ms_review: 'in_progress',
            ge_review: 'in_progress',
            op_receiving: 'in_progress',
            op_diagnosing: 'in_progress',
            op_repairing: 'in_progress',
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

                // Approval
                approval_status: row.approval_status,
                approved_by: row.approved_by,
                approved_at: row.approved_at,

                // Auto close
                auto_close_reminder_sent: row.auto_close_reminder_sent,
                auto_close_at: row.auto_close_at
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
                teamUsers = db.prepare(`
                    SELECT u.id, u.username, u.display_name 
                    FROM users u
                    JOIN departments d ON u.department_id = d.id
                    WHERE d.name = ?
                `).all(targetDept);
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
                    OR (t.assigned_to IS NULL AND t.current_node IN (${nodesList}))
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
                    c.name as contact_name,
                    c.email as contact_email,
                    c.job_title as contact_job_title,
                    d.name as dealer_name,
                    d.dealer_code as dealer_code,
                    p.model_name as product_name,
                    p.serial_number as product_serial_number,
                    p.firmware_version as product_firmware,
                    p.product_line as product_line,
                    u1.username as assigned_name,
                    u2.username as submitted_name,
                    pt.ticket_number as parent_ticket_number
                FROM tickets t
                LEFT JOIN accounts a ON t.account_id = a.id
                LEFT JOIN contacts c ON t.contact_id = c.id
                LEFT JOIN accounts d ON t.dealer_id = d.id
                LEFT JOIN products p ON t.product_id = p.id
                LEFT JOIN users u1 ON t.assigned_to = u1.id
                LEFT JOIN users u2 ON t.submitted_by = u2.id
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
            const activities = rawActivities.map(a => ({
                ...a,
                actor: a.actor_id ? {
                    id: a.actor_id,
                    name: a.resolved_actor_name || a.actor_name || null,
                    role: a.actor_role
                } : null
            }));

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
                data: ticketData,
                account: accountContext,
                product: productContext,
                activities: activities || [],
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
     */
    router.post('/', authenticate, (req, res) => {
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

            const now = new Date().toISOString();
            const ticketNumber = generateTicketNumber(ticket_type, channel_code);

            // Determine initial node
            let initialNode = 'draft';
            if (ticket_type === 'rma') initialNode = 'submitted';
            if (ticket_type === 'svc') initialNode = 'submitted';

            // Calculate SLA due
            const slaDue = slaService.calculateSlaDue(priority, initialNode, now);
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

            const result = db.prepare(insertSql).run(
                ticketNumber, ticket_type, initialNode, mapNodeToStatus(initialNode),
                priority, now, slaDueStr,
                channel_code,
                reporter_snapshot ? JSON.stringify(reporter_snapshot) : null,
                account_id || null, contact_id || null, dealer_id || null, reporter_name || null, reporter_type || null, region || null,
                product_id || null, serial_number || null, firmware_version || null, hardware_version || null,
                issue_type || null, issue_category || null, issue_subcategory || null, severity || 3,
                service_type || null, channel || null, problem_summary || null, communication_log || null,
                problem_description || null, solution_for_customer || null, is_warranty !== undefined ? is_warranty : 1,
                req.user.id, assigned_to || null, req.user.id,
                feedback_date || null,
                parent_ticket_id || null,
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
                'external_link'
            ];

            // 1. 检测所有变更的字段
            const allChangedFields = allowedFields.filter(field => {
                if (updates[field] === undefined) return false;
                const oldVal = ticket[field];
                const newVal = updates[field];
                if (field === 'reporter_snapshot') {
                    const oldStr = typeof oldVal === 'string' ? oldVal : JSON.stringify(oldVal);
                    const newStr = typeof newVal === 'string' ? newVal : JSON.stringify(newVal);
                    return oldStr !== newStr;
                }
                return String(oldVal || '') !== String(newVal || '');
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
            const sets = [];
            const params = [];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    sets.push(`${field} = ?`);
                    if (field === 'reporter_snapshot') {
                        params.push(updates[field] ? JSON.stringify(updates[field]) : null);
                    } else {
                        params.push(updates[field]);
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

                // Record activity
                db.prepare(`
                    INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                    VALUES (?, 'status_change', ?, ?, ?, ?, ?, 'all')
                `).run(
                    id,
                    `状态变更: ${ticket.current_node} → ${updates.current_node}`,
                    JSON.stringify({ from_node: ticket.current_node, to_node: updates.current_node }),
                    req.user.id,
                    actorName,
                    actorDept
                );

                // Update status field
                sets.push('status = ?');
                params.push(mapNodeToStatus(updates.current_node));
                sets.push('status_changed_at = ?');
                params.push(now);
            }

            // Handle priority change (if not already in audit fields)
            if (updates.priority && updates.priority !== ticket.priority && !auditFieldsToChange.includes('priority')) {
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
                    const slaDue = slaService.calculateSlaDue(updates.priority, ticket.current_node, ticket.node_entered_at || now);
                    sets.push('sla_due_at = ?');
                    params.push(slaDue ? slaDue.toISOString() : null);
                }
            }

            // Handle assignment change
            if (updates.assigned_to !== undefined && updates.assigned_to !== ticket.assigned_to) {
                db.prepare(`
                    INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                    VALUES (?, 'assignment_change', ?, ?, ?, ?, ?, 'all')
                `).run(
                    id,
                    `指派变更`,
                    JSON.stringify({ from_user_id: ticket.assigned_to, to_user_id: updates.assigned_to }),
                    req.user.id,
                    actorName,
                    actorDept
                );

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
                audited_fields: auditFieldsToChange.length > 0 ? auditFieldsToChange : undefined
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
            const initialNode = 'submitted';
            const priority = ticket.priority || 'P2';

            const slaDue = slaService.calculateSlaDue(priority, initialNode, now);
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
                JSON.stringify({ linked_ticket_id: result.lastInsertRowid, linked_ticket_number: newTicketNumber }),
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
     * POST /api/v1/tickets/:id/participants
     * Add a participant (Silent Invite)
     * P2: Records invite stats for memory feature
     */
    router.post('/:id/participants', authenticate, (req, res) => {
        try {
            const ticketId = req.params.id;
            const { user_id } = req.body;
            const inviterId = req.user.id;

            if (!user_id) return res.status(400).json({ success: false, error: 'User ID required' });

            // Allow multiple users as array, or single
            const uids = Array.isArray(user_id) ? user_id : [user_id];
            const now = new Date().toISOString();

            for (const uid of uids) {
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
                    d.name as dept_code,
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
                    is.invited_user_id as user_id,
                    u.username as name,
                    d.name as department,
                    d.name as dept_code,
                    is.invite_count,
                    is.last_invite_at
                FROM user_invite_stats is
                LEFT JOIN users u ON is.invited_user_id = u.id
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE is.user_id = ?
                ORDER BY is.invite_count DESC, is.last_invite_at DESC
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

    return router;
};
