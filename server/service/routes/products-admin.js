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
                is_active
            } = req.query;

            let conditions = [];
            let params = [];

            // Product family filtering
            if (product_family && product_family !== 'all') {
                conditions.push('p.product_family = ?');
                params.push(product_family);
            }

            // Active status filtering
            if (is_active !== undefined) {
                conditions.push('p.is_active = ?');
                params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
            }

            // Keyword filtering (model_name or internal_name)
            if (keyword) {
                conditions.push(`(p.model_name LIKE ? OR p.internal_name LIKE ?)`);
                const term = `%${keyword}%`;
                params.push(term, term);
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            // Count total
            const countResult = db.prepare(`
                SELECT COUNT(*) as total FROM products p ${whereClause}
            `).get(...params);

            // Paginate
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const products = db.prepare(`
                SELECT 
                    p.*,
                    (SELECT COUNT(*) FROM inquiry_tickets WHERE product_id = p.id) as inquiry_count,
                    (SELECT COUNT(*) FROM rma_tickets WHERE product_id = p.id) as rma_count,
                    (SELECT COUNT(*) FROM dealer_repairs WHERE product_id = p.id) as repair_count
                FROM products p
                ${whereClause}
                ORDER BY 
                    CASE p.product_family 
                        WHEN 'A' THEN 1 
                        WHEN 'B' THEN 2 
                        WHEN 'C' THEN 3 
                        WHEN 'D' THEN 4 
                        ELSE 5 
                    END,
                    p.model_name ASC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: products.map(p => ({
                    ...p,
                    is_active: !!p.is_active,
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
                SELECT COUNT(*) as count FROM inquiry_tickets WHERE product_id = ?
            `).get(productId);

            const rmaCount = db.prepare(`
                SELECT COUNT(*) as count FROM rma_tickets WHERE product_id = ?
            `).get(productId);

            const repairCount = db.prepare(`
                SELECT COUNT(*) as count FROM dealer_repairs WHERE product_id = ?
            `).get(productId);

            res.json({
                success: true,
                data: {
                    ...product,
                    is_active: !!product.is_active,
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
     * Create new product
     */
    router.post('/', authenticate, requireAdmin, (req, res) => {
        try {
            const {
                model_name,
                internal_name,
                product_family,
                product_line,
                firmware_version,
                description,
                is_active = true
            } = req.body;

            if (!model_name) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Model name is required' }
                });
            }

            if (!product_family || !['A', 'B', 'C', 'D'].includes(product_family)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Valid product family (A/B/C/D) is required' }
                });
            }

            const result = db.prepare(`
                INSERT INTO products (
                    model_name, internal_name, product_family, product_line,
                    firmware_version, description, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
                model_name,
                internal_name || model_name,
                product_family,
                product_line || '',
                firmware_version || '',
                description || '',
                is_active ? 1 : 0
            );

            const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);

            res.status(201).json({
                success: true,
                data: { ...newProduct, is_active: !!newProduct.is_active }
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
     * Update product
     */
    router.put('/:id', authenticate, requireAdmin, (req, res) => {
        try {
            const productId = req.params.id;
            const {
                model_name,
                internal_name,
                product_family,
                product_line,
                firmware_version,
                description,
                is_active
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

            if (model_name !== undefined) {
                updates.push('model_name = ?');
                params.push(model_name);
            }
            if (internal_name !== undefined) {
                updates.push('internal_name = ?');
                params.push(internal_name);
            }
            if (product_family !== undefined) {
                if (!['A', 'B', 'C', 'D'].includes(product_family)) {
                    return res.status(400).json({
                        success: false,
                        error: { code: 'VALIDATION_ERROR', message: 'Valid product family (A/B/C/D) is required' }
                    });
                }
                updates.push('product_family = ?');
                params.push(product_family);

                // Cascade update to related tickets
                db.prepare(`
                    UPDATE inquiry_tickets SET product_family = ? WHERE product_id = ?
                `).run(product_family, productId);

                db.prepare(`
                    UPDATE rma_tickets SET product_family = ? WHERE product_id = ?
                `).run(product_family, productId);

                db.prepare(`
                    UPDATE dealer_repairs SET product_family = ? WHERE product_id = ?
                `).run(product_family, productId);
            }
            if (product_line !== undefined) {
                updates.push('product_line = ?');
                params.push(product_line);
            }
            if (firmware_version !== undefined) {
                updates.push('firmware_version = ?');
                params.push(firmware_version);
            }
            if (description !== undefined) {
                updates.push('description = ?');
                params.push(description);
            }
            if (is_active !== undefined) {
                updates.push('is_active = ?');
                params.push(is_active ? 1 : 0);
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

            const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);

            res.json({
                success: true,
                data: { ...updated, is_active: !!updated.is_active }
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
                SELECT COUNT(*) as count FROM inquiry_tickets WHERE product_id = ?
            `).get(productId);

            const rmaCount = db.prepare(`
                SELECT COUNT(*) as count FROM rma_tickets WHERE product_id = ?
            `).get(productId);

            const repairCount = db.prepare(`
                SELECT COUNT(*) as count FROM dealer_repairs WHERE product_id = ?
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

            // Get all related tickets (union query)
            const tickets = db.prepare(`
                SELECT 
                    'Inquiry' as ticket_type,
                    id, ticket_number, status, created_at,
                    customer_name as contact_name,
                    problem_summary as summary
                FROM inquiry_tickets WHERE product_id = ?
                UNION ALL
                SELECT 
                    'RMA' as ticket_type,
                    id, ticket_number, status, created_at,
                    reporter_name as contact_name,
                    problem_description as summary
                FROM rma_tickets WHERE product_id = ?
                UNION ALL
                SELECT 
                    'DealerRepair' as ticket_type,
                    id, ticket_number, status, created_at,
                    customer_name as contact_name,
                    problem_description as summary
                FROM dealer_repairs WHERE product_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `).all(productId, productId, productId, parseInt(page_size), offset);

            // Count total
            const countResult = db.prepare(`
                SELECT 
                    (SELECT COUNT(*) FROM inquiry_tickets WHERE product_id = ?) +
                    (SELECT COUNT(*) FROM rma_tickets WHERE product_id = ?) +
                    (SELECT COUNT(*) FROM dealer_repairs WHERE product_id = ?) as total
            `).get(productId, productId, productId);

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
