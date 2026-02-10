/**
 * RMA Tickets Routes (RMA返厂单)
 * Three-Layer Ticket Model - Layer 2
 * ID Format: RMA-{C}-YYMM-XXXX (e.g., RMA-D-2602-0001)
 */

const express = require('express');
const path = require('path');
const fs = require('fs-extra');

module.exports = function (db, authenticate, attachmentsDir, multerModule, serviceUpload) {
    const router = express.Router();

    // ==============================
    // Helper Functions
    // ==============================

    /**
     * Generate RMA Ticket Number
     * Format: RMA-{C}-YYMM-XXXX (e.g., RMA-D-2602-0001)
     */
    function generateTicketNumber(db, channelCode = 'D') {
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yearMonth = yy + mm; // "2602"

        const existing = db.prepare(`
            SELECT last_sequence FROM rma_ticket_sequences 
            WHERE channel_code = ? AND year_month = ?
        `).get(channelCode, yearMonth);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare(`
                UPDATE rma_ticket_sequences 
                SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE channel_code = ? AND year_month = ?
            `).run(seq, channelCode, yearMonth);
        } else {
            seq = 1;
            db.prepare(`
                INSERT INTO rma_ticket_sequences (channel_code, year_month, last_sequence) 
                VALUES (?, ?, ?)
            `).run(channelCode, yearMonth, seq);
        }

        // Support hex for overflow (>9999)
        const seqStr = seq <= 9999
            ? String(seq).padStart(4, '0')
            : seq.toString(16).toUpperCase().padStart(4, '0');

        return `RMA-${channelCode}-${yearMonth}-${seqStr}`;
    }

    function formatListItem(ticket) {
        return {
            id: ticket.id,
            ticket_number: ticket.ticket_number,
            channel_code: ticket.channel_code,
            issue_type: ticket.issue_type,
            issue_category: ticket.issue_category,
            severity: ticket.severity,
            product: ticket.product_name ? { id: ticket.product_id, name: ticket.product_name } : null,
            serial_number: ticket.serial_number,
            problem_description: ticket.problem_description,
            reporter_name: ticket.reporter_name,
            status: ticket.status,
            assigned_to: ticket.assigned_name ? { id: ticket.assigned_to, name: ticket.assigned_name } : null,
            created_at: ticket.created_at,
            updated_at: ticket.updated_at
        };
    }

    function formatDetail(ticket) {
        return {
            id: ticket.id,
            ticket_number: ticket.ticket_number,
            channel_code: ticket.channel_code,

            // Issue Classification
            issue_type: ticket.issue_type,
            issue_category: ticket.issue_category,
            issue_subcategory: ticket.issue_subcategory,
            severity: ticket.severity,

            // Product Info
            product: ticket.product_name ? {
                id: ticket.product_id,
                name: ticket.product_name
            } : null,
            serial_number: ticket.serial_number,
            firmware_version: ticket.firmware_version,
            hardware_version: ticket.hardware_version,

            // Problem & Solution
            problem_description: ticket.problem_description,
            solution_for_customer: ticket.solution_for_customer,
            is_warranty: Boolean(ticket.is_warranty),

            // Repair Info
            repair_content: ticket.repair_content,
            problem_analysis: ticket.problem_analysis,

            // People
            reporter_name: ticket.reporter_name,
            customer: ticket.customer_id ? { id: ticket.customer_id, name: ticket.customer_name } : null,
            dealer: ticket.dealer_name ? { id: ticket.dealer_id, name: ticket.dealer_name } : null,
            submitted_by: ticket.submitter_name ? { id: ticket.submitted_by, name: ticket.submitter_name } : null,
            assigned_to: ticket.assigned_name ? { id: ticket.assigned_to, name: ticket.assigned_name } : null,

            // Related Inquiry Ticket
            inquiry_ticket: ticket.inquiry_ticket_number ? {
                id: ticket.inquiry_ticket_id,
                ticket_number: ticket.inquiry_ticket_number
            } : null,

            // Payment
            payment_channel: ticket.payment_channel,
            payment_amount: ticket.payment_amount,
            payment_date: ticket.payment_date,

            // Status & Dates
            status: ticket.status,
            repair_priority: ticket.repair_priority,
            feedback_date: ticket.feedback_date,
            received_date: ticket.received_date,
            completed_date: ticket.completed_date,

            // Approval
            approval_status: ticket.approval_status,

            // Timestamps
            created_at: ticket.created_at,
            updated_at: ticket.updated_at
        };
    }

    // ==============================
    // Routes
    // ==============================

    /**
     * GET /api/v1/rma-tickets/stats
     * Get dashboard statistics for RMA tickets
     */
    router.get('/stats', authenticate, (req, res) => {
        try {
            const user = req.user;
            let conditions = [];
            let params = [];

            // Role-based filtering
            if (user.user_type === 'Dealer') {
                conditions.push('dealer_id = ?');
                params.push(user.dealer_id);
            } else if (user.role === 'Member') {
                conditions.push('(assigned_to = ? OR submitted_by = ?)');
                params.push(user.id, user.id);
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            const stats = db.prepare(`
                SELECT status, COUNT(*) as count 
                FROM rma_tickets ${whereClause}
                GROUP BY status
            `).all(...params);

            const totalRow = db.prepare(`
                SELECT COUNT(*) as total FROM rma_tickets ${whereClause}
            `).get(...params);

            const result = {
                total: totalRow.total,
                by_status: {}
            };
            stats.forEach(s => { result.by_status[s.status] = s.count; });

            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Error getting RMA ticket stats:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * GET /api/v1/rma-tickets
     * List RMA tickets with filtering and pagination
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 20,
                sort_by = 'created_at',
                sort_order = 'desc',
                channel_code,
                status,
                issue_type,
                issue_category,
                severity,
                product_id,
                dealer_id,
                assigned_to,
                is_warranty,
                created_from,
                created_to,
                keyword,
                product_family
            } = req.query;

            const user = req.user;
            let conditions = [];
            let params = [];

            // Role-based filtering
            if (user.user_type === 'Dealer') {
                conditions.push('t.dealer_id = ?');
                params.push(user.dealer_id);
            } else if (user.role === 'Member') {
                conditions.push('(t.assigned_to = ? OR t.submitted_by = ?)');
                params.push(user.id, user.id);
            }

            // Filter conditions
            if (channel_code) {
                conditions.push('t.channel_code = ?');
                params.push(channel_code);
            }
            if (status) {
                const statuses = status.split(',');
                conditions.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }
            if (issue_type) {
                conditions.push('t.issue_type = ?');
                params.push(issue_type);
            }
            if (issue_category) {
                conditions.push('t.issue_category = ?');
                params.push(issue_category);
            }
            if (severity) {
                conditions.push('t.severity = ?');
                params.push(parseInt(severity));
            }
            if (product_id) {
                conditions.push('t.product_id = ?');
                params.push(product_id);
            }
            if (product_family) {
                conditions.push('t.product_family = ?');
                params.push(product_family);
            }
            if (dealer_id) {
                conditions.push('t.dealer_id = ?');
                params.push(dealer_id);
            }
            if (assigned_to === 'me') {
                conditions.push('t.assigned_to = ?');
                params.push(user.id);
            } else if (assigned_to) {
                conditions.push('t.assigned_to = ?');
                params.push(parseInt(assigned_to));
            }
            if (is_warranty !== undefined) {
                conditions.push('t.is_warranty = ?');
                params.push(is_warranty === 'true' ? 1 : 0);
            }
            if (created_from) {
                conditions.push('date(t.created_at) >= ?');
                params.push(created_from);
            }
            if (created_to) {
                conditions.push('date(t.created_at) <= ?');
                params.push(created_to);
            }
            if (keyword) {
                conditions.push(`(
                    t.ticket_number LIKE ? OR 
                    t.reporter_name LIKE ? OR 
                    t.problem_description LIKE ? OR
                    t.serial_number LIKE ?
                )`);
                const term = `%${keyword}%`;
                params.push(term, term, term, term);
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            // Validate sort
            const allowedSorts = ['created_at', 'updated_at', 'status', 'severity', 'ticket_number'];
            const safeSortBy = allowedSorts.includes(sort_by) ? sort_by : 'created_at';
            const safeSortOrder = sort_order === 'asc' ? 'ASC' : 'DESC';

            // Count
            const countResult = db.prepare(`
                SELECT COUNT(*) as total FROM rma_tickets t ${whereClause}
            `).get(...params);

            // Paginate
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const tickets = db.prepare(`
                SELECT 
                    t.*,
                    a.username as assigned_name,
                    p.model_name as product_name
                FROM rma_tickets t
                LEFT JOIN users a ON t.assigned_to = a.id
                LEFT JOIN products p ON t.product_id = p.id
                ${whereClause}
                ORDER BY t.${safeSortBy} ${safeSortOrder}
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

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
            console.error('Error listing RMA tickets:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * GET /api/v1/rma-tickets/:id
     * Get single RMA ticket detail
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const ticket = db.prepare(`
                SELECT 
                    t.*,
                    a.username as assigned_name,
                    s.username as submitter_name,
                    p.model_name as product_name,
                    d.customer_name as dealer_name,
                    inq.ticket_number as inquiry_ticket_number
                FROM rma_tickets t
                LEFT JOIN users a ON t.assigned_to = a.id
                LEFT JOIN users s ON t.submitted_by = s.id
                LEFT JOIN products p ON t.product_id = p.id
                LEFT JOIN customers d ON t.dealer_id = d.id
                LEFT JOIN inquiry_tickets inq ON t.inquiry_ticket_id = inq.id
                WHERE t.id = ?
            `).get(req.params.id);

            if (!ticket) {
                return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
            }

            // Get attachments
            const attachments = db.prepare(`
                SELECT id, file_name, file_path, file_size, file_type, uploaded_at
                FROM service_attachments
                WHERE ticket_type = 'RMA' AND ticket_id = ?
            `).all(req.params.id);

            const formatted = formatDetail(ticket);
            formatted.attachments = attachments;

            res.json({ success: true, data: formatted });
        } catch (error) {
            console.error('Error getting RMA ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * POST /api/v1/rma-tickets
     * Create new RMA ticket (single device)
     */
    router.post('/', authenticate, serviceUpload.array('attachments'), (req, res) => {
        try {
            const {
                channel_code = 'D',
                issue_type,
                issue_category,
                issue_subcategory,
                severity = 3,
                product_id,
                serial_number,
                firmware_version,
                problem_description,
                is_warranty = true,
                reporter_name,
                customer_id,
                dealer_id,
                inquiry_ticket_id
            } = req.body;

            if (!problem_description) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '问题描述不能为空' }
                });
            }

            const ticketNumber = generateTicketNumber(db, channel_code);

            const result = db.prepare(`
                INSERT INTO rma_tickets (
                    ticket_number, channel_code, issue_type, issue_category, issue_subcategory,
                    severity, product_id, serial_number, firmware_version, problem_description,
                    is_warranty, reporter_name, customer_id, dealer_id, submitted_by,
                    inquiry_ticket_id, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
            `).run(
                ticketNumber, channel_code, issue_type, issue_category, issue_subcategory,
                severity, product_id, serial_number, firmware_version, problem_description,
                is_warranty ? 1 : 0, reporter_name, customer_id, dealer_id, req.user.id,
                inquiry_ticket_id
            );

            const ticketId = result.lastInsertRowid;

            // Handle attachments
            if (req.files && req.files.length > 0) {
                const insertAttachment = db.prepare(`
                    INSERT INTO service_attachments (
                        ticket_type, ticket_id, file_name, file_path, 
                        file_size, file_type, uploaded_by
                    ) VALUES ('RMA', ?, ?, ?, ?, ?, ?)
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

            // Update inquiry ticket if linked
            if (inquiry_ticket_id) {
                db.prepare(`
                    UPDATE inquiry_tickets 
                    SET status = 'Upgraded', 
                        upgraded_to_type = 'rma',
                        upgraded_to_id = ?,
                        upgraded_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(result.lastInsertRowid, inquiry_ticket_id);
            }

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    ticket_number: ticketNumber,
                    status: 'Pending',
                    created_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error creating RMA ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * POST /api/v1/rma-tickets/batch
     * Create multiple RMA tickets (shopping cart mode)
     */
    router.post('/batch', authenticate, (req, res) => {
        try {
            const { channel_code = 'D', dealer_id, devices } = req.body;

            if (!devices || !Array.isArray(devices) || devices.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '至少需要一台设备' }
                });
            }

            const batchId = `batch_${Date.now()}`;
            const rmaTickets = [];

            for (const device of devices) {
                const ticketNumber = generateTicketNumber(db, channel_code);

                const result = db.prepare(`
                    INSERT INTO rma_tickets (
                        ticket_number, channel_code, product_id, serial_number,
                        problem_description, dealer_id, submitted_by, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')
                `).run(
                    ticketNumber, channel_code, device.product_id, device.serial_number,
                    device.problem_description, dealer_id, req.user.id
                );

                rmaTickets.push({
                    id: result.lastInsertRowid,
                    ticket_number: ticketNumber,
                    serial_number: device.serial_number,
                    product_name: device.product_name || 'Unknown'
                });
            }

            res.status(201).json({
                success: true,
                data: {
                    batch_id: batchId,
                    rma_tickets: rmaTickets,
                    packing_list: {
                        message: '提交成功！请打印以下清单放入箱内',
                        items: rmaTickets.map(t => ({ rma_number: t.ticket_number })),
                        download_pdf_url: `/api/v1/rma-tickets/batch/${batchId}/packing-list.pdf`
                    }
                }
            });
        } catch (error) {
            console.error('Error creating batch RMA tickets:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * PATCH /api/v1/rma-tickets/:id
     * Update RMA ticket
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const updates = [];
            const params = [];

            const allowedFields = [
                'status', 'solution_for_customer', 'repair_content', 'problem_analysis',
                'repair_priority', 'payment_channel', 'payment_amount', 'payment_date',
                'feedback_date', 'received_date', 'completed_date', 'assigned_to'
            ];

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(req.body[field]);
                }
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'No valid fields to update' }
                });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);

            db.prepare(`UPDATE rma_tickets SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            const updated = db.prepare('SELECT * FROM rma_tickets WHERE id = ?').get(id);
            res.json({ success: true, data: formatDetail(updated) });
        } catch (error) {
            console.error('Error updating RMA ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * POST /api/v1/rma-tickets/:id/assign
     * Assign RMA ticket to technician
     */
    router.post('/:id/assign', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { assigned_to, repair_priority, comment } = req.body;

            db.prepare(`
                UPDATE rma_tickets 
                SET assigned_to = ?, 
                    repair_priority = COALESCE(?, repair_priority),
                    status = CASE WHEN status = 'Pending' THEN 'Assigned' ELSE status END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(assigned_to, repair_priority, id);

            const updated = db.prepare('SELECT * FROM rma_tickets WHERE id = ?').get(id);
            res.json({ success: true, data: formatDetail(updated) });
        } catch (error) {
            console.error('Error assigning RMA ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * POST /api/v1/rma-tickets/:id/approve
     * Approve or reject dealer-submitted RMA (v2.0)
     */
    router.post('/:id/approve', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { action, comment } = req.body;

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: { message: 'Action must be approve or reject' }
                });
            }

            db.prepare(`
                UPDATE rma_tickets 
                SET approval_status = ?,
                    approved_by = ?,
                    approved_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(action === 'approve' ? 'approved' : 'rejected', req.user.id, id);

            const updated = db.prepare('SELECT * FROM rma_tickets WHERE id = ?').get(id);
            res.json({ success: true, data: formatDetail(updated) });
        } catch (error) {
            console.error('Error approving RMA ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * DELETE /api/v1/rma-tickets/:id
     * Delete RMA ticket (admin only)
     */
    router.delete('/:id', authenticate, (req, res) => {
        try {
            if (req.user.role !== 'Admin') {
                return res.status(403).json({ success: false, error: { message: 'Permission denied' } });
            }

            const result = db.prepare('DELETE FROM rma_tickets WHERE id = ?').run(req.params.id);

            if (result.changes === 0) {
                return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
            }

            res.json({ success: true, data: { deleted: true } });
        } catch (error) {
            console.error('Error deleting RMA ticket:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    return router;
};
