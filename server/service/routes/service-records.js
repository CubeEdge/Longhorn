/**
 * Service Records Routes
 * Lightweight service tracking system (Phase 1)
 */

const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/service-records
     * List service records with filtering and pagination
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
                keyword
            } = req.query;

            const user = req.user;
            let conditions = [];
            let params = [];

            // Role-based filtering
            if (user.user_type === 'Dealer') {
                conditions.push('sr.dealer_id = ?');
                params.push(user.dealer_id);
            } else if (user.user_type === 'Customer') {
                conditions.push('sr.customer_id = ?');
                params.push(user.id);
            } else if (user.role === 'Member') {
                conditions.push('(sr.handler_id = ? OR sr.created_by = ?)');
                params.push(user.id, user.id);
            }

            // Filter conditions
            if (status) {
                const statuses = status.split(',');
                conditions.push(`sr.status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }
            if (service_type) {
                conditions.push('sr.service_type = ?');
                params.push(service_type);
            }
            if (channel) {
                conditions.push('sr.channel = ?');
                params.push(channel);
            }
            if (dealer_id) {
                conditions.push('sr.dealer_id = ?');
                params.push(dealer_id);
            }
            if (handler_id === 'me') {
                conditions.push('sr.handler_id = ?');
                params.push(user.id);
            } else if (handler_id) {
                conditions.push('sr.handler_id = ?');
                params.push(parseInt(handler_id));
            }
            if (customer_id) {
                conditions.push('sr.customer_id = ?');
                params.push(customer_id);
            }
            if (serial_number) {
                conditions.push('sr.serial_number LIKE ?');
                params.push(`%${serial_number}%`);
            }
            if (created_from) {
                conditions.push('date(sr.created_at) >= ?');
                params.push(created_from);
            }
            if (created_to) {
                conditions.push('date(sr.created_at) <= ?');
                params.push(created_to);
            }
            if (keyword) {
                conditions.push(`(
                    sr.record_number LIKE ? OR 
                    sr.customer_name LIKE ? OR 
                    sr.problem_summary LIKE ? OR
                    sr.serial_number LIKE ?
                )`);
                const term = `%${keyword}%`;
                params.push(term, term, term, term);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Validate sort field
            const validSortFields = ['created_at', 'updated_at', 'status', 'record_number'];
            const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
            const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

            // Count total
            const countSql = `SELECT COUNT(*) as total FROM service_records sr ${whereClause}`;
            const total = db.prepare(countSql).get(...params).total;

            // Get records
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const sql = `
                SELECT 
                    sr.*,
                    d.name as dealer_name,
                    h.username as handler_name,
                    c.username as created_by_name
                FROM service_records sr
                LEFT JOIN dealers d ON sr.dealer_id = d.id
                LEFT JOIN users h ON sr.handler_id = h.id
                LEFT JOIN users c ON sr.created_by = c.id
                ${whereClause}
                ORDER BY sr.${sortField} ${sortDir}
                LIMIT ? OFFSET ?
            `;

            const records = db.prepare(sql).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: records.map(formatServiceRecordListItem),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[ServiceRecords] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/service-records
     * Create new service record
     */
    router.post('/', authenticate, (req, res) => {
        try {
            const {
                service_mode = 'CustomerService',
                customer_name,
                customer_contact,
                customer_id,
                dealer_id,
                product_id,
                product_name,
                serial_number,
                firmware_version,
                hardware_version,
                service_type = 'Consultation',
                channel = 'Phone',
                problem_summary,
                problem_category,
                handler_id,
                department
            } = req.body;

            // Validation
            if (!problem_summary) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: '缺少必填字段: problem_summary'
                    }
                });
            }

            // Generate record number: SR-YYYYMMDD-XXX
            const record_number = generateServiceRecordNumber(db);

            const result = db.prepare(`
                INSERT INTO service_records (
                    record_number, service_mode,
                    customer_name, customer_contact, customer_id, dealer_id,
                    product_id, product_name, serial_number, firmware_version, hardware_version,
                    service_type, channel, problem_summary, problem_category,
                    handler_id, department,
                    status, created_by
                ) VALUES (
                    ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?,
                    'Created', ?
                )
            `).run(
                record_number, service_mode,
                customer_name || null, customer_contact || null, customer_id || null, dealer_id || null,
                product_id || null, product_name || null, serial_number || null, firmware_version || null, hardware_version || null,
                service_type, channel, problem_summary, problem_category || null,
                handler_id || req.user.id, department || null,
                req.user.id
            );

            // Log status creation
            db.prepare(`
                INSERT INTO service_record_status_history (service_record_id, from_status, to_status, changed_by)
                VALUES (?, NULL, 'Created', ?)
            `).run(result.lastInsertRowid, req.user.id);

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    record_number,
                    status: 'Created',
                    created_at: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error('[ServiceRecords] Create error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/service-records/:id
     * Get service record detail
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const record = db.prepare(`
                SELECT 
                    sr.*,
                    d.name as dealer_name, d.code as dealer_code,
                    h.username as handler_name,
                    c.username as created_by_name
                FROM service_records sr
                LEFT JOIN dealers d ON sr.dealer_id = d.id
                LEFT JOIN users h ON sr.handler_id = h.id
                LEFT JOIN users c ON sr.created_by = c.id
                WHERE sr.id = ?
            `).get(req.params.id);

            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '服务记录不存在' }
                });
            }

            // Permission check
            const access = canAccessServiceRecord(req.user, record);
            if (!access.read) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看此服务记录' }
                });
            }

            // Get comments
            const comments = db.prepare(`
                SELECT src.*, u.username as author_name
                FROM service_record_comments src
                LEFT JOIN users u ON src.created_by = u.id
                WHERE src.service_record_id = ?
                ORDER BY src.created_at ASC
            `).all(req.params.id);

            // Get status history
            const statusHistory = db.prepare(`
                SELECT srh.*, u.username as changed_by_name
                FROM service_record_status_history srh
                LEFT JOIN users u ON srh.changed_by = u.id
                WHERE srh.service_record_id = ?
                ORDER BY srh.created_at ASC
            `).all(req.params.id);

            // Get linked issue if upgraded
            let linkedIssue = null;
            if (record.upgraded_to_issue_id) {
                linkedIssue = db.prepare(`
                    SELECT id, issue_number, rma_number, status, title
                    FROM issues WHERE id = ?
                `).get(record.upgraded_to_issue_id);
            }

            res.json({
                success: true,
                data: {
                    ...formatServiceRecordDetail(record),
                    comments: comments.map(formatComment),
                    status_history: statusHistory.map(h => ({
                        from_status: h.from_status,
                        to_status: h.to_status,
                        reason: h.reason,
                        changed_by: h.changed_by_name,
                        created_at: h.created_at
                    })),
                    linked_issue: linkedIssue,
                    permissions: {
                        can_edit: access.write,
                        can_upgrade: access.upgrade
                    }
                }
            });
        } catch (err) {
            console.error('[ServiceRecords] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/service-records/:id
     * Update service record
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const record = db.prepare('SELECT * FROM service_records WHERE id = ?').get(req.params.id);
            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '服务记录不存在' }
                });
            }

            const access = canAccessServiceRecord(req.user, record);
            if (!access.write) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权编辑此服务记录' }
                });
            }

            const allowedFields = [
                'customer_name', 'customer_contact',
                'product_name', 'serial_number', 'firmware_version', 'hardware_version',
                'service_type', 'channel', 'problem_summary', 'problem_category',
                'resolution', 'resolution_type',
                'handler_id', 'department'
            ];

            const updates = [];
            const params = [];

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(req.body[field]);
                }
            }

            // Handle status changes
            if (req.body.status && req.body.status !== record.status) {
                const newStatus = req.body.status;
                updates.push('status = ?');
                params.push(newStatus);

                // Update timestamps based on status
                if (newStatus === 'InProgress' && !record.first_response_at) {
                    updates.push('first_response_at = CURRENT_TIMESTAMP');
                }
                if (newStatus === 'Resolved' || newStatus === 'AutoClosed') {
                    updates.push('resolved_at = CURRENT_TIMESTAMP');
                }
                if (newStatus === 'WaitingCustomer') {
                    updates.push('waiting_customer_since = CURRENT_TIMESTAMP');
                }

                // Log status change
                db.prepare(`
                    INSERT INTO service_record_status_history 
                    (service_record_id, from_status, to_status, changed_by, reason)
                    VALUES (?, ?, ?, ?, ?)
                `).run(req.params.id, record.status, newStatus, req.user.id, req.body.status_reason || null);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_CHANGES', message: '没有需要更新的字段' }
                });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(req.params.id);

            db.prepare(`UPDATE service_records SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), updated_at: new Date().toISOString() }
            });
        } catch (err) {
            console.error('[ServiceRecords] Update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/service-records/:id/comments
     * Add comment to service record
     */
    router.post('/:id/comments', authenticate, (req, res) => {
        try {
            const record = db.prepare('SELECT * FROM service_records WHERE id = ?').get(req.params.id);
            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '服务记录不存在' }
                });
            }

            const access = canAccessServiceRecord(req.user, record);
            if (!access.read) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权评论此服务记录' }
                });
            }

            const { content, comment_type = 'Staff', is_internal = false, attachments = [] } = req.body;
            if (!content) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '评论内容不能为空' }
                });
            }

            const result = db.prepare(`
                INSERT INTO service_record_comments 
                (service_record_id, comment_type, content, is_internal, attachments, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                req.params.id,
                comment_type,
                content,
                is_internal ? 1 : 0,
                JSON.stringify(attachments),
                req.user.id
            );

            // Update record timestamp
            db.prepare('UPDATE service_records SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

            // Update first_response_at if this is the first staff response
            if (comment_type === 'Staff' && !record.first_response_at) {
                db.prepare('UPDATE service_records SET first_response_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
            }

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    content,
                    comment_type,
                    is_internal,
                    author_name: req.user.username,
                    created_at: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error('[ServiceRecords] Comment error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/service-records/:id/upgrade
     * Upgrade service record to work order (Issue)
     */
    router.post('/:id/upgrade', authenticate, (req, res) => {
        try {
            const record = db.prepare('SELECT * FROM service_records WHERE id = ?').get(req.params.id);
            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '服务记录不存在' }
                });
            }

            if (record.status === 'UpgradedToTicket') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'ALREADY_UPGRADED', message: '该服务记录已转为工单' }
                });
            }

            const access = canAccessServiceRecord(req.user, record);
            if (!access.upgrade) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权将此服务记录升级为工单' }
                });
            }

            const {
                ticket_type = 'IS', // LR (Local Repair) or IS (Internal Service)
                issue_category,
                severity = 3,
                upgrade_reason,
                rma_number
            } = req.body;

            // Generate issue number based on ticket type
            const issue_number = generateIssueNumber(db, ticket_type);

            // Create the issue
            const issueResult = db.prepare(`
                INSERT INTO issues (
                    issue_number, rma_number, ticket_type,
                    issue_type, issue_category, severity,
                    product_id, serial_number, firmware_version, hardware_version,
                    title, description, problem_description,
                    reporter_name, customer_id, dealer_id, region,
                    source_service_record_id,
                    status, created_by
                ) VALUES (
                    ?, ?, ?,
                    'CustomerReturn', ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, '国内',
                    ?,
                    'Pending', ?
                )
            `).run(
                issue_number, rma_number || null, ticket_type,
                issue_category || null, severity,
                record.product_id, record.serial_number, record.firmware_version, record.hardware_version,
                record.problem_summary.substring(0, 100), record.problem_summary, record.problem_summary,
                record.customer_name, record.customer_id, record.dealer_id,
                record.id,
                req.user.id
            );

            // Update service record status
            db.prepare(`
                UPDATE service_records 
                SET status = 'UpgradedToTicket', 
                    upgraded_to_issue_id = ?,
                    upgrade_reason = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(issueResult.lastInsertRowid, upgrade_reason || null, req.params.id);

            // Log status change
            db.prepare(`
                INSERT INTO service_record_status_history 
                (service_record_id, from_status, to_status, changed_by, reason)
                VALUES (?, ?, 'UpgradedToTicket', ?, ?)
            `).run(req.params.id, record.status, req.user.id, upgrade_reason || '升级为工单');

            res.status(201).json({
                success: true,
                data: {
                    service_record_id: parseInt(req.params.id),
                    issue_id: issueResult.lastInsertRowid,
                    issue_number,
                    ticket_type
                }
            });
        } catch (err) {
            console.error('[ServiceRecords] Upgrade error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * DELETE /api/v1/service-records/:id
     * Delete service record (Admin only, or if still in Created status)
     */
    router.delete('/:id', authenticate, (req, res) => {
        try {
            const record = db.prepare('SELECT * FROM service_records WHERE id = ?').get(req.params.id);
            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '服务记录不存在' }
                });
            }

            // Only Admin can delete, or creator can delete if still Created
            const canDelete = req.user.role === 'Admin' ||
                (record.created_by === req.user.id && record.status === 'Created');

            if (!canDelete) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权删除此服务记录' }
                });
            }

            db.prepare('DELETE FROM service_records WHERE id = ?').run(req.params.id);

            res.json({ success: true });
        } catch (err) {
            console.error('[ServiceRecords] Delete error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // Helper functions
    function generateServiceRecordNumber(db) {
        const today = new Date();
        const year = today.getFullYear().toString();
        // Use 'YEAR' as date_key for annual sequence
        const dateKey = year;

        const existing = db.prepare(`
            SELECT last_sequence FROM service_record_sequences WHERE date_key = ?
        `).get(dateKey);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare('UPDATE service_record_sequences SET last_sequence = ? WHERE date_key = ?')
                .run(seq, dateKey);
        } else {
            seq = 1;
            db.prepare('INSERT INTO service_record_sequences (date_key, last_sequence) VALUES (?, ?)')
                .run(dateKey, seq);
        }

        return `SR-${year}-${String(seq).padStart(4, '0')}`;
    }

    function generateIssueNumber(db, ticketType = 'IS') {
        const today = new Date();
        const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');

        const existing = db.prepare(`
            SELECT last_sequence FROM issue_sequences WHERE ticket_type = ? AND date_key = ?
        `).get(ticketType, dateKey);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare('UPDATE issue_sequences SET last_sequence = ? WHERE ticket_type = ? AND date_key = ?')
                .run(seq, ticketType, dateKey);
        } else {
            seq = 1;
            db.prepare('INSERT INTO issue_sequences (ticket_type, date_key, last_sequence) VALUES (?, ?, ?)')
                .run(ticketType, dateKey, seq);
        }

        return `${ticketType}-${dateKey}-${String(seq).padStart(3, '0')}`;
    }

    function canAccessServiceRecord(user, record) {
        if (user.role === 'Admin' || user.role === 'Lead') {
            return { read: true, write: true, upgrade: true };
        }

        if (user.user_type === 'Dealer') {
            const canAccess = record.dealer_id === user.dealer_id;
            return { read: canAccess, write: canAccess, upgrade: canAccess };
        }

        if (user.user_type === 'Customer') {
            const canAccess = record.customer_id === user.id;
            return { read: canAccess, write: false, upgrade: false };
        }

        // Member
        const canAccess = record.handler_id === user.id || record.created_by === user.id;
        return { read: canAccess, write: canAccess, upgrade: canAccess };
    }

    function formatServiceRecordListItem(record) {
        return {
            id: record.id,
            record_number: record.record_number,
            service_mode: record.service_mode,
            customer_name: record.customer_name,
            customer_contact: record.customer_contact,
            product_name: record.product_name,
            serial_number: record.serial_number,
            service_type: record.service_type,
            channel: record.channel,
            problem_summary: record.problem_summary?.substring(0, 100),
            status: record.status,
            dealer: record.dealer_id ? { id: record.dealer_id, name: record.dealer_name } : null,
            handler: record.handler_id ? { id: record.handler_id, name: record.handler_name } : null,
            created_by: { name: record.created_by_name },
            created_at: record.created_at,
            updated_at: record.updated_at
        };
    }

    function formatServiceRecordDetail(record) {
        let communicationLog = [];
        try {
            communicationLog = JSON.parse(record.communication_log || '[]');
        } catch (e) {
            communicationLog = [];
        }

        return {
            id: record.id,
            record_number: record.record_number,
            service_mode: record.service_mode,

            customer_name: record.customer_name,
            customer_contact: record.customer_contact,
            customer_id: record.customer_id,

            product_id: record.product_id,
            product_name: record.product_name,
            serial_number: record.serial_number,
            firmware_version: record.firmware_version,
            hardware_version: record.hardware_version,

            service_type: record.service_type,
            channel: record.channel,
            problem_summary: record.problem_summary,
            problem_category: record.problem_category,
            communication_log: communicationLog,

            status: record.status,
            resolution: record.resolution,
            resolution_type: record.resolution_type,

            dealer: record.dealer_id ? {
                id: record.dealer_id,
                name: record.dealer_name,
                code: record.dealer_code
            } : null,

            handler: record.handler_id ? {
                id: record.handler_id,
                name: record.handler_name
            } : null,
            department: record.department,

            upgraded_to_issue_id: record.upgraded_to_issue_id,
            upgrade_reason: record.upgrade_reason,

            first_response_at: record.first_response_at,
            resolved_at: record.resolved_at,
            waiting_customer_since: record.waiting_customer_since,

            created_by: { id: record.created_by, name: record.created_by_name },
            created_at: record.created_at,
            updated_at: record.updated_at
        };
    }

    function formatComment(comment) {
        let attachments = [];
        try {
            attachments = JSON.parse(comment.attachments || '[]');
        } catch (e) {
            attachments = [];
        }

        return {
            id: comment.id,
            content: comment.content,
            comment_type: comment.comment_type,
            is_internal: !!comment.is_internal,
            attachments,
            author: { id: comment.created_by, name: comment.author_name },
            created_at: comment.created_at
        };
    }

    return router;
};
