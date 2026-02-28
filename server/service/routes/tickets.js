/**
 * Unified Tickets Routes (统一工单 API)
 * P2 架构升级 - 单表多态设计
 * 
 * 支持工单类型: inquiry, rma, svc
 * 参考: Service_API.md Section 22
 */

const express = require('express');
const slaService = require('../sla_service');

module.exports = function (db, authenticate, serviceUpload) {
    const router = express.Router();

    // ==============================
    // Helper Functions
    // ==============================

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
            
            // Account/Contact
            account_id: row.account_id,
            account_name: row.account_name,
            contact_id: row.contact_id,
            contact_name: row.contact_name,
            dealer_id: row.dealer_id,
            dealer_name: row.dealer_name,
            reporter_name: row.reporter_name,
            reporter_type: row.reporter_type,
            region: row.region,
            
            // Product
            product_id: row.product_id,
            product_name: row.product_name,
            serial_number: row.serial_number,
            
            // Assignment
            assigned_to: row.assigned_to,
            assigned_name: row.assigned_name,
            submitted_by: row.submitted_by,
            submitted_name: row.submitted_name,
            
            // Timestamps
            created_at: row.created_at,
            updated_at: row.updated_at
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
                sort_order = 'desc'
            } = req.query;

            const user = req.user;
            let conditions = [];
            let params = [];

            // Role-based filtering
            if (user.user_type === 'Dealer') {
                conditions.push('t.dealer_id = ?');
                params.push(user.dealer_id);
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
            if (assigned_to) {
                conditions.push('t.assigned_to = ?');
                params.push(assigned_to);
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
                    c.name as contact_name,
                    d.name as dealer_name,
                    p.name as product_name,
                    u1.name as assigned_name,
                    u2.name as submitted_name
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
                    c.name as contact_name,
                    d.name as dealer_name,
                    p.name as product_name,
                    u1.name as assigned_name,
                    u2.name as submitted_name,
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

            // Check permission for dealers
            if (req.user.user_type === 'Dealer' && row.dealer_id !== req.user.dealer_id) {
                return res.status(403).json({ success: false, error: '无权访问此工单' });
            }

            // Calculate SLA remaining time
            const slaInfo = slaService.checkSlaStatus(row);
            const data = {
                ...formatTicket(row, true),
                sla_remaining_hours: slaInfo.remaining_hours,
                sla_remaining_percent: slaInfo.remaining_percent
            };

            res.json({ success: true, data });
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
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, actor_id, actor_name, actor_role, visibility)
                VALUES (?, 'status_change', ?, ?, ?, ?, 'all')
            `).run(
                result.lastInsertRowid,
                JSON.stringify({ from_node: null, to_node: initialNode }),
                req.user.id,
                req.user.name,
                req.user.department || 'MS'
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
     * Update ticket
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Get current ticket
            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            // Check permission
            if (req.user.user_type === 'Dealer' && ticket.dealer_id !== req.user.dealer_id) {
                return res.status(403).json({ success: false, error: '无权修改此工单' });
            }

            const now = new Date().toISOString();
            const allowedFields = [
                'priority', 'current_node',
                'account_id', 'contact_id', 'dealer_id', 'reporter_name', 'reporter_type', 'region',
                'product_id', 'serial_number', 'firmware_version', 'hardware_version',
                'issue_type', 'issue_category', 'issue_subcategory', 'severity',
                'service_type', 'channel', 'problem_summary', 'communication_log',
                'problem_description', 'solution_for_customer', 'is_warranty',
                'repair_content', 'problem_analysis', 'resolution',
                'assigned_to',
                'payment_channel', 'payment_amount', 'payment_date',
                'feedback_date', 'ship_date', 'received_date', 'completed_date',
                'snooze_until',
                'external_link'
            ];

            const sets = [];
            const params = [];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    sets.push(`${field} = ?`);
                    params.push(updates[field]);
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
                    req.user.name,
                    req.user.department || 'MS'
                );

                // Update status field
                sets.push('status = ?');
                params.push(mapNodeToStatus(updates.current_node));
                sets.push('status_changed_at = ?');
                params.push(now);
            }

            // Handle priority change
            if (updates.priority && updates.priority !== ticket.priority) {
                db.prepare(`
                    INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility)
                    VALUES (?, 'priority_change', ?, ?, ?, ?, ?, 'all')
                `).run(
                    id,
                    `优先级变更: ${ticket.priority} → ${updates.priority}`,
                    JSON.stringify({ from_priority: ticket.priority, to_priority: updates.priority }),
                    req.user.id,
                    req.user.name,
                    req.user.department || 'MS'
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
                    req.user.name,
                    req.user.department || 'MS'
                );
            }

            if (sets.length === 0) {
                return res.json({ success: true, message: '无更新' });
            }

            sets.push('updated_at = ?');
            params.push(now);
            params.push(id);

            db.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).run(...params);

            res.json({ success: true, message: '更新成功' });
        } catch (err) {
            console.error('[Tickets] Update error:', err);
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

    return router;
};
