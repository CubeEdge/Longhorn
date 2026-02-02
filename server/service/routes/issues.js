/**
 * Issues Routes
 * Full CRUD with PRD-compliant fields and features
 */

const express = require('express');
const path = require('path');
const fs = require('fs-extra');

module.exports = function (db, authenticate, attachmentsDir, multerModule) {
    const router = express.Router();

    // Setup multer for file uploads
    const multer = multerModule || require('multer');
    const upload = multer({
        dest: attachmentsDir,
        limits: {
            fileSize: 50 * 1024 * 1024, // 50MB max (confirmed 2026-01-30)
            files: 10
        },
        fileFilter: (req, file, cb) => {
            const allowedTypes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
                'video/mp4', 'video/quicktime', 'video/x-msvideo'
            ];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('不支持的文件类型'), false);
            }
        }
    });

    /**
     * GET /api/v1/issues
     * List issues with filtering and pagination
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 20,
                sort_by = 'created_at',
                sort_order = 'desc',
                status,
                issue_type,
                ticket_type, // Phase 1: LR (Local Repair) / IS (Internal Service)
                issue_category,
                severity,
                product_id,
                dealer_id,
                region,
                assigned_to,
                is_warranty,
                service_priority,
                repair_priority,
                created_from,
                created_to,
                keyword
            } = req.query;

            const user = req.user;
            let conditions = [];
            let params = [];

            // Role-based filtering
            if (user.user_type === 'Dealer') {
                conditions.push('i.dealer_id = ?');
                params.push(user.dealer_id);
            } else if (user.user_type === 'Customer') {
                conditions.push('(i.customer_id = ? OR i.created_by = ?)');
                params.push(user.id, user.id);
            } else if (user.role === 'Member') {
                conditions.push('(i.assigned_to = ? OR i.created_by = ?)');
                params.push(user.id, user.id);
            }

            // Filter conditions
            if (status) {
                const statuses = status.split(',');
                conditions.push(`i.status IN (${statuses.map(() => '?').join(',')})`);
                params.push(...statuses);
            }
            if (issue_type) {
                conditions.push('i.issue_type = ?');
                params.push(issue_type);
            }
            if (ticket_type) {
                conditions.push('i.ticket_type = ?');
                params.push(ticket_type);
            }
            if (issue_category) {
                conditions.push('i.issue_category = ?');
                params.push(issue_category);
            }
            if (severity) {
                conditions.push('i.severity = ?');
                params.push(severity);
            }
            if (product_id) {
                conditions.push('i.product_id = ?');
                params.push(product_id);
            }
            if (dealer_id) {
                conditions.push('i.dealer_id = ?');
                params.push(dealer_id);
            }
            if (region) {
                conditions.push('i.region = ?');
                params.push(region);
            }
            if (assigned_to === 'me') {
                conditions.push('i.assigned_to = ?');
                params.push(user.id);
            } else if (assigned_to) {
                conditions.push('i.assigned_to = ?');
                params.push(parseInt(assigned_to));
            }
            if (is_warranty !== undefined) {
                conditions.push('i.is_warranty = ?');
                params.push(is_warranty === 'true' || is_warranty === '1' ? 1 : 0);
            }
            if (created_from) {
                conditions.push('date(i.created_at) >= ?');
                params.push(created_from);
            }
            if (created_to) {
                conditions.push('date(i.created_at) <= ?');
                params.push(created_to);
            }
            if (keyword) {
                conditions.push(`(
                    i.issue_number LIKE ? OR 
                    i.rma_number LIKE ? OR 
                    i.title LIKE ? OR 
                    i.problem_description LIKE ? OR
                    i.serial_number LIKE ? OR
                    c.customer_name LIKE ?
                )`);
                const term = `%${keyword}%`;
                params.push(term, term, term, term, term, term);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Validate sort field
            const validSortFields = ['created_at', 'updated_at', 'severity', 'status', 'issue_number'];
            const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
            const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

            // Count total
            const countSql = `
                SELECT COUNT(*) as total FROM issues i
                LEFT JOIN customers c ON i.customer_id = c.id
                ${whereClause}
            `;
            const total = db.prepare(countSql).get(...params).total;

            // Get issues
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const sql = `
                SELECT 
                    i.id, i.issue_number, i.rma_number, i.ticket_type,
                    i.issue_type, i.issue_category, i.issue_subcategory,
                    i.severity, i.status, i.service_priority, i.repair_priority,
                    i.title, i.problem_description,
                    i.serial_number, i.firmware_version,
                    i.reporter_name, i.reporter_type, i.region,
                    i.is_warranty,
                    i.created_at, i.updated_at,
                    p.id as product_id, p.model_name as product_name,
                    c.id as customer_id, c.customer_name,
                    d.id as dealer_id, d.name as dealer_name,
                    creator.username as created_by_name,
                    assignee.username as assigned_to_name
                FROM issues i
                LEFT JOIN products p ON i.product_id = p.id
                LEFT JOIN customers c ON i.customer_id = c.id
                LEFT JOIN dealers d ON i.dealer_id = d.id
                LEFT JOIN users creator ON i.created_by = creator.id
                LEFT JOIN users assignee ON i.assigned_to = assignee.id
                ${whereClause}
                ORDER BY i.${sortField} ${sortDir}
                LIMIT ? OFFSET ?
            `;

            const issues = db.prepare(sql).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: issues.map(formatIssueListItem),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Issues] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/issues
     * Create new issue
     */
    router.post('/', authenticate, (req, res) => {
        try {
            const {
                // Classification
                issue_type = 'CustomerReturn',
                ticket_type = 'IS', // Phase 1: LR (Local Repair) / IS (Internal Service)
                issue_category,
                issue_subcategory,
                severity = 3,
                service_priority = 'Normal',
                repair_priority = 'Normal',

                // Product info
                product_id,
                serial_number,
                firmware_version,

                // Problem description
                title,
                problem_description,
                solution_for_customer,
                is_warranty = true,

                // Reporter info
                reporter_name,
                reporter_type = 'Customer',
                customer_id,
                dealer_id,
                region = '国内',

                // Optional
                rma_number,
                external_link,
                feedback_date,
                source_service_record_id,
                preferred_contact_method = 'Email'
            } = req.body;

            // Validation
            if (!issue_category || !problem_description) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: '缺少必填字段: issue_category, problem_description'
                    }
                });
            }

            // Generate issue number based on ticket type
            const issue_number = generateIssueNumber(db, ticket_type);

            const result = db.prepare(`
                INSERT INTO issues(
                issue_number, rma_number, ticket_type,
                issue_type, issue_category, issue_subcategory, severity,
                service_priority, repair_priority,
                product_id, serial_number, firmware_version,
                title, description, solution_for_customer, is_warranty,
                reporter_name, reporter_type, customer_id, dealer_id, region,
                external_link, feedback_date, source_service_record_id,
                preferred_contact_method,
                status, created_by
            ) VALUES(
                    ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?,
                'Pending', ?
            )
                `).run(
                issue_number, rma_number || null, ticket_type,
                issue_type, issue_category, issue_subcategory || null, severity,
                service_priority, repair_priority,
                product_id || null, serial_number || null, firmware_version || null,
                title || problem_description.substring(0, 100), problem_description, solution_for_customer || null, is_warranty ? 1 : 0,
                reporter_name || null, reporter_type, customer_id || null, dealer_id || null, region,
                external_link || null, feedback_date || null, source_service_record_id || null,
                preferred_contact_method,
                req.user.id
            );

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    issue_number,
                    ticket_type,
                    status: 'Pending',
                    created_at: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error('[Issues] Create error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/issues/:id
     * Get issue detail
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const issue = db.prepare(`
            SELECT
            i.*,
                p.product_line, p.model_name as product_name,
                c.customer_type, c.customer_name, c.contact_person, c.phone, c.email,
                c.country, c.province, c.city, c.company_name,
                d.name as dealer_name, d.code as dealer_code,
                creator.username as created_by_name,
                assignee.username as assigned_to_name,
                closer.username as closed_by_name
                FROM issues i
                LEFT JOIN products p ON i.product_id = p.id
                LEFT JOIN customers c ON i.customer_id = c.id
                LEFT JOIN dealers d ON i.dealer_id = d.id
                LEFT JOIN users creator ON i.created_by = creator.id
                LEFT JOIN users assignee ON i.assigned_to = assignee.id
                LEFT JOIN users closer ON i.closed_by = closer.id
                WHERE i.id = ?
                `).get(req.params.id);

            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '工单不存在' }
                });
            }

            // Permission check
            const access = canAccessIssue(req.user, issue);
            if (!access.read) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看此工单' }
                });
            }

            // Get comments
            const comments = db.prepare(`
                SELECT ic.*, u.username as author_name
                FROM issue_comments ic
                LEFT JOIN users u ON ic.user_id = u.id
                WHERE ic.issue_id = ?
                ORDER BY ic.created_at ASC
                    `).all(req.params.id);

            // Get attachments
            const attachments = db.prepare(`
                SELECT ia.*, u.username as uploaded_by_name
                FROM issue_attachments ia
                LEFT JOIN users u ON ia.uploaded_by = u.id
                WHERE ia.issue_id = ?
                ORDER BY ia.uploaded_at DESC
            `).all(req.params.id);

            res.json({
                success: true,
                data: {
                    ...formatIssueDetail(issue),
                    comments: comments.map(formatComment),
                    attachments: attachments.map(formatAttachment),
                    permissions: {
                        can_edit: access.write,
                        can_assign: access.assign,
                        can_close: access.close
                    }
                }
            });
        } catch (err) {
            console.error('[Issues] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/issues/:id
     * Update issue
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '工单不存在' }
                });
            }

            const access = canAccessIssue(req.user, issue);
            if (!access.write) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权编辑此工单' }
                });
            }

            const allowedFields = [
                'issue_type', 'issue_category', 'issue_subcategory', 'severity',
                'title', 'problem_description', 'solution_for_customer', 'is_warranty',
                'repair_content', 'problem_analysis',
                'serial_number', 'firmware_version', 'hardware_version',
                'payment_channel', 'payment_amount', 'payment_date',
                'status', 'resolution',
                'external_link'
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
            if (req.body.status && req.body.status !== issue.status) {
                const newStatus = req.body.status;

                if (newStatus === 'Closed') {
                    updates.push('closed_at = CURRENT_TIMESTAMP', 'closed_by = ?');
                    params.push(req.user.id);
                }
                if (newStatus === 'AwaitingVerification' && !issue.resolved_at) {
                    updates.push('resolved_at = CURRENT_TIMESTAMP');
                }
                if (newStatus === 'InProgress' && !issue.completed_date) {
                    updates.push('completed_date = CURRENT_TIMESTAMP');
                }

                // Log status change
                db.prepare(`
                    INSERT INTO issue_comments(issue_id, user_id, comment_type, content)
            VALUES(?, ?, 'StatusChange', ?)
                `).run(req.params.id, req.user.id, `状态变更: ${issue.status} → ${newStatus} `);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_CHANGES', message: '没有需要更新的字段' }
                });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(req.params.id);

            db.prepare(`UPDATE issues SET ${updates.join(', ')} WHERE id = ? `).run(...params);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), updated_at: new Date().toISOString() }
            });
        } catch (err) {
            console.error('[Issues] Update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/issues/:id/assign
     * Assign issue to user
     */
    router.post('/:id/assign', authenticate, (req, res) => {
        try {
            if (req.user.role === 'Member') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有Admin或Lead可以分配工单' }
                });
            }

            const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '工单不存在' }
                });
            }

            const { assigned_to, comment } = req.body;
            const assignee = db.prepare('SELECT id, username FROM users WHERE id = ?').get(assigned_to);
            if (!assignee) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_ASSIGNEE', message: '无效的处理人' }
                });
            }

            const newStatus = issue.status === 'Pending' ? 'Assigned' : issue.status;

            db.prepare(`
                UPDATE issues 
                SET assigned_to = ?, assigned_at = CURRENT_TIMESTAMP, status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `).run(assigned_to, newStatus, req.params.id);

            // Log assignment
            db.prepare(`
                INSERT INTO issue_comments(issue_id, user_id, comment_type, content)
            VALUES(?, ?, 'Assignment', ?)
            `).run(req.params.id, req.user.id, `分配给 ${assignee.username}${comment ? ': ' + comment : ''} `);

            res.json({
                success: true,
                data: {
                    assigned_to: assignee.id,
                    assigned_to_name: assignee.username,
                    status: newStatus
                }
            });
        } catch (err) {
            console.error('[Issues] Assign error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/issues/:id/rma
     * Generate RMA number for issue
     */
    router.post('/:id/rma', authenticate, (req, res) => {
        try {
            const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '工单不存在' }
                });
            }

            if (issue.rma_number) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'RMA_EXISTS', message: '该工单已有RMA号' }
                });
            }

            const { product_code = '09', channel_code = '01' } = req.body;
            const rma_number = generateRmaNumber(db, product_code, channel_code);

            db.prepare('UPDATE issues SET rma_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(rma_number, req.params.id);

            res.json({
                success: true,
                data: { rma_number }
            });
        } catch (err) {
            console.error('[Issues] RMA error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/issues/:id/comments
     * Add comment to issue
     */
    router.post('/:id/comments', authenticate, (req, res) => {
        try {
            const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '工单不存在' }
                });
            }

            const access = canAccessIssue(req.user, issue);
            if (!access.read) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权评论此工单' }
                });
            }

            const { content, comment_type = 'Comment', is_internal = false } = req.body;
            if (!content) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '评论内容不能为空' }
                });
            }

            const result = db.prepare(`
                INSERT INTO issue_comments(issue_id, user_id, comment_type, content, is_internal)
            VALUES(?, ?, ?, ?, ?)
                `).run(req.params.id, req.user.id, comment_type, content, is_internal ? 1 : 0);

            db.prepare('UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

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
            console.error('[Issues] Comment error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/issues/:id/attachments
     * Upload attachments to issue
     */
    router.post('/:id/attachments', authenticate, upload.array('files', 10), async (req, res) => {
        try {
            const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '工单不存在' }
                });
            }

            const access = canAccessIssue(req.user, issue);
            if (!access.write) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权上传附件' }
                });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_FILES', message: '没有上传文件' }
                });
            }

            const attachments = [];
            for (const file of req.files) {
                const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';

                const result = db.prepare(`
                    INSERT INTO issue_attachments(issue_id, file_name, file_path, file_size, file_type, uploaded_by)
            VALUES(?, ?, ?, ?, ?, ?)
                `).run(req.params.id, file.originalname, file.filename, file.size, fileType, req.user.id);

                attachments.push({
                    id: result.lastInsertRowid,
                    file_name: file.originalname,
                    file_size: file.size,
                    file_type: fileType,
                    file_url: `/ api / v1 / attachments / ${result.lastInsertRowid}/download`
                });
            }

            res.status(201).json({
                success: true,
                data: attachments
            });
        } catch (err) {
            console.error('[Issues] Upload error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * DELETE /api/v1/issues/:id
     * Delete issue (Admin only)
     */
    router.delete('/:id', authenticate, (req, res) => {
        try {
            if (req.user.role !== 'Admin') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有Admin可以删除工单' }
                });
            }

            const result = db.prepare('DELETE FROM issues WHERE id = ?').run(req.params.id);
            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '工单不存在' }
                });
            }

            res.json({ success: true });
        } catch (err) {
            console.error('[Issues] Delete error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // Helper functions
    /**
     * Generate Issue Number based on ticket type
     * Format: {TYPE}-YYYYMMDD-XXX
     * LR = Local Repair (本地工单)
     * IS = Internal Service (返修工单)
     */
    function generateIssueNumber(db, ticketType = 'IS') {
        const today = new Date();
        const year = today.getFullYear().toString();
        // Use 'YEAR' as date_key for annual sequence
        const dateKey = year;

        // Try to use issue_sequences table first (Phase 1)
        try {
            const existing = db.prepare(`
                SELECT last_sequence FROM issue_sequences 
                WHERE ticket_type = ? AND date_key = ?
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
            return `${ticketType}-${year}-${String(seq).padStart(4, '0')}`;
        } catch (err) {
            // Fallback
            const result = db.prepare(`
                SELECT COUNT(*) as count FROM issues 
                WHERE issue_number LIKE '${ticketType}-${year}-%'
            `).get();
            const seq = (result.count || 0) + 1;
            return `${ticketType}-${year}-${String(seq).padStart(4, '0')}`;
        }
    }

    function generateRmaNumber(db, productCode, channelCode) {
        const year = new Date().getFullYear() % 100;

        const existing = db.prepare(`
            SELECT last_sequence FROM rma_sequences 
            WHERE product_code = ? AND channel_code = ? AND year = ?
        `).get(productCode, channelCode, year);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare(`
                UPDATE rma_sequences SET last_sequence = ? 
                WHERE product_code = ? AND channel_code = ? AND year = ?
            `).run(seq, productCode, channelCode, year);
        } else {
            seq = 1;
            db.prepare(`
                INSERT INTO rma_sequences (product_code, channel_code, year, last_sequence)
                VALUES (?, ?, ?, ?)
            `).run(productCode, channelCode, year, seq);
        }

        return `RA${productCode}${channelCode}${String(year).padStart(2, '0')}${String(seq).padStart(3, '0')}`;
    }

    function canAccessIssue(user, issue) {
        if (user.role === 'Admin') {
            return { read: true, write: true, assign: true, close: true };
        }

        if (user.user_type === 'Dealer') {
            const canAccess = issue.dealer_id === user.dealer_id;
            return { read: canAccess, write: canAccess, assign: false, close: false };
        }

        if (user.user_type === 'Customer') {
            const canAccess = issue.customer_id === user.id || issue.created_by === user.id;
            return { read: canAccess, write: false, assign: false, close: false };
        }

        if (user.role === 'Lead') {
            return { read: true, write: true, assign: true, close: true };
        }

        // Member
        const canAccess = issue.assigned_to === user.id || issue.created_by === user.id;
        return { read: canAccess, write: canAccess, assign: false, close: false };
    }

    function formatIssueListItem(issue) {
        return {
            id: issue.id,
            issue_number: issue.issue_number,
            rma_number: issue.rma_number,
            ticket_type: issue.ticket_type || 'IS',
            issue_type: issue.issue_type,
            issue_category: issue.issue_category,
            severity: issue.severity,
            status: issue.status,
            service_priority: issue.service_priority,
            repair_priority: issue.repair_priority,
            title: issue.title || issue.problem_description?.substring(0, 100),
            serial_number: issue.serial_number,
            reporter_name: issue.reporter_name,
            region: issue.region,
            is_warranty: !!issue.is_warranty,
            product: issue.product_id ? { id: issue.product_id, name: issue.product_name } : null,
            customer: issue.customer_id ? { id: issue.customer_id, name: issue.customer_name } : null,
            dealer: issue.dealer_id ? { id: issue.dealer_id, name: issue.dealer_name } : null,
            assigned_to: issue.assigned_to_name ? { name: issue.assigned_to_name } : null,
            created_by: { name: issue.created_by_name },
            created_at: issue.created_at,
            updated_at: issue.updated_at
        };
    }

    function formatIssueDetail(issue) {
        return {
            id: issue.id,
            issue_number: issue.issue_number,
            rma_number: issue.rma_number,
            ticket_type: issue.ticket_type || 'IS',

            issue_type: issue.issue_type,
            issue_category: issue.issue_category,
            issue_subcategory: issue.issue_subcategory,
            severity: issue.severity,
            status: issue.status,
            service_priority: issue.service_priority,
            repair_priority: issue.repair_priority,

            title: issue.title,
            problem_description: issue.problem_description,
            solution_for_customer: issue.solution_for_customer,
            repair_content: issue.repair_content,
            problem_analysis: issue.problem_analysis,
            resolution: issue.resolution,
            is_warranty: !!issue.is_warranty,

            product: issue.product_id ? {
                id: issue.product_id,
                name: issue.product_name,
                line: issue.product_line
            } : null,
            serial_number: issue.serial_number,
            firmware_version: issue.firmware_version,
            hardware_version: issue.hardware_version,

            reporter_name: issue.reporter_name,
            reporter_type: issue.reporter_type,
            region: issue.region,
            preferred_contact_method: issue.preferred_contact_method,

            customer: issue.customer_id ? {
                id: issue.customer_id,
                name: issue.customer_name,
                type: issue.customer_type,
                contact_person: issue.contact_person,
                phone: issue.phone,
                email: issue.email,
                company: issue.company_name,
                location: [issue.country, issue.province, issue.city].filter(Boolean).join(', ')
            } : null,

            dealer: issue.dealer_id ? {
                id: issue.dealer_id,
                name: issue.dealer_name,
                code: issue.dealer_code
            } : null,

            payment: {
                channel: issue.payment_channel,
                amount: issue.payment_amount,
                date: issue.payment_date
            },

            source_service_record_id: issue.source_service_record_id,
            estimated_completion_date: issue.estimated_completion_date,

            created_by: { id: issue.created_by, name: issue.created_by_name },
            assigned_to: issue.assigned_to ? { id: issue.assigned_to, name: issue.assigned_to_name } : null,
            closed_by: issue.closed_by ? { id: issue.closed_by, name: issue.closed_by_name } : null,

            feedback_date: issue.feedback_date,
            ship_date: issue.ship_date,
            received_date: issue.received_date,
            completed_date: issue.completed_date,
            assigned_at: issue.assigned_at,
            first_response_at: issue.first_response_at,
            repair_started_at: issue.repair_started_at,
            repair_completed_at: issue.repair_completed_at,
            resolved_at: issue.resolved_at,
            closed_at: issue.closed_at,
            created_at: issue.created_at,
            updated_at: issue.updated_at,

            external_link: issue.external_link
        };
    }

    function formatComment(comment) {
        return {
            id: comment.id,
            content: comment.content,
            comment_type: comment.comment_type,
            is_internal: !!comment.is_internal,
            author: { id: comment.user_id, name: comment.author_name || comment.user_name },
            created_at: comment.created_at
        };
    }

    function formatAttachment(att) {
        return {
            id: att.id,
            file_name: att.file_name,
            file_size: att.file_size,
            file_type: att.file_type,
            file_url: `/api/v1/attachments/${att.id}/download`,
            uploaded_by: { id: att.uploaded_by, name: att.uploaded_by_name },
            uploaded_at: att.uploaded_at
        };
    }

    return router;
};
