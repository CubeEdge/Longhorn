/**
 * Parts and Quotation Routes
 * Parts catalog and repair quotation management
 * Phase 4: Repair management
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    // =====================
    // Parts Catalog
    // =====================

    /**
     * GET /api/v1/parts
     * List parts catalog
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 50,
                category,
                search,
                product_model,
                is_active = '1'
            } = req.query;

            let conditions = [];
            let params = [];

            if (is_active !== 'all') {
                conditions.push('pc.is_active = ?');
                params.push(is_active === '1' ? 1 : 0);
            }
            if (category) {
                conditions.push('pc.category = ?');
                params.push(category);
            }
            if (search) {
                conditions.push(`(pc.part_number LIKE ? OR pc.part_name LIKE ? OR pc.part_name_en LIKE ?)`);
                const term = `%${search}%`;
                params.push(term, term, term);
            }
            if (product_model) {
                conditions.push('pc.applicable_products LIKE ?');
                params.push(`%"${product_model}"%`);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`SELECT COUNT(*) as total FROM parts_catalog pc ${whereClause}`).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const parts = db.prepare(`
                SELECT * FROM parts_catalog pc
                ${whereClause}
                ORDER BY pc.category, pc.part_name
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: parts.map(formatPart),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Parts] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/parts/:id
     * Get part detail
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const part = db.prepare('SELECT * FROM parts_catalog WHERE id = ?').get(req.params.id);
            if (!part) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '配件不存在' }
                });
            }

            res.json({
                success: true,
                data: formatPart(part)
            });
        } catch (err) {
            console.error('[Parts] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/parts
     * Create new part (Admin/Lead only)
     */
    router.post('/', authenticate, (req, res) => {
        try {
            if (!['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '权限不足' }
                });
            }

            const {
                part_number,
                part_name,
                part_name_en,
                description,
                category,
                subcategory,
                applicable_products = [],
                cost_price = 0,
                retail_price = 0,
                dealer_price = 0,
                min_stock_level = 0,
                reorder_quantity = 1,
                lead_time_days = 7,
                is_sellable = true
            } = req.body;

            if (!part_number || !part_name || !category) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必填字段' }
                });
            }

            const result = db.prepare(`
                INSERT INTO parts_catalog (
                    part_number, part_name, part_name_en, description,
                    category, subcategory, applicable_products,
                    cost_price, retail_price, dealer_price,
                    min_stock_level, reorder_quantity, lead_time_days,
                    is_sellable
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                part_number, part_name, part_name_en || null, description || null,
                category, subcategory || null, JSON.stringify(applicable_products),
                cost_price, retail_price, dealer_price,
                min_stock_level, reorder_quantity, lead_time_days,
                is_sellable ? 1 : 0
            );

            res.status(201).json({
                success: true,
                data: { id: result.lastInsertRowid, part_number }
            });
        } catch (err) {
            console.error('[Parts] Create error:', err);
            if (err.message.includes('UNIQUE constraint')) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'DUPLICATE', message: '配件编号已存在' }
                });
            }
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // =====================
    // Quotations
    // =====================

    /**
     * GET /api/v1/parts/quotations
     * List quotations
     */
    router.get('/quotations/list', authenticate, (req, res) => {
        try {
            const { page = 1, page_size = 20, status, issue_id } = req.query;

            let conditions = [];
            let params = [];

            if (status) {
                conditions.push('rq.status = ?');
                params.push(status);
            }
            if (issue_id) {
                conditions.push('rq.issue_id = ?');
                params.push(issue_id);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`SELECT COUNT(*) as total FROM repair_quotations rq ${whereClause}`).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const quotations = db.prepare(`
                SELECT rq.*, i.issue_number, u.username as created_by_name
                FROM repair_quotations rq
                LEFT JOIN issues i ON rq.issue_id = i.id
                LEFT JOIN users u ON rq.created_by = u.id
                ${whereClause}
                ORDER BY rq.created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: quotations.map(q => ({
                    id: q.id,
                    quotation_number: q.quotation_number,
                    issue_id: q.issue_id,
                    issue_number: q.issue_number,
                    customer_name: q.customer_name,
                    total_amount: q.total_amount,
                    currency: q.currency,
                    status: q.status,
                    is_warranty: !!q.is_warranty,
                    valid_until: q.valid_until,
                    created_by: q.created_by_name,
                    created_at: q.created_at
                })),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Parts] Quotations list error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/parts/quotations
     * Create quotation for an issue
     */
    router.post('/quotations', authenticate, (req, res) => {
        try {
            const {
                issue_id,
                diagnosis,
                repair_description,
                line_items = [],
                labor_hours = 0,
                labor_rate_type = 'Basic',
                shipping_cost = 0,
                other_cost = 0,
                discount_amount = 0,
                discount_reason,
                is_warranty = false,
                warranty_notes,
                currency = 'RMB',
                valid_days = 30
            } = req.body;

            if (!issue_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少工单ID' }
                });
            }

            // Get issue and customer info
            const issue = db.prepare(`
                SELECT i.*, c.customer_name, c.email as customer_email
                FROM issues i
                LEFT JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `).get(issue_id);

            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '工单不存在' }
                });
            }

            // Generate quotation number
            const quotation_number = generateQuotationNumber(db);

            // Calculate labor cost
            const laborRate = db.prepare(`
                SELECT hourly_rate FROM labor_rates 
                WHERE rate_type = ? AND is_active = 1 AND region = ?
            `).get(labor_rate_type, issue.region === '国内' ? 'Domestic' : 'Overseas');
            const labor_cost = (laborRate?.hourly_rate || 0) * labor_hours;

            // Calculate parts total
            let parts_total = 0;
            for (const item of line_items) {
                if (item.item_type === 'Part') {
                    parts_total += (item.unit_price || 0) * (item.quantity || 1);
                }
            }

            const total_amount = parts_total + labor_cost + shipping_cost + other_cost - discount_amount;

            // Create quotation
            const validUntil = new Date();
            validUntil.setDate(validUntil.getDate() + valid_days);

            const result = db.prepare(`
                INSERT INTO repair_quotations (
                    quotation_number, issue_id,
                    customer_name, customer_email,
                    diagnosis, repair_description,
                    parts_total, labor_cost, shipping_cost, other_cost,
                    discount_amount, discount_reason, total_amount,
                    currency, is_warranty, warranty_notes,
                    status, valid_until, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)
            `).run(
                quotation_number, issue_id,
                issue.customer_name || issue.reporter_name, issue.customer_email,
                diagnosis || null, repair_description || null,
                parts_total, labor_cost, shipping_cost, other_cost,
                discount_amount, discount_reason || null, total_amount,
                currency, is_warranty ? 1 : 0, warranty_notes || null,
                validUntil.toISOString().slice(0, 10), req.user.id
            );

            const quotationId = result.lastInsertRowid;

            // Insert line items
            for (const item of line_items) {
                db.prepare(`
                    INSERT INTO quotation_line_items (quotation_id, item_type, part_id, description, quantity, unit_price, total_price, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    quotationId,
                    item.item_type,
                    item.part_id || null,
                    item.description,
                    item.quantity || 1,
                    item.unit_price || 0,
                    (item.unit_price || 0) * (item.quantity || 1),
                    item.notes || null
                );
            }

            // Add labor line item if applicable
            if (labor_hours > 0 && laborRate) {
                db.prepare(`
                    INSERT INTO quotation_line_items (quotation_id, item_type, description, quantity, unit_price, total_price)
                    VALUES (?, 'Labor', ?, ?, ?, ?)
                `).run(quotationId, `${labor_rate_type} 维修工时`, labor_hours, laborRate.hourly_rate, labor_cost);
            }

            res.status(201).json({
                success: true,
                data: {
                    id: quotationId,
                    quotation_number,
                    total_amount,
                    currency,
                    valid_until: validUntil.toISOString().slice(0, 10)
                }
            });
        } catch (err) {
            console.error('[Parts] Create quotation error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/parts/quotations/:id
     * Get quotation detail
     */
    router.get('/quotations/:id', authenticate, (req, res) => {
        try {
            const quotation = db.prepare(`
                SELECT rq.*, i.issue_number, i.rma_number,
                       u.username as created_by_name,
                       approver.username as approved_by_name
                FROM repair_quotations rq
                LEFT JOIN issues i ON rq.issue_id = i.id
                LEFT JOIN users u ON rq.created_by = u.id
                LEFT JOIN users approver ON rq.approved_by = approver.id
                WHERE rq.id = ?
            `).get(req.params.id);

            if (!quotation) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '报价单不存在' }
                });
            }

            const lineItems = db.prepare(`
                SELECT qli.*, pc.part_number, pc.part_name
                FROM quotation_line_items qli
                LEFT JOIN parts_catalog pc ON qli.part_id = pc.id
                WHERE qli.quotation_id = ?
                ORDER BY qli.item_type, qli.id
            `).all(req.params.id);

            res.json({
                success: true,
                data: {
                    id: quotation.id,
                    quotation_number: quotation.quotation_number,
                    issue: {
                        id: quotation.issue_id,
                        issue_number: quotation.issue_number,
                        rma_number: quotation.rma_number
                    },
                    customer_name: quotation.customer_name,
                    customer_email: quotation.customer_email,
                    diagnosis: quotation.diagnosis,
                    repair_description: quotation.repair_description,
                    line_items: lineItems.map(li => ({
                        id: li.id,
                        item_type: li.item_type,
                        part: li.part_id ? { id: li.part_id, number: li.part_number, name: li.part_name } : null,
                        description: li.description,
                        quantity: li.quantity,
                        unit_price: li.unit_price,
                        total_price: li.total_price,
                        notes: li.notes
                    })),
                    pricing: {
                        parts_total: quotation.parts_total,
                        labor_cost: quotation.labor_cost,
                        shipping_cost: quotation.shipping_cost,
                        other_cost: quotation.other_cost,
                        discount_amount: quotation.discount_amount,
                        discount_reason: quotation.discount_reason,
                        total_amount: quotation.total_amount
                    },
                    currency: quotation.currency,
                    is_warranty: !!quotation.is_warranty,
                    warranty_notes: quotation.warranty_notes,
                    status: quotation.status,
                    valid_until: quotation.valid_until,
                    customer_response: quotation.customer_response,
                    customer_notes: quotation.customer_notes,
                    responded_at: quotation.responded_at,
                    created_by: { id: quotation.created_by, name: quotation.created_by_name },
                    approved_by: quotation.approved_by ? { id: quotation.approved_by, name: quotation.approved_by_name } : null,
                    created_at: quotation.created_at,
                    updated_at: quotation.updated_at
                }
            });
        } catch (err) {
            console.error('[Parts] Quotation detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/parts/quotations/:id/status
     * Update quotation status
     */
    router.patch('/quotations/:id/status', authenticate, (req, res) => {
        try {
            const { status, notes } = req.body;
            
            if (!['Sent', 'Approved', 'Rejected', 'Expired'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_STATUS', message: '无效的状态' }
                });
            }

            const quotation = db.prepare('SELECT * FROM repair_quotations WHERE id = ?').get(req.params.id);
            if (!quotation) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '报价单不存在' }
                });
            }

            const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
            const params = [status];

            if (status === 'Approved') {
                updates.push('approved_by = ?', 'customer_response = ?', 'responded_at = CURRENT_TIMESTAMP');
                params.push(req.user.id, 'Approved');
            } else if (status === 'Rejected') {
                updates.push('customer_response = ?', 'customer_notes = ?', 'responded_at = CURRENT_TIMESTAMP');
                params.push('Rejected', notes || null);
            }

            params.push(req.params.id);
            db.prepare(`UPDATE repair_quotations SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), status }
            });
        } catch (err) {
            console.error('[Parts] Update quotation status error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/parts/estimate
     * Quick estimate for repair (rule-engine based)
     */
    router.post('/estimate', authenticate, (req, res) => {
        try {
            const {
                part_ids = [],
                labor_hours = 0,
                labor_rate_type = 'Basic',
                region = 'Domestic',
                shipping_required = false,
                from_region,
                to_region
            } = req.body;

            // Calculate parts cost
            let parts_total = 0;
            const parts = [];
            for (const partId of part_ids) {
                const part = db.prepare('SELECT * FROM parts_catalog WHERE id = ? AND is_active = 1').get(partId);
                if (part) {
                    parts_total += part.retail_price;
                    parts.push({
                        id: part.id,
                        part_number: part.part_number,
                        part_name: part.part_name,
                        price: part.retail_price
                    });
                }
            }

            // Calculate labor cost
            const laborRate = db.prepare(`
                SELECT hourly_rate FROM labor_rates 
                WHERE rate_type = ? AND is_active = 1 AND region = ?
            `).get(labor_rate_type, region);
            const labor_cost = (laborRate?.hourly_rate || 0) * labor_hours;

            // Calculate shipping cost
            let shipping_cost = 0;
            if (shipping_required && from_region && to_region) {
                const shippingRate = db.prepare(`
                    SELECT * FROM shipping_rates 
                    WHERE from_region = ? AND to_region = ? AND is_active = 1
                    ORDER BY base_rate ASC LIMIT 1
                `).get(from_region, to_region);
                shipping_cost = shippingRate?.base_rate || 0;
            }

            const total_estimate = parts_total + labor_cost + shipping_cost;

            res.json({
                success: true,
                data: {
                    parts: {
                        items: parts,
                        total: parts_total
                    },
                    labor: {
                        hours: labor_hours,
                        rate_type: labor_rate_type,
                        hourly_rate: laborRate?.hourly_rate || 0,
                        total: labor_cost
                    },
                    shipping: {
                        required: shipping_required,
                        cost: shipping_cost
                    },
                    total_estimate,
                    currency: region === 'Domestic' ? 'RMB' : 'USD',
                    note: '此为初步估算，实际报价可能因具体情况调整'
                }
            });
        } catch (err) {
            console.error('[Parts] Estimate error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // Helper functions
    function formatPart(part) {
        let applicableProducts = [];
        try { applicableProducts = JSON.parse(part.applicable_products || '[]'); } catch (e) {}

        return {
            id: part.id,
            part_number: part.part_number,
            part_name: part.part_name,
            part_name_en: part.part_name_en,
            description: part.description,
            category: part.category,
            subcategory: part.subcategory,
            applicable_products: applicableProducts,
            pricing: {
                cost: part.cost_price,
                retail: part.retail_price,
                dealer: part.dealer_price
            },
            stock: {
                min_level: part.min_stock_level,
                reorder_qty: part.reorder_quantity,
                lead_time_days: part.lead_time_days
            },
            is_active: !!part.is_active,
            is_sellable: !!part.is_sellable,
            updated_at: part.updated_at
        };
    }

    function generateQuotationNumber(db) {
        const today = new Date();
        const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');
        
        const existing = db.prepare('SELECT last_sequence FROM quotation_sequences WHERE date_key = ?').get(dateKey);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare('UPDATE quotation_sequences SET last_sequence = ? WHERE date_key = ?').run(seq, dateKey);
        } else {
            seq = 1;
            db.prepare('INSERT INTO quotation_sequences (date_key, last_sequence) VALUES (?, ?)').run(dateKey, seq);
        }

        return `QT-${dateKey}-${String(seq).padStart(3, '0')}`;
    }

    return router;
};
