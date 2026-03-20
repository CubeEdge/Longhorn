/**
 * RMA Documents Routes
 * PI and Repair Report management for RMA tickets
 * Document workflow: draft -> pending_review -> approved/rejected -> published
 */

const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    // ============================================
    // Helper Functions
    // ============================================

    function generatePINumber(db) {
        const today = new Date();
        const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');

        const existing = db.prepare('SELECT last_sequence FROM pi_sequences WHERE date_key = ?').get(dateKey);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare('UPDATE pi_sequences SET last_sequence = ? WHERE date_key = ?').run(seq, dateKey);
        } else {
            seq = 1;
            db.prepare('INSERT INTO pi_sequences (date_key, last_sequence) VALUES (?, ?)').run(dateKey, seq);
        }

        return `PI-RMA-${dateKey}-${String(seq).padStart(3, '0')}`;
    }

    function generateReportNumber(db) {
        const today = new Date();
        const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');

        const existing = db.prepare('SELECT last_sequence FROM report_sequences WHERE date_key = ?').get(dateKey);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare('UPDATE report_sequences SET last_sequence = ? WHERE date_key = ?').run(seq, dateKey);
        } else {
            seq = 1;
            db.prepare('INSERT INTO report_sequences (date_key, last_sequence) VALUES (?, ?)').run(dateKey, seq);
        }

        return `RR-${dateKey}-${String(seq).padStart(3, '0')}`;
    }

    /**
     * 同步维修报告配件到 parts_consumption 表
     * @param {number} ticketId - 工单ID
     * @param {number} reportId - 维修报告ID
     * @param {Array} partsReplaced - 配件列表
     * @param {string} currency - 货币
     * @param {number} userId - 操作用户ID
     * @param {string} userName - 操作用户名
     */
    function syncPartsConsumption(ticketId, reportId, partsReplaced, currency, userId, userName) {
        // 获取现有配件消耗记录（source_type = repair_report）
        const existingConsumptions = db.prepare(
            `SELECT * FROM parts_consumption 
             WHERE ticket_id = ? AND source_type = 'repair_report' AND is_deleted = 0`
        ).all(ticketId);

        const existingMap = new Map();
        existingConsumptions.forEach(c => {
            // 使用 source_ref_id 作为匹配键（存储前端part的id）
            existingMap.set(c.source_ref_id, c);
        });

        const processedIds = new Set();

        // 遍历新的配件列表
        (partsReplaced || []).forEach(part => {
            const sourceRefId = part.id;
            processedIds.add(sourceRefId);

            const existing = existingMap.get(sourceRefId);
            const unitPrice = part.unit_price || 0;
            const quantity = part.quantity || 1;

            if (existing) {
                // 更新现有记录
                db.prepare(`
                    UPDATE parts_consumption SET
                        part_id = ?,
                        part_name = ?,
                        part_sku = ?,
                        quantity = ?,
                        unit_price = ?,
                        total_price = ?,
                        currency = ?,
                        condition_type = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(
                    part.part_id || null,
                    part.name,
                    part.part_number || null,
                    quantity,
                    unitPrice,
                    unitPrice * quantity,
                    currency || 'CNY',
                    part.status || 'new',
                    existing.id
                );
            } else {
                // 新增记录
                db.prepare(`
                    INSERT INTO parts_consumption (
                        ticket_id, part_id, part_name, part_sku, quantity,
                        unit_price, total_price, currency, condition_type,
                        source_type, source_ref_id, source_document_id,
                        settlement_status, created_by, created_by_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'repair_report', ?, ?, 'pending', ?, ?)
                `).run(
                    ticketId,
                    part.part_id || null,
                    part.name,
                    part.part_number || null,
                    quantity,
                    unitPrice,
                    unitPrice * quantity,
                    currency || 'CNY',
                    part.status || 'new',
                    sourceRefId,
                    reportId,
                    userId,
                    userName
                );
            }
        });

        // 删除不在新列表中的记录（软删除）
        existingConsumptions.forEach(c => {
            if (!processedIds.has(c.source_ref_id)) {
                db.prepare(
                    `UPDATE parts_consumption SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
                ).run(c.id);
            }
        });
    }

    function logDocumentAudit(db, documentType, documentId, action, userId, userName, changesSummary, comment) {
        db.prepare(`
            INSERT INTO document_audit_log (document_type, document_id, action, user_id, user_name, changes_summary, comment)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(documentType, documentId, action, userId, userName, changesSummary ? JSON.stringify(changesSummary) : null, comment);
    }

    function checkMSDepartmentAccess(user) {
        if (!user) return false;
        // MS and OP department users and admin/lead roles have access
        return ['MS', 'OP'].includes(user?.department_code) ||
            ['MS', 'OP'].includes(user?.department_name) ||
            (user?.department_name || '').includes('市场') ||
            (user?.department_name || '').includes('运营') ||
            ['Admin', 'Lead'].includes(user?.role);
    }

    // ============================================
    // PI Routes
    // ============================================

    /**
     * GET /api/v1/rma-documents/pi
     * List PI documents for a ticket
     */
    router.get('/pi', authenticate, (req, res) => {
        try {
            const { ticket_id } = req.query;

            if (!ticket_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少ticket_id参数' }
                });
            }

            // Permission check - only MS department and admin can view
            if (!checkMSDepartmentAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看PI文档' }
                });
            }

            const pis = db.prepare(`
                SELECT pi.*,
                       u.display_name as created_by_name,
                       ru.display_name as reviewed_by_name,
                       pu.display_name as published_by_name
                FROM proforma_invoices pi
                LEFT JOIN users u ON pi.created_by = u.id
                LEFT JOIN users ru ON pi.reviewed_by = ru.id
                LEFT JOIN users pu ON pi.published_by = pu.id
                WHERE pi.ticket_id = ? AND pi.is_deleted = 0
                ORDER BY pi.created_at DESC
            `).all(ticket_id);

            res.json({
                success: true,
                data: pis.map(pi => ({
                    id: pi.id,
                    pi_number: pi.pi_number,
                    status: pi.status,
                    subtotal: pi.subtotal,
                    tax_amount: pi.tax_amount,
                    discount_amount: pi.discount_amount,
                    total_amount: pi.total_amount,
                    currency: pi.currency,
                    version: pi.version,
                    created_by: pi.created_by_name,
                    created_at: pi.created_at,
                    reviewed_by: pi.reviewed_by_name,
                    reviewed_at: pi.reviewed_at,
                    review_comment: pi.review_comment,
                    published_by: pi.published_by_name,
                    published_at: pi.published_at
                }))
            });
        } catch (err) {
            console.error('[RMA Documents] List PI error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/rma-documents/pi/:id
     * Get PI detail
     */
    router.get('/pi/:id', authenticate, (req, res) => {
        try {
            const piId = parseInt(req.params.id);
            if (!piId) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_ID', message: '无效的PI ID' }
                });
            }

            const pi = db.prepare(`
                SELECT pi.*,
                       u.display_name as created_by_name,
                       ru.display_name as reviewed_by_name,
                       pu.display_name as published_by_name
                FROM proforma_invoices pi
                LEFT JOIN users u ON pi.created_by = u.id
                LEFT JOIN users ru ON pi.reviewed_by = ru.id
                LEFT JOIN users pu ON pi.published_by = pu.id
                WHERE pi.id = ? AND pi.is_deleted = 0
            `).get(req.params.id);

            if (!pi) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'PI不存在' }
                });
            }

            // Permission check
            if (!checkMSDepartmentAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看此PI' }
                });
            }

            res.json({
                success: true,
                data: {
                    id: pi.id,
                    pi_number: pi.pi_number,
                    ticket_id: pi.ticket_id,
                    status: pi.status,
                    content: JSON.parse(pi.content),
                    subtotal: pi.subtotal,
                    tax_rate: pi.tax_rate,
                    tax_amount: pi.tax_amount,
                    discount_amount: pi.discount_amount,
                    total_amount: pi.total_amount,
                    currency: pi.currency,
                    valid_until: pi.valid_until,
                    version: pi.version,
                    created_by: pi.created_by ? { id: pi.created_by, display_name: pi.created_by_name } : null,
                    created_at: pi.created_at,
                    updated_at: pi.updated_at,
                    submitted_for_review_at: pi.submitted_for_review_at,
                    reviewed_by: pi.reviewed_by ? { id: pi.reviewed_by, display_name: pi.reviewed_by_name } : null,
                    reviewed_at: pi.reviewed_at,
                    review_comment: pi.review_comment,
                    published_by: pi.published_by ? { id: pi.published_by, display_name: pi.published_by_name } : null,
                    published_at: pi.published_at
                }
            });
        } catch (err) {
            console.error('[RMA Documents] Get PI error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/rma-documents/pi
     * Create new PI
     */
    router.post('/pi', authenticate, (req, res) => {
        try {
            // Permission check - only MS department and admin can create
            if (!checkMSDepartmentAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权创建PI' }
                });
            }

            const {
                ticket_id,
                content,
                subtotal = 0,
                tax_rate = 0,
                tax_amount = 0,
                discount_amount = 0,
                total_amount = 0,
                currency = 'CNY',
                valid_until
            } = req.body;

            if (!ticket_id || !content) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' }
                });
            }

            const piNumber = generatePINumber(db);

            const result = db.prepare(`
                INSERT INTO proforma_invoices (
                    pi_number, ticket_id, status, content,
                    subtotal, tax_rate, tax_amount, discount_amount, total_amount,
                    currency, valid_until, created_by, created_at, updated_at
                ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
                piNumber, ticket_id, JSON.stringify(content),
                subtotal, tax_rate, tax_amount, discount_amount, total_amount,
                currency, valid_until, req.user.id
            );

            const piId = result.lastInsertRowid;

            // Log audit
            logDocumentAudit(db, 'pi', piId, 'created', req.user.id, req.user.display_name || req.user.username, null, null);

            res.status(201).json({
                success: true,
                data: { id: piId, pi_number: piNumber }
            });
        } catch (err) {
            console.error('[RMA Documents] Create PI error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/rma-documents/pi/:id
     * Update PI (draft only)
     */
    router.patch('/pi/:id', authenticate, (req, res) => {
        try {
            const pi = db.prepare('SELECT * FROM proforma_invoices WHERE id = ? AND is_deleted = 0').get(req.params.id);

            if (!pi) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'PI不存在' }
                });
            }

            // Only draft or rejected can be edited
            if (!['draft', 'rejected'].includes(pi.status)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_STATUS', message: '当前状态不允许编辑' }
                });
            }

            // Only creator or admin can edit
            if (pi.created_by !== req.user.id && !['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权编辑此PI' }
                });
            }

            const {
                content,
                subtotal,
                tax_rate,
                tax_amount,
                discount_amount,
                total_amount,
                currency,
                valid_until
            } = req.body;

            const updates = ['updated_at = CURRENT_TIMESTAMP', 'updated_by = ?'];
            const params = [req.user.id];

            if (content !== undefined) {
                updates.push('content = ?');
                params.push(JSON.stringify(content));
            }
            if (subtotal !== undefined) {
                updates.push('subtotal = ?');
                params.push(subtotal);
            }
            if (tax_rate !== undefined) {
                updates.push('tax_rate = ?');
                params.push(tax_rate);
            }
            if (tax_amount !== undefined) {
                updates.push('tax_amount = ?');
                params.push(tax_amount);
            }
            if (discount_amount !== undefined) {
                updates.push('discount_amount = ?');
                params.push(discount_amount);
            }
            if (total_amount !== undefined) {
                updates.push('total_amount = ?');
                params.push(total_amount);
            }
            if (currency !== undefined) {
                updates.push('currency = ?');
                params.push(currency);
            }
            if (valid_until !== undefined) {
                updates.push('valid_until = ?');
                params.push(valid_until);
            }

            params.push(req.params.id);

            db.prepare(`UPDATE proforma_invoices SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            // Log audit
            logDocumentAudit(db, 'pi', req.params.id, 'updated', req.user.id, req.user.display_name || req.user.username, null, null);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id) }
            });
        } catch (err) {
            console.error('[RMA Documents] Update PI error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/rma-documents/pi/:id/submit
     * Submit PI - directly publish (no review needed)
     */
    router.post('/pi/:id/submit', authenticate, (req, res) => {
        try {
            const pi = db.prepare('SELECT * FROM proforma_invoices WHERE id = ? AND is_deleted = 0').get(req.params.id);

            if (!pi) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'PI不存在' }
                });
            }

            if (pi.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_STATUS', message: '只有草稿状态可以提交' }
                });
            }

            // Only creator or Lead/Admin can submit
            if (pi.created_by !== req.user.id && !['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权提交此PI' }
                });
            }

            // Directly publish - no review needed
            db.prepare(`
                UPDATE proforma_invoices
                SET status = 'published', 
                    submitted_for_review_at = CURRENT_TIMESTAMP, submitted_by = ?,
                    published_at = CURRENT_TIMESTAMP, published_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(req.user.id, req.user.id, req.params.id);

            // Log audit
            const piNumber = pi.pi_number || `PI-${req.params.id}`;
            logDocumentAudit(db, 'pi', req.params.id, 'published', req.user.id, req.user.display_name || req.user.username, null, '提交发布');

            // Add to ticket timeline and notify all participants
            try {
                const ticket = db.prepare('SELECT id, ticket_number FROM tickets WHERE id = ?').get(pi.ticket_id);
                const submitterName = req.user.display_name || req.user.username;
                const now = new Date().toISOString();

                // Add timeline entry
                db.prepare(`
                    INSERT INTO ticket_activities (
                        ticket_id, actor_id, actor_name, actor_role, activity_type, content, metadata, visibility, created_at
                    ) VALUES (?, ?, ?, ?, 'document_published', ?, ?, 'all', ?)
                `).run(
                    pi.ticket_id,
                    req.user.id,
                    submitterName,
                    req.user.department || 'MS',
                    `${submitterName} 发布了 PI ${piNumber}`,
                    JSON.stringify({ document_type: 'pi', document_id: req.params.id, pi_number: piNumber }),
                    now
                );

                // Notify all ticket participants
                const participants = db.prepare(`
                    SELECT DISTINCT user_id FROM (
                        SELECT assignee_id AS user_id FROM tickets WHERE id = ? AND assignee_id IS NOT NULL
                        UNION SELECT reporter_id AS user_id FROM tickets WHERE id = ? AND reporter_id IS NOT NULL
                        UNION SELECT created_by AS user_id FROM tickets WHERE id = ?
                        UNION SELECT user_id FROM ticket_activities WHERE ticket_id = ? AND user_id IS NOT NULL
                    ) WHERE user_id != ?
                `).all(pi.ticket_id, pi.ticket_id, pi.ticket_id, pi.ticket_id, req.user.id);

                for (const p of participants) {
                    db.prepare(`
                        INSERT INTO notifications (
                            recipient_id, notification_type, title, content, icon,
                            related_type, related_id, action_url, metadata, created_at
                        ) VALUES (?, 'document_update', ?, ?, 'file-text', 'ticket', ?, ?, ?, ?)
                    `).run(
                        p.user_id,
                        `PI已发布: ${piNumber}`,
                        `${submitterName} 发布了 PI ${piNumber}`,
                        ticket?.id || pi.ticket_id,
                        `/service/tickets/${ticket?.id || pi.ticket_id}`,
                        JSON.stringify({ pi_id: req.params.id, pi_number: piNumber, ticket_number: ticket?.ticket_number }),
                        now
                    );
                }
            } catch (notifyErr) {
                console.error('[RMA Documents] Failed to add timeline/notifications:', notifyErr);
            }

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), status: 'published' }
            });
        } catch (err) {
            console.error('[RMA Documents] Submit PI error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/rma-documents/pi/:id/review
     * Review PI (approve or reject)
     */
    router.post('/pi/:id/review', authenticate, (req, res) => {
        try {
            // Only Lead or Admin can review
            if (!['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权审核PI' }
                });
            }

            const pi = db.prepare('SELECT * FROM proforma_invoices WHERE id = ? AND is_deleted = 0').get(req.params.id);

            if (!pi) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'PI不存在' }
                });
            }

            if (pi.status !== 'pending_review') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_STATUS', message: '只有待审核状态可以进行审核' }
                });
            }

            const { action, comment } = req.body; // action: 'approve' or 'reject'

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '无效的审核动作' }
                });
            }

            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            const actionType = action === 'approve' ? 'approved' : 'rejected';

            db.prepare(`
                UPDATE proforma_invoices
                SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_comment = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(newStatus, req.user.id, comment || null, req.params.id);

            // Log audit
            logDocumentAudit(db, 'pi', req.params.id, actionType, req.user.id, req.user.display_name || req.user.username, null, comment);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), status: newStatus }
            });
        } catch (err) {
            console.error('[RMA Documents] Review PI error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/rma-documents/pi/:id/publish
     * Publish PI
     */
    router.post('/pi/:id/publish', authenticate, (req, res) => {
        try {
            // Only Lead or Admin can publish
            if (!['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权发布PI' }
                });
            }

            const pi = db.prepare('SELECT * FROM proforma_invoices WHERE id = ? AND is_deleted = 0').get(req.params.id);

            if (!pi) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'PI不存在' }
                });
            }

            if (pi.status !== 'approved') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_STATUS', message: '只有已批准状态可以发布' }
                });
            }

            db.prepare(`
                UPDATE proforma_invoices
                SET status = 'published', published_by = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(req.user.id, req.params.id);

            // Update ticket's active PI reference and payment amount
            db.prepare('UPDATE tickets SET active_pi_id = ?, payment_amount = ? WHERE id = ?').run(req.params.id, pi.total_amount, pi.ticket_id);

            // Log audit
            logDocumentAudit(db, 'pi', req.params.id, 'published', req.user.id, req.user.display_name || req.user.username, null, null);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), status: 'published' }
            });
        } catch (err) {
            console.error('[RMA Documents] Publish PI error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/rma-documents/pi/:id/recall
     * Revert published PI to draft (Lead/Admin only)
     */
    router.post('/pi/:id/recall', authenticate, (req, res) => {
        try {
            // Only Lead or Admin can recall
            if (!['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权撤回PI' }
                });
            }

            const pi = db.prepare('SELECT * FROM proforma_invoices WHERE id = ? AND is_deleted = 0').get(req.params.id);

            if (!pi) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'PI不存在' }
                });
            }

            db.prepare(`
                UPDATE proforma_invoices
                SET status = 'draft', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(req.params.id);

            // Log audit
            const piNumber = pi.pi_number || `PI-${req.params.id}`;
            logDocumentAudit(db, 'pi', req.params.id, 'recalled', req.user.id, req.user.display_name || req.user.username, null, '撤回发布');

            // Add to ticket timeline and notify all participants
            try {
                const ticket = db.prepare('SELECT id, ticket_number FROM tickets WHERE id = ?').get(pi.ticket_id);
                const submitterName = req.user.display_name || req.user.username;
                const now = new Date().toISOString();

                // Add timeline entry
                db.prepare(`
                    INSERT INTO ticket_activities (
                        ticket_id, actor_id, actor_name, actor_role, activity_type, content, metadata, visibility, created_at
                    ) VALUES (?, ?, ?, ?, 'document_recalled', ?, ?, 'all', ?)
                `).run(
                    pi.ticket_id,
                    req.user.id,
                    submitterName,
                    req.user.department || 'MS',
                    `${submitterName} 撤回了 PI ${piNumber} 的发布`,
                    JSON.stringify({ document_type: 'pi', document_id: req.params.id, pi_number: piNumber }),
                    now
                );

                // Notify all ticket participants
                const participants = db.prepare(`
                    SELECT DISTINCT user_id FROM (
                        SELECT assignee_id AS user_id FROM tickets WHERE id = ? AND assignee_id IS NOT NULL
                        UNION SELECT reporter_id AS user_id FROM tickets WHERE id = ? AND reporter_id IS NOT NULL
                        UNION SELECT created_by AS user_id FROM tickets WHERE id = ?
                        UNION SELECT user_id FROM ticket_activities WHERE ticket_id = ? AND user_id IS NOT NULL
                    ) WHERE user_id != ?
                `).all(pi.ticket_id, pi.ticket_id, pi.ticket_id, pi.ticket_id, req.user.id);

                for (const p of participants) {
                    db.prepare(`
                        INSERT INTO notifications (
                            recipient_id, notification_type, title, content, icon,
                            related_type, related_id, action_url, metadata, created_at
                        ) VALUES (?, 'document_update', ?, ?, 'file-text', 'ticket', ?, ?, ?, ?)
                    `).run(
                        p.user_id,
                        `PI已撤回: ${piNumber}`,
                        `${submitterName} 撤回了 PI ${piNumber} 的发布`,
                        ticket?.id || pi.ticket_id,
                        `/service/tickets/${ticket?.id || pi.ticket_id}`,
                        JSON.stringify({ pi_id: req.params.id, pi_number: piNumber, ticket_number: ticket?.ticket_number }),
                        now
                    );
                }
            } catch (notifyErr) {
                console.error('[RMA Documents] Failed to add timeline/notifications:', notifyErr);
            }

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), status: 'draft' }
            });
        } catch (err) {
            console.error('[RMA Documents] Recall PI error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/rma-documents/pi/:id/pdf
     * Export PI as PDF
     */
    router.get('/pi/:id/pdf', authenticate, (req, res) => {
        try {
            const pi = db.prepare(`
                SELECT pi.*, u.display_name as created_by_name
                FROM proforma_invoices pi
                LEFT JOIN users u ON pi.created_by = u.id
                WHERE pi.id = ? AND pi.is_deleted = 0
            `).get(req.params.id);

            if (!pi) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'PI不存在' }
                });
            }

            // Permission check
            if (!checkMSDepartmentAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权导出此PI' }
                });
            }

            // For now, return JSON data that can be used to generate PDF on client side
            // In production, this would generate and return an actual PDF file
            const content = JSON.parse(pi.content);

            res.json({
                success: true,
                data: {
                    pi_number: pi.pi_number,
                    content: content,
                    financial: {
                        subtotal: pi.subtotal,
                        tax_rate: pi.tax_rate,
                        tax_amount: pi.tax_amount,
                        discount_amount: pi.discount_amount,
                        total_amount: pi.total_amount,
                        currency: pi.currency
                    },
                    created_by: pi.created_by_name,
                    created_at: pi.created_at,
                    valid_until: pi.valid_until
                }
            });
        } catch (err) {
            console.error('[RMA Documents] Export PI PDF error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ============================================
    // Repair Report Routes
    // ============================================

    /**
     * GET /api/v1/rma-documents/repair-reports
     * List repair reports for a ticket
     */
    router.get('/repair-reports', authenticate, (req, res) => {
        try {
            const { ticket_id } = req.query;

            if (!ticket_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少ticket_id参数' }
                });
            }

            // Permission check
            if (!checkMSDepartmentAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看维修报告' }
                });
            }

            const reports = db.prepare(`
                SELECT rr.*,
                       u.display_name as created_by_name,
                       ru.display_name as reviewed_by_name,
                       pu.display_name as published_by_name
                FROM repair_reports rr
                LEFT JOIN users u ON rr.created_by = u.id
                LEFT JOIN users ru ON rr.reviewed_by = ru.id
                LEFT JOIN users pu ON rr.published_by = pu.id
                WHERE rr.ticket_id = ? AND rr.is_deleted = 0
                ORDER BY rr.created_at DESC
            `).all(ticket_id);

            res.json({
                success: true,
                data: reports.map(report => ({
                    id: report.id,
                    report_number: report.report_number,
                    status: report.status,
                    service_type: report.service_type,
                    total_cost: report.total_cost,
                    currency: report.currency,
                    warranty_status: report.warranty_status,
                    version: report.version,
                    created_by: report.created_by_name,
                    created_at: report.created_at,
                    reviewed_by: report.reviewed_by_name,
                    reviewed_at: report.reviewed_at,
                    review_comment: report.review_comment,
                    published_by: report.published_by_name,
                    published_at: report.published_at
                }))
            });
        } catch (err) {
            console.error('[RMA Documents] List reports error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/rma-documents/repair-reports/:id
     * Get repair report detail
     */
    router.get('/repair-reports/:id', authenticate, (req, res) => {
        try {
            const reportId = parseInt(req.params.id);
            if (!reportId) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_ID', message: '无效的维修报告 ID' }
                });
            }

            const report = db.prepare(`
                SELECT rr.*,
                       u.display_name as created_by_name,
                       ru.display_name as reviewed_by_name,
                       pu.display_name as published_by_name
                FROM repair_reports rr
                LEFT JOIN users u ON rr.created_by = u.id
                LEFT JOIN users ru ON rr.reviewed_by = ru.id
                LEFT JOIN users pu ON rr.published_by = pu.id
                WHERE rr.id = ? AND rr.is_deleted = 0
            `).get(reportId);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '维修报告不存在' }
                });
            }

            // Permission check
            if (!checkMSDepartmentAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看此维修报告' }
                });
            }

            res.json({
                success: true,
                data: {
                    id: report.id,
                    report_number: report.report_number,
                    ticket_id: report.ticket_id,
                    status: report.status,
                    content: JSON.parse(report.content),
                    service_type: report.service_type,
                    total_cost: report.total_cost,
                    currency: report.currency,
                    warranty_status: report.warranty_status,
                    repair_warranty_days: report.repair_warranty_days,
                    version: report.version,
                    prepared_by: report.prepared_by ? { id: report.prepared_by, display_name: report.prepared_by_name } : null,
                    translations: report.translations ? JSON.parse(report.translations) : null,
                    created_by: report.created_by ? { id: report.created_by, display_name: report.created_by_name } : null,
                    created_at: report.created_at,
                    updated_at: report.updated_at,
                    submitted_for_review_at: report.submitted_for_review_at,
                    reviewed_by: report.reviewed_by ? { id: report.reviewed_by, display_name: report.reviewed_by_name } : null,
                    reviewed_at: report.reviewed_at,
                    review_comment: report.review_comment,
                    published_by: report.published_by ? { id: report.published_by, display_name: report.published_by_name } : null,
                    published_at: report.published_at
                }
            });
        } catch (err) {
            console.error('[RMA Documents] Get report error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/rma-documents/repair-reports
     * Create new repair report
     */
    router.post('/repair-reports', authenticate, (req, res) => {
        try {
            // Permission check
            if (!checkMSDepartmentAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权创建维修报告' }
                });
            }

            const {
                ticket_id,
                content,
                service_type = 'paid',
                total_cost = 0,
                currency = 'CNY',
                warranty_status,
                repair_warranty_days = 90,
                prepared_by,
                translations
            } = req.body;

            if (!ticket_id || !content) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' }
                });
            }

            const reportNumber = generateReportNumber(db);

            const result = db.prepare(`
                INSERT INTO repair_reports (
                    report_number, ticket_id, status, content,
                    service_type, total_cost, currency, warranty_status, repair_warranty_days,
                    prepared_by, prepared_by_name, translations,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
                reportNumber, ticket_id, JSON.stringify(content),
                service_type, total_cost, currency, warranty_status, repair_warranty_days,
                prepared_by?.id || null, prepared_by?.display_name || null, translations ? JSON.stringify(translations) : null,
                req.user.id
            );

            const reportId = result.lastInsertRowid;

            // Log audit
            logDocumentAudit(db, 'repair_report', reportId, 'created', req.user.id, req.user.display_name || req.user.username, null, null);

            res.status(201).json({
                success: true,
                data: { id: reportId, report_number: reportNumber }
            });
        } catch (err) {
            console.error('[RMA Documents] Create report error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/rma-documents/repair-reports/:id
     * Update repair report (draft only)
     */
    router.patch('/repair-reports/:id', authenticate, (req, res) => {
        try {
            const report = db.prepare('SELECT * FROM repair_reports WHERE id = ? AND is_deleted = 0').get(req.params.id);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '维修报告不存在' }
                });
            }

            // Only draft or rejected can be edited
            if (!['draft', 'rejected'].includes(report.status)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_STATUS', message: '当前状态不允许编辑' }
                });
            }

            // Only creator or admin can edit
            if (report.created_by !== req.user.id && !['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权编辑此维修报告' }
                });
            }

            const {
                content,
                service_type,
                total_cost,
                currency,
                warranty_status,
                repair_warranty_days,
                prepared_by,
                translations
            } = req.body;

            const updates = ['updated_at = CURRENT_TIMESTAMP', 'updated_by = ?'];
            const params = [req.user.id];

            if (content !== undefined) {
                updates.push('content = ?');
                params.push(JSON.stringify(content));
            }
            if (service_type !== undefined) {
                updates.push('service_type = ?');
                params.push(service_type);
            }
            if (total_cost !== undefined) {
                updates.push('total_cost = ?');
                params.push(total_cost);
            }
            if (currency !== undefined) {
                updates.push('currency = ?');
                params.push(currency);
            }
            if (warranty_status !== undefined) {
                updates.push('warranty_status = ?');
                params.push(warranty_status);
            }
            if (repair_warranty_days !== undefined) {
                updates.push('repair_warranty_days = ?');
                params.push(repair_warranty_days);
            }
            if (prepared_by !== undefined) {
                updates.push('prepared_by = ?');
                updates.push('prepared_by_name = ?');
                params.push(prepared_by?.id || null);
                params.push(prepared_by?.display_name || null);
            }
            if (translations !== undefined) {
                updates.push('translations = ?');
                params.push(JSON.stringify(translations));
            }

            params.push(req.params.id);

            db.prepare(`UPDATE repair_reports SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            // 同步配件消耗记录
            if (content !== undefined && content.repair_process?.parts_replaced) {
                const reportCurrency = currency !== undefined ? currency : report.currency;
                syncPartsConsumption(
                    report.ticket_id,
                    parseInt(req.params.id),
                    content.repair_process.parts_replaced,
                    reportCurrency,
                    req.user.id,
                    req.user.display_name || req.user.username
                );
            }

            // Log audit
            logDocumentAudit(db, 'repair_report', req.params.id, 'updated', req.user.id, req.user.display_name || req.user.username, null, null);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id) }
            });
        } catch (err) {
            console.error('[RMA Documents] Update report error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/rma-documents/repair-reports/:id/submit
     * Submit repair report - directly publish (no review needed)
     */
    router.post('/repair-reports/:id/submit', authenticate, (req, res) => {
        try {
            const report = db.prepare('SELECT * FROM repair_reports WHERE id = ? AND is_deleted = 0').get(req.params.id);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '维修报告不存在' }
                });
            }

            if (report.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_STATUS', message: '只有草稿状态可以提交' }
                });
            }

            // Only creator or Lead/Admin can submit
            if (report.created_by !== req.user.id && !['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权提交此维修报告' }
                });
            }

            // Directly publish - no review needed
            db.prepare(`
                UPDATE repair_reports
                SET status = 'published', 
                    submitted_for_review_at = CURRENT_TIMESTAMP, submitted_by = ?,
                    published_at = CURRENT_TIMESTAMP, published_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(req.user.id, req.user.id, req.params.id);

            // Log audit
            const reportNumber = report.report_number || `RR-${req.params.id}`;
            logDocumentAudit(db, 'repair_report', req.params.id, 'published', req.user.id, req.user.display_name || req.user.username, null, '提交发布');

            // Add to ticket timeline and notify all participants
            try {
                const ticket = db.prepare('SELECT id, ticket_number FROM tickets WHERE id = ?').get(report.ticket_id);
                const submitterName = req.user.display_name || req.user.username;
                const now = new Date().toISOString();

                // Add timeline entry
                db.prepare(`
                    INSERT INTO ticket_activities (
                        ticket_id, actor_id, actor_name, actor_role, activity_type, content, metadata, visibility, created_at
                    ) VALUES (?, ?, ?, ?, 'document_published', ?, ?, 'all', ?)
                `).run(
                    report.ticket_id,
                    req.user.id,
                    submitterName,
                    req.user.department || 'MS',
                    `${submitterName} 发布了维修报告 ${reportNumber}`,
                    JSON.stringify({ document_type: 'repair_report', document_id: req.params.id, report_number: reportNumber }),
                    now
                );

                // Notify all ticket participants
                const participants = db.prepare(`
                    SELECT DISTINCT user_id FROM (
                        SELECT assignee_id AS user_id FROM tickets WHERE id = ? AND assignee_id IS NOT NULL
                        UNION SELECT reporter_id AS user_id FROM tickets WHERE id = ? AND reporter_id IS NOT NULL
                        UNION SELECT created_by AS user_id FROM tickets WHERE id = ?
                        UNION SELECT user_id FROM ticket_activities WHERE ticket_id = ? AND user_id IS NOT NULL
                    ) WHERE user_id != ?
                `).all(report.ticket_id, report.ticket_id, report.ticket_id, report.ticket_id, req.user.id);

                for (const p of participants) {
                    db.prepare(`
                        INSERT INTO notifications (
                            recipient_id, notification_type, title, content, icon,
                            related_type, related_id, action_url, metadata, created_at
                        ) VALUES (?, 'document_update', ?, ?, 'file-text', 'ticket', ?, ?, ?, ?)
                    `).run(
                        p.user_id,
                        `维修报告已发布: ${reportNumber}`,
                        `${submitterName} 发布了维修报告 ${reportNumber}`,
                        ticket?.id || report.ticket_id,
                        `/service/tickets/${ticket?.id || report.ticket_id}`,
                        JSON.stringify({ report_id: req.params.id, report_number: reportNumber, ticket_number: ticket?.ticket_number }),
                        now
                    );
                }
            } catch (notifyErr) {
                console.error('[RMA Documents] Failed to add timeline/notifications:', notifyErr);
            }

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), status: 'published' }
            });
        } catch (err) {
            console.error('[RMA Documents] Submit report error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/rma-documents/repair-reports/:id/review
     * Review repair report (approve or reject)
     */
    router.post('/repair-reports/:id/review', authenticate, (req, res) => {
        try {
            // Only Lead or Admin can review
            if (!['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权审核维修报告' }
                });
            }

            const report = db.prepare('SELECT * FROM repair_reports WHERE id = ? AND is_deleted = 0').get(req.params.id);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '维修报告不存在' }
                });
            }

            if (report.status !== 'pending_review') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_STATUS', message: '只有待审核状态可以进行审核' }
                });
            }

            const { action, comment } = req.body;

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '无效的审核动作' }
                });
            }

            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            const actionType = action === 'approve' ? 'approved' : 'rejected';

            db.prepare(`
                UPDATE repair_reports
                SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_comment = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(newStatus, req.user.id, comment || null, req.params.id);

            // Log audit
            logDocumentAudit(db, 'repair_report', req.params.id, actionType, req.user.id, req.user.display_name || req.user.username, null, comment);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), status: newStatus }
            });
        } catch (err) {
            console.error('[RMA Documents] Review report error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/rma-documents/repair-reports/:id/publish
     * Publish repair report
     */
    router.post('/repair-reports/:id/publish', authenticate, (req, res) => {
        try {
            // Only Lead or Admin can publish
            if (!['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权发布维修报告' }
                });
            }

            const report = db.prepare('SELECT * FROM repair_reports WHERE id = ? AND is_deleted = 0').get(req.params.id);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '维修报告不存在' }
                });
            }

            if (report.status !== 'approved') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_STATUS', message: '只有已批准状态可以发布' }
                });
            }

            db.prepare(`
                UPDATE repair_reports
                SET status = 'published', published_by = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(req.user.id, req.params.id);

            // Update ticket's active report reference
            db.prepare('UPDATE tickets SET active_repair_report_id = ? WHERE id = ?').run(req.params.id, report.ticket_id);

            // Log audit
            logDocumentAudit(db, 'repair_report', req.params.id, 'published', req.user.id, req.user.display_name || req.user.username, null, null);
            res.json({
                success: true,
                data: { id: parseInt(req.params.id), status: 'published' }
            });
        } catch (err) {
            console.error('[RMA Documents] Publish report error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/rma-documents/repair-reports/:id/recall
     * Revert published repair report to draft (Lead/Admin only)
     */
    router.post('/repair-reports/:id/recall', authenticate, (req, res) => {
        try {
            // Only Lead or Admin can recall
            if (!['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权撤回维修报告' }
                });
            }

            const report = db.prepare('SELECT * FROM repair_reports WHERE id = ? AND is_deleted = 0').get(req.params.id);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '维修报告不存在' }
                });
            }

            db.prepare(`
                UPDATE repair_reports
                SET status = 'draft', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(req.params.id);

            // Log audit
            const reportNumber = report.report_number || `RR-${req.params.id}`;
            logDocumentAudit(db, 'repair_report', req.params.id, 'recalled', req.user.id, req.user.display_name || req.user.username, null, '撤回发布');

            // Add to ticket timeline and notify all participants
            try {
                const ticket = db.prepare('SELECT id, ticket_number FROM tickets WHERE id = ?').get(report.ticket_id);
                const submitterName = req.user.display_name || req.user.username;
                const now = new Date().toISOString();

                // Add timeline entry
                db.prepare(`
                    INSERT INTO ticket_activities (
                        ticket_id, actor_id, actor_name, actor_role, activity_type, content, metadata, visibility, created_at
                    ) VALUES (?, ?, ?, ?, 'document_recalled', ?, ?, 'all', ?)
                `).run(
                    report.ticket_id,
                    req.user.id,
                    submitterName,
                    req.user.department || 'MS',
                    `${submitterName} 撤回了维修报告 ${reportNumber} 的发布`,
                    JSON.stringify({ document_type: 'repair_report', document_id: req.params.id, report_number: reportNumber }),
                    now
                );

                // Notify all ticket participants
                const participants = db.prepare(`
                    SELECT DISTINCT user_id FROM (
                        SELECT assignee_id AS user_id FROM tickets WHERE id = ? AND assignee_id IS NOT NULL
                        UNION SELECT reporter_id AS user_id FROM tickets WHERE id = ? AND reporter_id IS NOT NULL
                        UNION SELECT created_by AS user_id FROM tickets WHERE id = ?
                        UNION SELECT user_id FROM ticket_activities WHERE ticket_id = ? AND user_id IS NOT NULL
                    ) WHERE user_id != ?
                `).all(report.ticket_id, report.ticket_id, report.ticket_id, report.ticket_id, req.user.id);

                for (const p of participants) {
                    db.prepare(`
                        INSERT INTO notifications (
                            recipient_id, notification_type, title, content, icon,
                            related_type, related_id, action_url, metadata, created_at
                        ) VALUES (?, 'document_update', ?, ?, 'file-text', 'ticket', ?, ?, ?, ?)
                    `).run(
                        p.user_id,
                        `维修报告已撤回: ${reportNumber}`,
                        `${submitterName} 撤回了维修报告 ${reportNumber} 的发布`,
                        ticket?.id || report.ticket_id,
                        `/service/tickets/${ticket?.id || report.ticket_id}`,
                        JSON.stringify({ report_id: req.params.id, report_number: reportNumber, ticket_number: ticket?.ticket_number }),
                        now
                    );
                }
            } catch (notifyErr) {
                console.error('[RMA Documents] Failed to add timeline/notifications:', notifyErr);
            }

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), status: 'draft' }
            });
        } catch (err) {
            console.error('[RMA Documents] Recall repair report error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/rma-documents/repair-reports/:id/pdf
     * Export repair report as PDF
     */
    router.get('/repair-reports/:id/pdf', authenticate, (req, res) => {
        try {
            const report = db.prepare(`
                SELECT rr.*, u.display_name as created_by_name
                FROM repair_reports rr
                LEFT JOIN users u ON rr.created_by = u.id
                WHERE rr.id = ? AND rr.is_deleted = 0
            `).get(req.params.id);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '维修报告不存在' }
                });
            }

            // Permission check
            if (!checkMSDepartmentAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权导出此维修报告' }
                });
            }

            const content = JSON.parse(report.content);

            res.json({
                success: true,
                data: {
                    report_number: report.report_number,
                    content: content,
                    service_type: report.service_type,
                    total_cost: report.total_cost,
                    currency: report.currency,
                    warranty_status: report.warranty_status,
                    repair_warranty_days: report.repair_warranty_days,
                    created_by: report.created_by_name,
                    created_at: report.created_at
                }
            });
        } catch (err) {
            console.error('[RMA Documents] Export report PDF error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ============================================
    // Document Audit Log Routes
    // ============================================

    /**
     * GET /api/v1/rma-documents/audit-log
     * Get audit log for documents
     */
    router.get('/audit-log', authenticate, (req, res) => {
        try {
            const { document_type, document_id, page = 1, page_size = 20 } = req.query;

            // Permission check
            if (!checkMSDepartmentAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看审计日志' }
                });
            }

            let conditions = [];
            let params = [];

            if (document_type) {
                conditions.push('document_type = ?');
                params.push(document_type);
            }
            if (document_id) {
                conditions.push('document_id = ?');
                params.push(document_id);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`SELECT COUNT(*) as total FROM document_audit_log ${whereClause}`).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const logs = db.prepare(`
                SELECT * FROM document_audit_log
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: logs.map(log => ({
                    id: log.id,
                    document_type: log.document_type,
                    document_id: log.document_id,
                    action: log.action,
                    user_name: log.user_name,
                    changes_summary: log.changes_summary ? JSON.parse(log.changes_summary) : null,
                    comment: log.comment,
                    created_at: log.created_at
                })),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[RMA Documents] Audit log error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ============================================
    // Translation APIs for Repair Reports
    // ============================================

    /**
     * POST /api/v1/rma-documents/repair-reports/:id/translate
     * AI translate report content to target language
     */
    router.post('/repair-reports/:id/translate', authenticate, async (req, res) => {
        try {
            const { id } = req.params;
            const { target_lang, fields } = req.body;  // fields: array of field names to translate

            const report = db.prepare('SELECT * FROM repair_reports WHERE id = ? AND is_deleted = 0').get(id);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '维修报告不存在' }
                });
            }

            // Parse content
            const content = JSON.parse(report.content || '{}');
            const translations = JSON.parse(report.translations || '{}');

            // Fields that can be translated
            const translatableFields = [
                'issue_description',
                'fault_symptoms', 
                'diagnosis',
                'repair_process',
                'repair_result',
                'notes',
                'qa_result'
            ];

            const fieldsToTranslate = fields || translatableFields;
            const result = {};

            for (const field of fieldsToTranslate) {
                const sourceText = content[field];
                if (!sourceText || typeof sourceText !== 'string') continue;

                // Check cache first
                const cached = db.prepare(
                    'SELECT translated_text FROM translation_cache WHERE source_text = ? AND source_lang = ? AND target_lang = ?'
                ).get(sourceText, 'zh', target_lang);

                if (cached) {
                    // Update use count
                    db.prepare('UPDATE translation_cache SET use_count = use_count + 1 WHERE source_text = ? AND source_lang = ? AND target_lang = ?')
                        .run(sourceText, 'zh', target_lang);
                    result[field] = cached.translated_text;
                } else {
                    // Will need AI translation - return placeholder for now
                    result[field] = null;
                }
            }

            res.json({
                success: true,
                data: {
                    target_lang,
                    translations: result,
                    needs_ai_translation: Object.values(result).some(v => v === null)
                }
            });
        } catch (err) {
            console.error('[RMA Documents] Translate error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/rma-documents/repair-reports/:id/translations
     * Save translations (AI or manual)
     */
    router.post('/repair-reports/:id/translations', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { lang, translations: newTranslations, is_manual_edit } = req.body;

            const report = db.prepare('SELECT * FROM repair_reports WHERE id = ? AND is_deleted = 0').get(id);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '维修报告不存在' }
                });
            }

            // Get existing translations
            const existingTranslations = JSON.parse(report.translations || '{}');

            // Merge new translations
            existingTranslations[lang] = {
                ...existingTranslations[lang],
                ...newTranslations,
                _meta: {
                    updated_at: new Date().toISOString(),
                    updated_by: req.user.display_name || req.user.username,
                    is_manual_edit: !!is_manual_edit
                }
            };

            // Save to database
            db.prepare('UPDATE repair_reports SET translations = ? WHERE id = ?')
                .run(JSON.stringify(existingTranslations), id);

            // Log audit for manual edits
            if (is_manual_edit) {
                for (const [field, value] of Object.entries(newTranslations)) {
                    db.prepare(`
                        INSERT INTO translation_audit_log (report_id, field_name, target_lang, action, manual_correction, user_id, user_name)
                        VALUES (?, ?, ?, 'manual_edited', ?, ?, ?)
                    `).run(id, field, lang, value, req.user.id, req.user.display_name || req.user.username);
                }
            }

            res.json({
                success: true,
                data: { translations: existingTranslations }
            });
        } catch (err) {
            console.error('[RMA Documents] Save translations error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/rma-documents/repair-reports/:id/translations
     * Get all translations for a report
     */
    router.get('/repair-reports/:id/translations', authenticate, (req, res) => {
        try {
            const { id } = req.params;

            const report = db.prepare('SELECT translations FROM repair_reports WHERE id = ? AND is_deleted = 0').get(id);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '维修报告不存在' }
                });
            }

            const translations = JSON.parse(report.translations || '{}');

            res.json({
                success: true,
                data: { translations }
            });
        } catch (err) {
            console.error('[RMA Documents] Get translations error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    return router;
};
