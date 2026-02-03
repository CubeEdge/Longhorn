/**
 * Inquiry Tickets Routes (咨询工单)
 * Three-Layer Ticket Model - Layer 1
 * ID Format: KYYMM-XXXX (e.g., K2602-0001)
 */

const express = require('express');

module.exports = function (db, authenticate, serviceUpload) {
    const router = express.Router();

    // ==============================
    // Helper Functions
    // ==============================

    /**
     * Generate Inquiry Ticket Number
     * Format: KYYMM-XXXX (e.g., K2602-0001)
     */
    function generateTicketNumber(db) {
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yearMonth = yy + mm; // "2602"

        const existing = db.prepare(`
            SELECT last_sequence FROM inquiry_ticket_sequences WHERE year_month = ?
        `).get(yearMonth);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare('UPDATE inquiry_ticket_sequences SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE year_month = ?')
                .run(seq, yearMonth);
        } else {
            seq = 1;
            db.prepare('INSERT INTO inquiry_ticket_sequences (year_month, last_sequence) VALUES (?, ?)')
                .run(yearMonth, seq);
        }

        // Support hex for overflow (>9999)
        const seqStr = seq <= 9999
            ? String(seq).padStart(4, '0')
            : seq.toString(16).toUpperCase().padStart(4, '0');

        return `K${yearMonth}-${seqStr}`;
    }

    function parseDate(dateStr) {
        if (!dateStr) return null;
        try {
            // SQLite format: "2026-02-01 12:00:00"
            // ISO format: "2026-02-01T12:00:00"
            const normalized = typeof dateStr === 'string' && dateStr.includes(' ')
                ? dateStr.replace(' ', 'T')
                : dateStr;
            const d = new Date(normalized);
            if (isNaN(d.getTime())) return dateStr;
            return d.toISOString();
        } catch (e) {
            return dateStr;
        }
    }

    function formatListItem(ticket) {
        try {
            return {
                id: ticket.id,
                ticket_number: ticket.ticket_number,
                service_type: ticket.service_type,
                channel: ticket.channel,
                customer_name: ticket.customer_name || '匿名客户',
                problem_summary: ticket.problem_summary,
                status: ticket.status,
                handler: ticket.handler_name ? { id: ticket.handler_id, name: ticket.handler_name } : null,
                product: ticket.product_name ? { id: ticket.product_id, name: ticket.product_name } : null,
                serial_number: ticket.serial_number,
                created_at: parseDate(ticket.created_at),
                updated_at: parseDate(ticket.updated_at)
            };
        } catch (error) {
            console.error(`ERROR formatting listItem ${ticket.id}:`, error);
            return { id: ticket.id, error: true };
        }
    }

    function formatDetail(ticket) {
        return {
            id: ticket.id,
            ticket_number: ticket.ticket_number,

            // Customer Info
            customer_name: ticket.customer_name || '匿名客户',
            customer_contact: ticket.customer_contact,
            customer_id: ticket.customer_id,
            dealer_id: ticket.dealer_id,
            dealer_name: ticket.dealer_name,

            // Product Info
            product: ticket.product_name ? {
                id: ticket.product_id,
                name: ticket.product_name
            } : null,
            serial_number: ticket.serial_number,

            // Service Content
            service_type: ticket.service_type,
            channel: ticket.channel,
            problem_summary: ticket.problem_summary,
            communication_log: ticket.communication_log,
            resolution: ticket.resolution,

            // Status & Tracking
            status: ticket.status,
            handler: ticket.handler_name ? { id: ticket.handler_id, name: ticket.handler_name } : null,
            created_by: ticket.creator_name ? { id: ticket.created_by, name: ticket.creator_name } : null,

            // Upgrade Info
            upgraded_to: ticket.upgraded_to_type ? {
                type: ticket.upgraded_to_type,
                id: ticket.upgraded_to_id
            } : null,
            upgraded_at: ticket.upgraded_at,

            // Timestamps
            first_response_at: parseDate(ticket.first_response_at),
            resolved_at: parseDate(ticket.resolved_at),
            reopened_at: parseDate(ticket.reopened_at),
            created_at: parseDate(ticket.created_at),
            updated_at: parseDate(ticket.updated_at)
        };
    }

    // ==============================
    // Routes
    // ==============================

    /**
     * GET /api/v1/inquiry-tickets/stats
     * Get dashboard statistics for inquiry tickets
     */
    router.get('/stats', authenticate, (req, res) => {
        try {
            const {
                status,
                service_type,
                channel,
                dealer_id,
                handler_id,
                customer_id,
                serial_number,
                created_from,
                created_to,
                keyword,
                product_id
            } = req.query;

            const user = req.user;
            let conditions = [];
            let params = [];

            // Role-based filtering
            if (user.user_type === 'Dealer') {
                conditions.push('dealer_id = ?');
                params.push(user.dealer_id);
            } else if (user.user_type === 'Customer') {
                conditions.push('customer_id = ?');
                params.push(user.id);
            } else if (user.role === 'Member') {
                conditions.push('(handler_id = ? OR created_by = ?)');
                params.push(user.id, user.id);
            }

            // Filter conditions
            if (status) {
                const statuses = status.split(',');
                conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }
            if (service_type) {
                conditions.push('service_type = ?');
                params.push(service_type);
            }
            if (channel) {
                conditions.push('channel = ?');
                params.push(channel);
            }
            if (product_id) {
                conditions.push('product_id = ?');
                params.push(product_id);
            }
            if (dealer_id) {
                conditions.push('dealer_id = ?');
                params.push(dealer_id);
            }
            if (handler_id === 'me') {
                conditions.push('handler_id = ?');
                params.push(user.id);
            } else if (handler_id) {
                conditions.push('handler_id = ?');
                params.push(parseInt(handler_id));
            }
            if (customer_id) {
                conditions.push('customer_id = ?');
                params.push(customer_id);
            }
            if (serial_number) {
                conditions.push('serial_number LIKE ?');
                params.push(`%${serial_number}%`);
            }
            if (created_from) {
                conditions.push('date(created_at) >= date(?)');
                params.push(created_from);
            }
            if (created_to) {
                conditions.push('date(created_at) <= date(?)');
                params.push(created_to);
            }
            if (keyword) {
                conditions.push(`(
                    ticket_number LIKE ? OR 
                    customer_name LIKE ? OR 
                    problem_summary LIKE ? OR
                    serial_number LIKE ?
                )`);
                const term = `%${keyword}%`;
                params.push(term, term, term, term);
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            const stats = db.prepare(`
                SELECT status, COUNT(*) as count 
                FROM inquiry_tickets ${whereClause}
                GROUP BY status
            `).all(...params);

            const totalRow = db.prepare(`
                SELECT COUNT(*) as total FROM inquiry_tickets ${whereClause}
            `).get(...params);

            const result = {
                total: totalRow.total,
                by_status: {}
            };
            stats.forEach(s => { result.by_status[s.status] = s.count; });

            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Error getting inquiry ticket stats:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * GET /api/v1/inquiry-tickets
     * List inquiry tickets with filtering and pagination
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 20,
                sort_by = 'created_at',
                sort_order = 'desc',
                status,
                service_type,
                channel,
                dealer_id,
                handler_id,
                customer_id,
                serial_number,
                created_from,
                created_to,
                keyword,
                product_id
            } = req.query;

            console.log('DEBUG: GET /inquiry-tickets');
            console.log('Query:', req.query);
            console.log('User:', req.user);

            const user = req.user;
            let conditions = [];
            let params = [];

            // Role-based filtering
            console.log('DEBUG: Checkpoint 1 - Roles');
            if (user.user_type === 'Dealer') {
                conditions.push('t.dealer_id = ?');
                params.push(user.dealer_id);
            } else if (user.user_type === 'Customer') {
                conditions.push('t.customer_id = ?');
                params.push(user.id);
            } else if (user.role === 'Member') {
                conditions.push('(t.handler_id = ? OR t.created_by = ?)');
                params.push(user.id, user.id);
            }

            console.log('DEBUG: Checkpoint 2 - Params');
            // Filter conditions
            if (status) {
                const statuses = status.split(',');
                conditions.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }
            console.log('DEBUG: Checkpoint 3 - ServiceType');
            if (service_type) {
                conditions.push('t.service_type = ?');
                params.push(service_type);
            }
            if (channel) {
                conditions.push('t.channel = ?');
                params.push(channel);
            }
            if (product_id) {
                conditions.push('t.product_id = ?');
                params.push(product_id);
            }
            console.log('DEBUG: Checkpoint 4 - Dealer');
            if (dealer_id) {
                conditions.push('t.dealer_id = ?');
                params.push(dealer_id);
            }
            if (handler_id === 'me') {
                conditions.push('t.handler_id = ?');
                params.push(user.id);
            } else if (handler_id) {
                conditions.push('t.handler_id = ?');
                params.push(parseInt(handler_id));
            }
            console.log('DEBUG: Checkpoint 5 - Customer');
            if (customer_id) {
                conditions.push('t.customer_id = ?');
                params.push(customer_id);
            }
            if (serial_number) {
                conditions.push('t.serial_number LIKE ?');
                params.push(`%${serial_number}%`);
            }
            console.log('DEBUG: Checkpoint 6 - Dates');
            if (created_from) {
                conditions.push('date(t.created_at) >= date(?)');
                params.push(created_from);
            }
            if (created_to) {
                conditions.push('date(t.created_at) <= date(?)');
                params.push(created_to);
            }
            console.log('DEBUG: Checkpoint 7 - Keyword');
            if (keyword) {
                conditions.push(`(
                    t.ticket_number LIKE ? OR 
                    t.customer_name LIKE ? OR 
                    t.problem_summary LIKE ? OR
                    t.serial_number LIKE ?
                )`);
                const term = `%${keyword}%`;
                params.push(term, term, term, term);
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
            console.log('DEBUG: WhereClause:', whereClause);
            console.log('DEBUG: Params:', params);

            // Validate sort
            const allowedSorts = ['created_at', 'updated_at', 'status', 'ticket_number'];
            const safeSortBy = allowedSorts.includes(sort_by) ? sort_by : 'created_at';
            const safeSortOrder = sort_order === 'asc' ? 'ASC' : 'DESC';

            // Count
            const countResult = db.prepare(`
                SELECT COUNT(*) as total FROM inquiry_tickets t ${whereClause}
            `).get(...params);

            // Paginate
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const tickets = db.prepare(`
                SELECT 
                    t.*,
                    h.username as handler_name,
                    p.model_name as product_name
                FROM inquiry_tickets t
                LEFT JOIN users h ON t.handler_id = h.id
                LEFT JOIN products p ON t.product_id = p.id
                ${whereClause}
                ORDER BY t.${safeSortBy} ${safeSortOrder}
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            console.log('DEBUG: Count Result:', countResult);
            console.log('DEBUG: Tickets Found:', tickets.length);
            if (tickets.length > 0) {
                console.log('DEBUG: First Ticket:', tickets[0]);
            }

            res.json({
                success: true,
                data: tickets.map(formatListItem),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total: countResult.total
                }
            });
        } catch (error) {
            console.error('Error listing inquiry tickets:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * GET /api/v1/inquiry-tickets/:id
     * Get single inquiry ticket detail
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const ticket = db.prepare(`
                SELECT 
                    t.*,
                    h.username as handler_name,
                    c.username as creator_name,
                    p.model_name as product_name,
                    d.name as dealer_name
                FROM inquiry_tickets t
                LEFT JOIN users h ON t.handler_id = h.id
                LEFT JOIN users c ON t.created_by = c.id
                LEFT JOIN products p ON t.product_id = p.id
                LEFT JOIN dealers d ON t.dealer_id = d.id
                WHERE t.id = ?
            `).get(req.params.id);

            if (!ticket) {
                return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
            }

            // Get attachments
            const attachments = db.prepare(`
                SELECT id, file_name, file_path, file_size, file_type, uploaded_at
                FROM service_attachments
                WHERE ticket_type = 'Inquiry' AND ticket_id = ?
            `).all(req.params.id);

            const formatted = formatDetail(ticket);
            formatted.attachments = attachments;

            res.json({ success: true, data: formatted });
        } catch (error) {
            console.error('Error getting inquiry ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * POST /api/v1/inquiry-tickets
     * Create new inquiry ticket
     */
    router.post('/', authenticate, serviceUpload.array('attachments'), (req, res) => {
        try {
            const {
                customer_name,
                customer_contact,
                customer_id,
                dealer_id,
                product_id,
                serial_number,
                service_type = 'Consultation',
                channel,
                problem_summary,
                communication_log
            } = req.body;

            if (!problem_summary) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '问题摘要不能为空' }
                });
            }

            const ticketNumber = generateTicketNumber(db);

            const result = db.prepare(`
                INSERT INTO inquiry_tickets (
                    ticket_number, customer_name, customer_contact, customer_id, dealer_id,
                    product_id, serial_number, service_type, channel, problem_summary,
                    communication_log, status, created_by, handler_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'InProgress', ?, ?)
            `).run(
                ticketNumber, customer_name, customer_contact, customer_id, dealer_id,
                product_id, serial_number, service_type, channel, problem_summary,
                communication_log, req.user.id, req.user.id
            );

            const ticketId = result.lastInsertRowid;

            // Handle attachments
            if (req.files && req.files.length > 0) {
                const insertAttachment = db.prepare(`
                    INSERT INTO service_attachments (
                        ticket_type, ticket_id, file_name, file_path, 
                        file_size, file_type, uploaded_by
                    ) VALUES ('Inquiry', ?, ?, ?, ?, ?, ?)
                `);

                for (const file of req.files) {
                    insertAttachment.run(
                        ticketId,
                        file.originalname,
                        `/uploads/service/${file.filename}`,
                        file.size,
                        file.mimetype,
                        req.user.id
                    );
                }
            }

            res.status(201).json({
                success: true,
                data: {
                    id: ticketId,
                    ticket_number: ticketNumber,
                    status: 'InProgress',
                    created_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error creating inquiry ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * PATCH /api/v1/inquiry-tickets/:id
     * Update inquiry ticket
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const {
                status,
                resolution,
                communication_log,
                handler_id
            } = req.body;

            const ticket = db.prepare('SELECT * FROM inquiry_tickets WHERE id = ?').get(id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
            }

            const updates = [];
            const params = [];

            if (status !== undefined) {
                updates.push('status = ?');
                params.push(status);

                if (status === 'Resolved' && !ticket.resolved_at) {
                    updates.push('resolved_at = CURRENT_TIMESTAMP');
                }
            }
            if (resolution !== undefined) {
                updates.push('resolution = ?');
                params.push(resolution);
            }
            if (communication_log !== undefined) {
                updates.push('communication_log = ?');
                params.push(communication_log);
            }
            if (handler_id !== undefined) {
                updates.push('handler_id = ?');
                params.push(handler_id);
            }

            if (updates.length > 0) {
                updates.push('updated_at = CURRENT_TIMESTAMP');
                params.push(id);
                db.prepare(`UPDATE inquiry_tickets SET ${updates.join(', ')} WHERE id = ?`).run(...params);
            }

            const updated = db.prepare('SELECT * FROM inquiry_tickets WHERE id = ?').get(id);
            res.json({ success: true, data: formatDetail(updated) });
        } catch (error) {
            console.error('Error updating inquiry ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * POST /api/v1/inquiry-tickets/:id/upgrade
     * Upgrade inquiry ticket to RMA or Dealer Repair
     */
    router.post('/:id/upgrade', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const {
                upgrade_type,  // 'rma' or 'svc'
                channel_code,  // D/C/I (for RMA)
                issue_category,
                issue_subcategory,
                severity
            } = req.body;

            const ticket = db.prepare('SELECT * FROM inquiry_tickets WHERE id = ?').get(id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
            }

            if (ticket.status === 'Upgraded') {
                return res.status(422).json({
                    success: false,
                    error: { code: 'ALREADY_UPGRADED', message: '该工单已升级' }
                });
            }

            // This will be implemented when rma-tickets and dealer-repairs routes are ready
            // For now, just update the status
            db.prepare(`
                UPDATE inquiry_tickets 
                SET status = 'Upgraded', 
                    upgraded_to_type = ?, 
                    upgraded_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(upgrade_type, id);

            res.json({
                success: true,
                data: {
                    inquiry_ticket_id: id,
                    inquiry_ticket_number: ticket.ticket_number,
                    inquiry_ticket_status: 'Upgraded',
                    upgraded_to: {
                        type: upgrade_type,
                        id: null,  // Will be populated when actual ticket is created
                        ticket_number: null
                    }
                }
            });
        } catch (error) {
            console.error('Error upgrading inquiry ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * POST /api/v1/inquiry-tickets/:id/reopen
     * Reopen a closed inquiry ticket
     */
    router.post('/:id/reopen', authenticate, (req, res) => {
        try {
            const { id } = req.params;

            const ticket = db.prepare('SELECT * FROM inquiry_tickets WHERE id = ?').get(id);
            if (!ticket) {
                return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
            }

            if (!['Resolved', 'AutoClosed'].includes(ticket.status)) {
                return res.status(422).json({
                    success: false,
                    error: { code: 'INVALID_STATUS', message: '只有已解决或自动关闭的工单可以重新打开' }
                });
            }

            db.prepare(`
                UPDATE inquiry_tickets 
                SET status = 'InProgress', 
                    reopened_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(id);

            const updated = db.prepare('SELECT * FROM inquiry_tickets WHERE id = ?').get(id);
            res.json({ success: true, data: formatDetail(updated) });
        } catch (error) {
            console.error('Error reopening inquiry ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * DELETE /api/v1/inquiry-tickets/:id
     * Delete inquiry ticket (admin only)
     */
    router.delete('/:id', authenticate, (req, res) => {
        try {
            if (req.user.role !== 'Admin') {
                return res.status(403).json({ success: false, error: { message: 'Permission denied' } });
            }

            const result = db.prepare('DELETE FROM inquiry_tickets WHERE id = ?').run(req.params.id);

            if (result.changes === 0) {
                return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
            }

            res.json({ success: true, data: { deleted: true } });
        } catch (error) {
            console.error('Error deleting inquiry ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    return router;
};
