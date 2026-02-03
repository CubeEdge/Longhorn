/**
 * Dealer Repairs Routes (经销商维修单)
 * Three-Layer Ticket Model - Layer 3
 * ID Format: SVC-D-YYMM-XXXX (e.g., SVC-D-2602-0001)
 */

const express = require('express');

module.exports = function (db, authenticate, serviceUpload) {
    const router = express.Router();

    // ==============================
    // Helper Functions
    // ==============================

    /**
     * Generate Dealer Repair Number
     * Format: SVC-D-YYMM-XXXX (e.g., SVC-D-2602-0001)
     */
    function generateTicketNumber(db) {
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yearMonth = yy + mm; // "2602"

        const existing = db.prepare(`
            SELECT last_sequence FROM dealer_repair_sequences WHERE year_month = ?
        `).get(yearMonth);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare('UPDATE dealer_repair_sequences SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE year_month = ?')
                .run(seq, yearMonth);
        } else {
            seq = 1;
            db.prepare('INSERT INTO dealer_repair_sequences (year_month, last_sequence) VALUES (?, ?)')
                .run(yearMonth, seq);
        }

        // Support hex for overflow (>9999)
        const seqStr = seq <= 9999
            ? String(seq).padStart(4, '0')
            : seq.toString(16).toUpperCase().padStart(4, '0');

        return `SVC-D-${yearMonth}-${seqStr}`;
    }

    function formatListItem(repair) {
        return {
            id: repair.id,
            ticket_number: repair.ticket_number,
            dealer: repair.dealer_name ? { id: repair.dealer_id, name: repair.dealer_name } : null,
            customer_name: repair.customer_name,
            product: repair.product_name ? { id: repair.product_id, name: repair.product_name } : null,
            serial_number: repair.serial_number,
            issue_category: repair.issue_category,
            repair_content: repair.repair_content,
            status: repair.status,
            created_at: repair.created_at ? new Date(repair.created_at.replace(' ', 'T')).toISOString() : null
        };
    }

    function formatDetail(repair) {
        return {
            id: repair.id,
            ticket_number: repair.ticket_number,

            // Dealer Info
            dealer: repair.dealer_name ? { id: repair.dealer_id, name: repair.dealer_name } : null,

            // Customer Info
            customer_name: repair.customer_name,
            customer_contact: repair.customer_contact,
            customer_id: repair.customer_id,

            // Product Info
            product: repair.product_name ? { id: repair.product_id, name: repair.product_name } : null,
            serial_number: repair.serial_number,

            // Repair Info
            issue_category: repair.issue_category,
            issue_subcategory: repair.issue_subcategory,
            problem_description: repair.problem_description,
            repair_content: repair.repair_content,

            // Related Inquiry Ticket
            inquiry_ticket: repair.inquiry_ticket_number ? {
                id: repair.inquiry_ticket_id,
                ticket_number: repair.inquiry_ticket_number
            } : null,

            // Status
            status: repair.status,

            // Timestamps
            created_at: repair.created_at ? new Date(repair.created_at.replace(' ', 'T')).toISOString() : null,
            updated_at: repair.updated_at ? new Date(repair.updated_at.replace(' ', 'T')).toISOString() : null
        };
    }

    // ==============================
    // Routes
    // ==============================

    /**
     * GET /api/v1/dealer-repairs/stats
     * Get dashboard statistics for dealer repairs
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
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            const stats = db.prepare(`
                SELECT status, COUNT(*) as count 
                FROM dealer_repairs ${whereClause}
                GROUP BY status
            `).all(...params);

            const totalRow = db.prepare(`
                SELECT COUNT(*) as total FROM dealer_repairs ${whereClause}
            `).get(...params);

            const result = {
                total: totalRow.total,
                by_status: {}
            };
            stats.forEach(s => { result.by_status[s.status] = s.count; });

            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Error getting dealer repair stats:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * GET /api/v1/dealer-repairs
     * List dealer repairs with filtering and pagination
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 20,
                dealer_id,
                product_id,
                created_from,
                created_to,
                keyword
            } = req.query;

            const user = req.user;
            let conditions = [];
            let params = [];

            // Role-based filtering
            if (user.user_type === 'Dealer') {
                conditions.push('r.dealer_id = ?');
                params.push(user.dealer_id);
            }

            // Filter conditions
            if (dealer_id) {
                conditions.push('r.dealer_id = ?');
                params.push(dealer_id);
            }
            if (product_id) {
                conditions.push('r.product_id = ?');
                params.push(product_id);
            }
            if (created_from) {
                conditions.push('date(r.created_at) >= ?');
                params.push(created_from);
            }
            if (created_to) {
                conditions.push('date(r.created_at) <= ?');
                params.push(created_to);
            }
            if (keyword) {
                conditions.push(`(
                    r.ticket_number LIKE ? OR 
                    r.customer_name LIKE ? OR 
                    r.serial_number LIKE ?
                )`);
                const term = `%${keyword}%`;
                params.push(term, term, term);
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            // Count
            const countResult = db.prepare(`
                SELECT COUNT(*) as total FROM dealer_repairs r ${whereClause}
            `).get(...params);

            // Paginate
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const repairs = db.prepare(`
                SELECT 
                    r.*,
                    d.name as dealer_name,
                    p.model_name as product_name
                FROM dealer_repairs r
                LEFT JOIN dealers d ON r.dealer_id = d.id
                LEFT JOIN products p ON r.product_id = p.id
                ${whereClause}
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: repairs.map(formatListItem),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total: countResult.total
                }
            });
        } catch (error) {
            console.error('Error listing dealer repairs:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * GET /api/v1/dealer-repairs/:id
     * Get single dealer repair detail
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const repair = db.prepare(`
                SELECT 
                    r.*,
                    d.name as dealer_name,
                    p.model_name as product_name,
                    inq.ticket_number as inquiry_ticket_number
                FROM dealer_repairs r
                LEFT JOIN dealers d ON r.dealer_id = d.id
                LEFT JOIN products p ON r.product_id = p.id
                LEFT JOIN inquiry_tickets inq ON r.inquiry_ticket_id = inq.id
                WHERE r.id = ?
            `).get(req.params.id);

            if (!repair) {
                return res.status(404).json({ success: false, error: { message: 'Repair record not found' } });
            }

            // Get parts used
            const parts = db.prepare(`
                SELECT * FROM dealer_repair_parts WHERE dealer_repair_id = ?
            `).all(req.params.id);

            // Get attachments
            const attachments = db.prepare(`
                SELECT id, file_name, file_path, file_size, file_type, uploaded_at
                FROM service_attachments
                WHERE ticket_type = 'DealerRepair' AND ticket_id = ?
            `).all(req.params.id);

            const detailResponse = formatDetail(repair);
            detailResponse.parts_used = parts.map(p => ({
                part_id: p.part_id,
                part_name: p.part_name,
                quantity: p.quantity,
                unit_price: p.unit_price
            }));
            detailResponse.attachments = attachments;

            res.json({ success: true, data: detailResponse });
        } catch (error) {
            console.error('Error getting dealer repair:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * POST /api/v1/dealer-repairs
     * Create new dealer repair
     */
    router.post('/', authenticate, serviceUpload.array('attachments'), (req, res) => {
        try {
            const {
                dealer_id,
                customer_name,
                customer_contact,
                customer_id,
                product_id,
                serial_number,
                issue_category,
                issue_subcategory,
                problem_description,
                repair_content,
                parts_used,
                inquiry_ticket_id
            } = req.body;

            if (!dealer_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '经销商ID不能为空' }
                });
            }

            const ticketNumber = generateTicketNumber(db);

            const result = db.prepare(`
                INSERT INTO dealer_repairs (
                    ticket_number, dealer_id, customer_name, customer_contact, customer_id,
                    product_id, serial_number, issue_category, issue_subcategory,
                    problem_description, repair_content, inquiry_ticket_id, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed')
            `).run(
                ticketNumber, dealer_id, customer_name, customer_contact, customer_id,
                product_id, serial_number, issue_category, issue_subcategory,
                problem_description, repair_content, inquiry_ticket_id
            );

            const repairId = result.lastInsertRowid;

            // Handle attachments
            if (req.files && req.files.length > 0) {
                const insertAttachment = db.prepare(`
                    INSERT INTO service_attachments (
                        ticket_type, ticket_id, file_name, file_path, 
                        file_size, file_type, uploaded_by
                    ) VALUES ('DealerRepair', ?, ?, ?, ?, ?, ?)
                `);

                for (const file of req.files) {
                    insertAttachment.run(
                        repairId,
                        file.originalname,
                        `/uploads/service/${file.filename}`,
                        file.size,
                        file.mimetype,
                        req.user.id
                    );
                }
            }

            // Insert parts used
            const partsConsumed = [];
            if (parts_used && Array.isArray(parts_used)) {
                for (const part of parts_used) {
                    db.prepare(`
                        INSERT INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(repairId, part.part_id, part.part_name, part.quantity || 1, part.unit_price || 0);

                    partsConsumed.push({
                        part_name: part.part_name,
                        quantity: part.quantity || 1,
                        price_usd: part.unit_price || 0
                    });
                }
            }

            if (inquiry_ticket_id) {
                db.prepare(`
                    UPDATE inquiry_tickets 
                    SET status = 'Upgraded', 
                        upgraded_to_type = 'svc',
                        upgraded_to_id = ?,
                        upgraded_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(repairId, inquiry_ticket_id);
            }

            res.status(201).json({
                success: true,
                data: {
                    id: repairId,
                    ticket_number: ticketNumber,
                    dealer_id: dealer_id,
                    status: 'Completed',
                    parts_consumed: partsConsumed,
                    created_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error creating dealer repair:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * PATCH /api/v1/dealer-repairs/:id
     * Update dealer repair
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { repair_content, parts_used } = req.body;

            const updates = [];
            const params = [];

            if (repair_content !== undefined) {
                updates.push('repair_content = ?');
                params.push(repair_content);
            }

            if (updates.length > 0) {
                updates.push('updated_at = CURRENT_TIMESTAMP');
                params.push(id);
                db.prepare(`UPDATE dealer_repairs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
            }

            // Update parts if provided
            if (parts_used && Array.isArray(parts_used)) {
                // Delete existing parts
                db.prepare('DELETE FROM dealer_repair_parts WHERE dealer_repair_id = ?').run(id);

                // Insert new parts
                for (const part of parts_used) {
                    db.prepare(`
                        INSERT INTO dealer_repair_parts (dealer_repair_id, part_id, part_name, quantity, unit_price)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(id, part.part_id, part.part_name, part.quantity || 1, part.unit_price || 0);
                }
            }

            const updated = db.prepare('SELECT * FROM dealer_repairs WHERE id = ?').get(id);
            res.json({ success: true, data: formatDetail(updated) });
        } catch (error) {
            console.error('Error updating dealer repair:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    /**
     * DELETE /api/v1/dealer-repairs/:id
     * Delete dealer repair (admin only)
     */
    router.delete('/:id', authenticate, (req, res) => {
        try {
            if (req.user.role !== 'Admin') {
                return res.status(403).json({ success: false, error: { message: 'Permission denied' } });
            }

            // Delete parts first
            db.prepare('DELETE FROM dealer_repair_parts WHERE dealer_repair_id = ?').run(req.params.id);

            const result = db.prepare('DELETE FROM dealer_repairs WHERE id = ?').run(req.params.id);

            if (result.changes === 0) {
                return res.status(404).json({ success: false, error: { message: 'Repair record not found' } });
            }

            res.json({ success: true, data: { deleted: true } });
        } catch (error) {
            console.error('Error deleting dealer repair:', error);
            res.status(500).json({ success: false, error: { message: error.message } });
        }
    });

    return router;
};
