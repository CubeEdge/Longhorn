/**
 * Legacy API Adapter (向后兼容 API 适配层)
 * P2 架构升级
 * 
 * 将旧的 inquiry-tickets, rma-tickets API 请求转发到新的统一 tickets API
 */

const express = require('express');

module.exports = function (db, authenticate, ticketsRouter) {
    const router = express.Router();

    /**
     * 字段映射: 旧字段 -> 新字段
     */
    const FIELD_MAPPING = {
        // inquiry_tickets -> tickets
        inquiry: {
          customer_id: 'account_id',
          customer_name: 'reporter_name',
          handler_id: 'assigned_to'
        },
        // rma_tickets -> tickets
        rma: {
          customer_id: 'account_id',
          inquiry_ticket_id: 'parent_ticket_id',
          repair_priority: 'priority'
        },
        // dealer_repairs -> tickets  
        svc: {
          customer_id: 'account_id',
          customer_name: 'reporter_name',
          inquiry_ticket_id: 'parent_ticket_id'
        }
    };

    /**
     * 优先级映射: R1/R2/R3 -> P0/P1/P2
     */
    const PRIORITY_MAP = {
        'R1': 'P0',
        'R2': 'P1', 
        'R3': 'P2',
        'P0': 'P0',
        'P1': 'P1',
        'P2': 'P2'
    };

    /**
     * 反向优先级映射
     */
    const REVERSE_PRIORITY_MAP = {
        'P0': 'R1',
        'P1': 'R2',
        'P2': 'R3'
    };

    /**
     * 转换请求体: 旧格式 -> 新格式
     */
    function transformRequest(body, ticketType) {
        const mapping = FIELD_MAPPING[ticketType] || {};
        const transformed = { ...body, ticket_type: ticketType };

        for (const [oldField, newField] of Object.entries(mapping)) {
            if (body[oldField] !== undefined) {
                transformed[newField] = body[oldField];
                if (oldField !== newField) {
                    delete transformed[oldField];
                }
            }
        }

        // 优先级转换
        if (transformed.repair_priority) {
            transformed.priority = PRIORITY_MAP[transformed.repair_priority] || 'P2';
            delete transformed.repair_priority;
        }

        return transformed;
    }

    /**
     * 转换响应: 新格式 -> 旧格式
     */
    function transformResponse(ticket, ticketType) {
        if (!ticket) return ticket;

        const result = { ...ticket };
        const mapping = FIELD_MAPPING[ticketType] || {};

        // 反向映射
        for (const [oldField, newField] of Object.entries(mapping)) {
            if (result[newField] !== undefined && oldField !== newField) {
                result[oldField] = result[newField];
            }
        }

        // 反向优先级转换
        if (result.priority && ticketType !== 'inquiry') {
            result.repair_priority = REVERSE_PRIORITY_MAP[result.priority] || 'R3';
        }

        return result;
    }

    /**
     * 状态映射: 新状态 -> 旧状态 (inquiry)
     */
    function mapInquiryStatus(currentNode) {
        const mapping = {
            draft: 'Pending',
            in_progress: 'InProgress',
            waiting_customer: 'AwaitingFeedback',
            resolved: 'Resolved',
            auto_closed: 'AutoClosed',
            converted: 'Upgraded'
        };
        return mapping[currentNode] || currentNode;
    }

    /**
     * 状态映射: 新状态 -> 旧状态 (rma)
     */
    function mapRmaStatus(currentNode) {
        const mapping = {
            submitted: 'Pending',
            ms_review: 'MSReview',
            op_receiving: 'Receiving',
            op_diagnosing: 'Diagnosing',
            op_repairing: 'Repairing',
            op_qa: 'QA',
            ms_closing: 'MSClosing',
            closed: 'Closed',
            cancelled: 'Cancelled'
        };
        return mapping[currentNode] || currentNode;
    }

    // ==============================
    // Legacy Inquiry Tickets API
    // ==============================

    /**
     * GET /api/inquiry-tickets
     * 兼容旧的咨询工单列表接口
     */
    router.get('/inquiry-tickets', authenticate, async (req, res) => {
        try {
            // 添加 ticket_type 过滤
            req.query.ticket_type = 'inquiry';
            
            // 转发到新 API
            const tickets = db.prepare(`
                SELECT t.*, 
                       a.name as account_name,
                       u.name as assigned_name
                FROM tickets t
                LEFT JOIN accounts a ON t.account_id = a.id
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE t.ticket_type = 'inquiry'
                ORDER BY t.created_at DESC
                LIMIT 100
            `).all();

            // 转换响应格式
            const legacyTickets = tickets.map(t => ({
                ...transformResponse(t, 'inquiry'),
                status: mapInquiryStatus(t.current_node)
            }));

            res.json({ success: true, data: legacyTickets });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/inquiry-tickets/:id
     */
    router.get('/inquiry-tickets/:id', authenticate, (req, res) => {
        try {
            const ticket = db.prepare(`
                SELECT t.*, 
                       a.name as account_name
                FROM tickets t
                LEFT JOIN accounts a ON t.account_id = a.id
                WHERE t.id = ? AND t.ticket_type = 'inquiry'
            `).get(req.params.id);

            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            const legacy = {
                ...transformResponse(ticket, 'inquiry'),
                status: mapInquiryStatus(ticket.current_node)
            };

            res.json({ success: true, data: legacy });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/inquiry-tickets
     */
    router.post('/inquiry-tickets', authenticate, (req, res) => {
        try {
            const transformed = transformRequest(req.body, 'inquiry');
            
            // 直接调用新 API 的创建逻辑
            // 简化: 直接插入
            const now = new Date().toISOString();
            const ticketNumber = generateInquiryNumber(db);
            
            const result = db.prepare(`
                INSERT INTO tickets (
                    ticket_number, ticket_type, current_node, status,
                    account_id, dealer_id, reporter_name, reporter_type,
                    product_id, serial_number, service_type, channel,
                    problem_summary, communication_log, assigned_to, created_by,
                    priority, sla_status, breach_counter,
                    created_at, updated_at
                ) VALUES (?, 'inquiry', 'draft', 'open', ?, ?, ?, 'customer',
                          ?, ?, ?, ?, ?, ?, ?, ?,
                          'P2', 'normal', 0, ?, ?)
            `).run(
                ticketNumber,
                transformed.account_id,
                transformed.dealer_id,
                transformed.reporter_name,
                transformed.product_id,
                transformed.serial_number,
                transformed.service_type,
                transformed.channel,
                transformed.problem_summary,
                transformed.communication_log,
                transformed.assigned_to,
                req.user.id,
                now, now
            );

            res.json({
                success: true,
                data: { id: result.lastInsertRowid, ticket_number: ticketNumber }
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ==============================
    // Legacy RMA Tickets API
    // ==============================

    /**
     * GET /api/rma-tickets
     */
    router.get('/rma-tickets', authenticate, (req, res) => {
        try {
            const tickets = db.prepare(`
                SELECT t.*, 
                       a.name as account_name
                FROM tickets t
                LEFT JOIN accounts a ON t.account_id = a.id
                WHERE t.ticket_type = 'rma'
                ORDER BY t.created_at DESC
                LIMIT 100
            `).all();

            const legacyTickets = tickets.map(t => ({
                ...transformResponse(t, 'rma'),
                status: mapRmaStatus(t.current_node)
            }));

            res.json({ success: true, data: legacyTickets });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ==============================
    // Legacy Dealer Repairs API  
    // ==============================

    /**
     * GET /api/dealer-repairs
     */
    router.get('/dealer-repairs', authenticate, (req, res) => {
        try {
            const user = req.user;
            let whereClause = "t.ticket_type = 'svc'";
            const params = [];

            if (user.user_type === 'Dealer') {
                whereClause += ' AND t.dealer_id = ?';
                params.push(user.dealer_id);
            }

            const tickets = db.prepare(`
                SELECT t.*, 
                       a.name as account_name,
                       d.name as dealer_name
                FROM tickets t
                LEFT JOIN accounts a ON t.account_id = a.id
                LEFT JOIN dealers d ON t.dealer_id = d.id
                WHERE ${whereClause}
                ORDER BY t.created_at DESC
                LIMIT 100
            `).all(...params);

            const legacyTickets = tickets.map(t => transformResponse(t, 'svc'));

            res.json({ success: true, data: legacyTickets });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ==============================
    // Helper Functions
    // ==============================

    function generateInquiryNumber(db) {
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yearMonth = yy + mm;

        const existing = db.prepare(`
            SELECT last_sequence FROM ticket_sequences 
            WHERE ticket_type = 'inquiry' AND year_month = ?
        `).get(yearMonth);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare(`
                UPDATE ticket_sequences SET last_sequence = ? 
                WHERE ticket_type = 'inquiry' AND year_month = ?
            `).run(seq, yearMonth);
        } else {
            seq = 1;
            db.prepare(`
                INSERT INTO ticket_sequences (ticket_type, year_month, last_sequence) 
                VALUES ('inquiry', ?, ?)
            `).run(yearMonth, seq);
        }

        return `K${yearMonth}-${String(seq).padStart(4, '0')}`;
    }

    return router;
};
