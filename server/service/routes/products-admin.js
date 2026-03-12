/**
 * Products Admin Routes
 * CRUD API for product management (Admin/Lead only)
 */
const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    // Check if user is Admin or Lead
    const requireAdmin = (req, res, next) => {
        if (req.user.role !== 'Admin' && req.user.role !== 'Lead') {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Admin or Lead access required' }
            });
        }
        next();
    };

    /**
     * GET /api/v1/admin/products
     * List products with filtering and pagination
     */
    router.get('/', authenticate, requireAdmin, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 20,
                product_family,
                keyword,
                status
            } = req.query;

            let conditions = [];
            let params = [];

            // Product family filtering
            if (product_family && product_family !== 'all') {
                conditions.push('p.product_family = ?');
                params.push(product_family);
            }

            // Status filtering (ACTIVE/IN_REPAIR/STOLEN/SCRAPPED)
            if (status && status !== 'all') {
                conditions.push('p.status = ?');
                params.push(status);
            }

            // Keyword filtering (model_name or model_code or serial_number)
            if (keyword) {
                conditions.push(`(p.model_name LIKE ? OR pm.model_code LIKE ? OR p.serial_number LIKE ?)`);
                const term = `%${keyword}%`;
                params.push(term, term, term);
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            // Count total
            const countResult = db.prepare(`
                SELECT COUNT(*) as total 
                FROM products p 
                LEFT JOIN product_skus ps ON p.sku_id = ps.id
                LEFT JOIN product_models pm ON ps.model_id = pm.id
                ${whereClause}
            `).get(...params);

            // Paginate
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const products = db.prepare(`
                SELECT 
                    p.*,
                    ps.sku_code, ps.display_name as sku_name, ps.sku_image,
                    pm.hero_image, pm.brand,
                    (SELECT COUNT(*) FROM tickets WHERE product_id = p.id AND ticket_type = 'inquiry') as inquiry_count,
                    (SELECT COUNT(*) FROM tickets WHERE product_id = p.id AND ticket_type = 'rma') as rma_count,
                    (SELECT COUNT(*) FROM tickets WHERE product_id = p.id AND ticket_type = 'svc') as repair_count
                FROM products p
                LEFT JOIN product_skus ps ON p.sku_id = ps.id
                LEFT JOIN product_models pm ON ps.model_id = pm.id
                ${whereClause}
                ORDER BY 
                    CASE p.product_family 
                        WHEN 'A' THEN 1 
                        WHEN 'B' THEN 2 
                        WHEN 'C' THEN 3 
                        WHEN 'D' THEN 4 
                        ELSE 5 
                    END,
                    p.model_name ASC,
                    p.created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: products.map(p => ({
                    ...p,
                    status: p.status || 'ACTIVE',
                    ticket_count: (p.inquiry_count || 0) + (p.rma_count || 0) + (p.repair_count || 0)
                })),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total: countResult.total
                }
            });
        } catch (err) {
            console.error('[Products Admin] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/admin/products/:id
     * Get single product detail
     */
    router.get('/:id', authenticate, requireAdmin, (req, res) => {
        try {
            const productId = req.params.id;

            const product = db.prepare(`
                SELECT p.*
                FROM products p
                WHERE p.id = ?
            `).get(productId);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Product not found' }
                });
            }

            // Get related tickets summary
            const inquiryCount = db.prepare(`
                SELECT COUNT(*) as count FROM tickets WHERE product_id = ? AND ticket_type = 'inquiry'
            `).get(productId);

            const rmaCount = db.prepare(`
                SELECT COUNT(*) as count FROM tickets WHERE product_id = ? AND ticket_type = 'rma'
            `).get(productId);

            const repairCount = db.prepare(`
                SELECT COUNT(*) as count FROM tickets WHERE product_id = ? AND ticket_type = 'svc'
            `).get(productId);

            // Real-time warranty status correction logic
            let currentStatus = product.warranty_status;
            if (currentStatus === 'ACTIVE' && product.warranty_end_date) {
                const now = new Date();
                const end = new Date(product.warranty_end_date);
                if (end < now) {
                    currentStatus = 'EXPIRED';
                    // Auto-sync back to DB
                    db.prepare('UPDATE products SET warranty_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                        .run('EXPIRED', productId);
                }
            }

            res.json({
                success: true,
                data: {
                    ...product,
                    warranty_status: currentStatus,
                    status: product.status || 'ACTIVE',
                    ticket_summary: {
                        inquiry: inquiryCount.count,
                        rma: rmaCount.count,
                        dealer_repair: repairCount.count,
                        total: inquiryCount.count + rmaCount.count + repairCount.count
                    }
                }
            });
        } catch (err) {
            console.error('[Products Admin] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/admin/products
     * Create new product (Installed Base)
     */
    router.post('/', authenticate, requireAdmin, (req, res) => {
        try {
            const {
                // Basic info
                model_name,
                serial_number,
                product_sku,
                firmware_version,
                production_date,
                description,
                status = 'ACTIVE',
                // Sales trace
                sales_channel = 'DIRECT',
                sold_to_dealer_id,
                ship_to_dealer_date,
                // Ownership
                current_owner_id,
                registration_date,
                sales_invoice_date,
                // Warranty
                warranty_start_date,
                warranty_months = 24,
                // [v2.0] New fields
                sku_id,
                grade = 'A',
                specification,
                warehouse,
                entry_channel
            } = req.body;

            if (!model_name) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Model name is required' }
                });
            }

            if (!['ACTIVE', 'IN_REPAIR', 'STOLEN', 'SCRAPPED'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Valid status (ACTIVE/IN_REPAIR/STOLEN/SCRAPPED) is required' }
                });
            }

            // Calculate warranty end date if start date provided
            let warranty_end_date = null;
            let warranty_status = 'PENDING';
            if (warranty_start_date && warranty_months) {
                const start = new Date(warranty_start_date);
                const end = new Date(start);
                end.setMonth(end.getMonth() + parseInt(warranty_months));
                warranty_end_date = end.toISOString().split('T')[0];

                // Determine warranty status
                const now = new Date();
                warranty_status = end > now ? 'ACTIVE' : 'EXPIRED';
            }

            const result = db.prepare(`
                INSERT INTO products (
                    model_name, serial_number, product_sku,
                    firmware_version, production_date, description, status,
                    sales_channel, sold_to_dealer_id, ship_to_dealer_date,
                    current_owner_id, registration_date, sales_invoice_date,
                    warranty_start_date, warranty_months, warranty_end_date, warranty_status,
                    sku_id, grade, specification, warehouse, entry_channel,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
                model_name,
                serial_number || null,
                product_sku || null,
                firmware_version || null,
                production_date || null,
                description || null,
                status,
                sales_channel,
                sold_to_dealer_id || null,
                ship_to_dealer_date || null,
                current_owner_id || null,
                registration_date || null,
                sales_invoice_date || null,
                warranty_start_date || null,
                warranty_months,
                warranty_end_date,
                warranty_status,
                sku_id || null,
                grade,
                specification || null,
                warehouse || null,
                entry_channel || null
            );

            // Auto-upgrade account to ACTIVE if owner is provided
            if (current_owner_id) {
                db.prepare('UPDATE accounts SET lifecycle_stage = "ACTIVE" WHERE id = ? AND lifecycle_stage = "PROSPECT"').run(current_owner_id);
            }

            const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);

            res.status(201).json({
                success: true,
                data: {
                    ...newProduct,
                    status: newProduct.status || 'ACTIVE'
                }
            });
        } catch (err) {
            console.error('[Products Admin] Create error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PUT /api/v1/admin/products/:id
     * Update product (Installed Base)
     */
    router.put('/:id', authenticate, requireAdmin, (req, res) => {
        try {
            const productId = req.params.id;
            const {
                // Basic info
                model_name,
                serial_number,
                product_sku,
                firmware_version,
                production_date,
                description,
                status,
                // Sales trace
                sales_channel,
                original_order_id,
                sold_to_dealer_id,
                ship_to_dealer_date,
                // Ownership
                current_owner_id,
                registration_date,
                sales_invoice_date,
                sales_invoice_proof,
                // Warranty
                warranty_start_date,
                warranty_months,
                // [v2.0] New fields
                sku_id,
                grade,
                specification,
                warehouse,
                entry_channel
            } = req.body;

            // Check if product exists
            const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Product not found' }
                });
            }

            // Build updates
            const updates = [];
            const params = [];

            // Helper to add update
            const addUpdate = (field, value) => {
                if (value !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(value);
                }
            };

            // Basic fields
            addUpdate('model_name', model_name);
            addUpdate('serial_number', serial_number);
            addUpdate('product_sku', product_sku);
            addUpdate('firmware_version', firmware_version);
            addUpdate('production_date', production_date);
            addUpdate('description', description);

            // Status field (ACTIVE/IN_REPAIR/STOLEN/SCRAPPED)
            if (status !== undefined) {
                if (!['ACTIVE', 'IN_REPAIR', 'STOLEN', 'SCRAPPED'].includes(status)) {
                    return res.status(400).json({
                        success: false,
                        error: { code: 'VALIDATION_ERROR', message: 'Valid status (ACTIVE/IN_REPAIR/STOLEN/SCRAPPED) is required' }
                    });
                }
                updates.push('status = ?');
                params.push(status);
            }

            // Sales trace
            addUpdate('sales_channel', sales_channel);
            addUpdate('original_order_id', original_order_id);
            addUpdate('sold_to_dealer_id', sold_to_dealer_id);
            addUpdate('ship_to_dealer_date', ship_to_dealer_date);

            // Ownership
            addUpdate('current_owner_id', current_owner_id);
            addUpdate('registration_date', registration_date);
            addUpdate('sales_invoice_date', sales_invoice_date);
            addUpdate('sales_invoice_proof', sales_invoice_proof);

            // Warranty
            addUpdate('warranty_start_date', warranty_start_date);
            if (warranty_months !== undefined) {
                updates.push('warranty_months = ?');
                params.push(warranty_months);
            }

            // [v2.0] Add updates for new fields
            addUpdate('sku_id', sku_id);
            addUpdate('grade', grade);
            addUpdate('specification', specification);
            addUpdate('warehouse', warehouse);
            addUpdate('entry_channel', entry_channel);

            // Recalculate warranty end date if start date or months changed
            if (warranty_start_date !== undefined || warranty_months !== undefined) {
                const current = db.prepare('SELECT warranty_start_date, warranty_months FROM products WHERE id = ?').get(productId);
                const start = warranty_start_date !== undefined ? warranty_start_date : current.warranty_start_date;
                const months = warranty_months !== undefined ? parseInt(warranty_months) : current.warranty_months;

                if (start && months) {
                    const startDate = new Date(start);
                    const endDate = new Date(startDate);
                    endDate.setMonth(endDate.getMonth() + months);
                    updates.push('warranty_end_date = ?');
                    params.push(endDate.toISOString().split('T')[0]);
                }
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'No fields to update' }
                });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(productId);

            db.prepare(`
                UPDATE products SET ${updates.join(', ')} WHERE id = ?
            `).run(...params);

            // Auto-upgrade account to ACTIVE if owner is updated
            if (current_owner_id) {
                db.prepare('UPDATE accounts SET lifecycle_stage = "ACTIVE" WHERE id = ? AND lifecycle_stage = "PROSPECT"').run(current_owner_id);
            }

            const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);

            res.json({
                success: true,
                data: {
                    ...updated,
                    status: updated.status || 'ACTIVE'
                }
            });
        } catch (err) {
            console.error('[Products Admin] Update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * DELETE /api/v1/admin/products/:id
     * Delete product (soft delete - check for related tickets)
     */
    router.delete('/:id', authenticate, requireAdmin, (req, res) => {
        try {
            const productId = req.params.id;

            // Check if product exists
            const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Product not found' }
                });
            }

            // Check for related tickets
            const inquiryCount = db.prepare(`
                SELECT COUNT(*) as count FROM tickets WHERE product_id = ? AND ticket_type = 'inquiry'
            `).get(productId);

            const rmaCount = db.prepare(`
                SELECT COUNT(*) as count FROM tickets WHERE product_id = ? AND ticket_type = 'rma'
            `).get(productId);

            const repairCount = db.prepare(`
                SELECT COUNT(*) as count FROM tickets WHERE product_id = ? AND ticket_type = 'svc'
            `).get(productId);

            const totalTickets = inquiryCount.count + rmaCount.count + repairCount.count;

            if (totalTickets > 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'HAS_RELATED_TICKETS',
                        message: `Cannot delete product with ${totalTickets} related tickets`,
                        details: {
                            inquiry: inquiryCount.count,
                            rma: rmaCount.count,
                            dealer_repair: repairCount.count
                        }
                    }
                });
            }

            // Soft delete by setting is_active = false
            db.prepare(`
                UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(productId);

            res.json({
                success: true,
                data: { deleted: true }
            });
        } catch (err) {
            console.error('[Products Admin] Delete error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/admin/products/:id/detail
     * Get full product detail with ownership and warranty info (Installed Base)
     */
    router.get('/:id/detail', authenticate, requireAdmin, (req, res) => {
        try {
            const productId = req.params.id;

            // Get product with dealer and owner info
            const product = db.prepare(`
                SELECT 
                    p.*,
                    d.name as sold_to_dealer_name,
                    c.name as current_owner_name,
                    ps.sku_code, ps.display_name as sku_name, ps.sku_image, ps.spec_label, ps.display_name_en as sku_name_en,
                    pm.name_zh as model_display_name, pm.name_en as model_name_en, pm.hero_image, pm.brand
                FROM products p
                LEFT JOIN accounts d ON p.sold_to_dealer_id = d.id
                LEFT JOIN accounts c ON p.current_owner_id = c.id
                LEFT JOIN product_skus ps ON p.sku_id = ps.id
                LEFT JOIN product_models pm ON ps.model_id = pm.id
                WHERE p.id = ?
            `).get(productId);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Product not found' }
                });
            }

            // Get service stats
            const stats = db.prepare(`
                SELECT 
                    COUNT(CASE WHEN ticket_type = 'inquiry' THEN 1 END) as inquiry_count,
                    COUNT(CASE WHEN ticket_type = 'rma' THEN 1 END) as rma_count,
                    COUNT(CASE WHEN ticket_type = 'svc' THEN 1 END) as repair_count
                FROM tickets
                WHERE product_id = ?
            `).get(productId);

            res.json({
                success: true,
                data: {
                    ...product,
                    inquiry_count: stats?.inquiry_count || 0,
                    rma_count: stats?.rma_count || 0,
                    repair_count: stats?.repair_count || 0
                }
            });
        } catch (err) {
            console.error('[Products Admin] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/admin/products/:id/tickets
     * Get related tickets for a product
     */
    router.get('/:id/tickets', authenticate, requireAdmin, (req, res) => {
        try {
            const productId = req.params.id;
            const { page = 1, page_size = 20 } = req.query;

            // Check if product exists
            const product = db.prepare('SELECT model_name FROM products WHERE id = ?').get(productId);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Product not found' }
                });
            }

            const offset = (parseInt(page) - 1) * parseInt(page_size);

            // Get all related tickets with full details for card display
            const tickets = db.prepare(`
                SELECT 
                    t.id, 
                    t.ticket_number, 
                    t.ticket_type,
                    t.status, 
                    t.created_at,
                    t.problem_summary,
                    t.problem_description,
                    t.contact_name,
                    a.name as account_name
                FROM tickets t
                LEFT JOIN accounts a ON t.account_id = a.id
                WHERE t.product_id = ?
                ORDER BY t.created_at DESC
                LIMIT ? OFFSET ?
            `).all(productId, parseInt(page_size), offset);

            // Count total
            const countResult = db.prepare(`
                SELECT COUNT(*) as total FROM tickets WHERE product_id = ?
            `).get(productId);

            res.json({
                success: true,
                data: tickets.map(t => ({
                    ...t,
                    product_name: product.model_name
                })),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total: countResult.total
                }
            });
        } catch (err) {
            console.error('[Products Admin] Tickets error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    return router;
};
