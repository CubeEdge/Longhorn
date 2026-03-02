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
                    (SELECT COUNT(*) FROM tickets WHERE product_id = p.id AND ticket_type = 'inquiry') as inquiry_count,
                    (SELECT COUNT(*) FROM tickets WHERE product_id = p.id AND ticket_type = 'rma') as rma_count,
                    (SELECT COUNT(*) FROM tickets WHERE product_id = p.id AND ticket_type = 'svc') as repair_count
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
                SELECT COUNT(*) as count FROM tickets WHERE product_id = ? AND ticket_type = 'inquiry'
            `).get(productId);

            const rmaCount = db.prepare(`
                SELECT COUNT(*) as count FROM tickets WHERE product_id = ? AND ticket_type = 'rma'
            `).get(productId);

            const repairCount = db.prepare(`
                SELECT COUNT(*) as count FROM tickets WHERE product_id = ? AND ticket_type = 'svc'
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
     * Create new product (Installed Base)
     */
    router.post('/', authenticate, requireAdmin, (req, res) => {
        try {
            const {
                // Basic info
                model_name,
                internal_name,
                product_family,
                product_line,
                serial_number,
                product_sku,
                product_type = 'CAMERA',
                firmware_version,
                description,
                is_active = true,
                // IoT
                is_iot_device = false,
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
                warranty_status = 'ACTIVE'
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

            // Calculate warranty end date if start date provided
            let warranty_end_date = null;
            if (warranty_start_date && warranty_months) {
                const start = new Date(warranty_start_date);
                const end = new Date(start);
                end.setMonth(end.getMonth() + parseInt(warranty_months));
                warranty_end_date = end.toISOString().split('T')[0];
            }

            const result = db.prepare(`
                INSERT INTO products (
                    model_name, internal_name, product_family, product_line,
                    serial_number, product_sku, product_type,
                    firmware_version, description, is_active,
                    is_iot_device, sales_channel, sold_to_dealer_id, ship_to_dealer_date,
                    current_owner_id, registration_date, sales_invoice_date,
                    warranty_start_date, warranty_months, warranty_end_date, warranty_status,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
                model_name,
                internal_name || model_name,
                product_family,
                product_line || '',
                serial_number || null,
                product_sku || null,
                product_type,
                firmware_version || '',
                description || '',
                is_active ? 1 : 0,
                is_iot_device ? 1 : 0,
                sales_channel,
                sold_to_dealer_id || null,
                ship_to_dealer_date || null,
                current_owner_id || null,
                registration_date || null,
                sales_invoice_date || null,
                warranty_start_date || null,
                warranty_months,
                warranty_end_date,
                warranty_status
            );

            const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);

            res.status(201).json({
                success: true,
                data: { 
                    ...newProduct, 
                    is_active: !!newProduct.is_active,
                    is_iot_device: !!newProduct.is_iot_device
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
                internal_name,
                product_family,
                product_line,
                serial_number,
                product_sku,
                product_type,
                firmware_version,
                description,
                is_active,
                // IoT
                is_iot_device,
                is_activated,
                activation_date,
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
                warranty_source,
                warranty_start_date,
                warranty_months,
                warranty_status
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
            addUpdate('internal_name', internal_name);
            addUpdate('serial_number', serial_number);
            addUpdate('product_sku', product_sku);
            addUpdate('product_type', product_type);
            addUpdate('product_line', product_line);
            addUpdate('firmware_version', firmware_version);
            addUpdate('description', description);
            
            if (is_active !== undefined) {
                updates.push('is_active = ?');
                params.push(is_active ? 1 : 0);
            }

            // Product family with cascade
            if (product_family !== undefined) {
                if (!['A', 'B', 'C', 'D'].includes(product_family)) {
                    return res.status(400).json({
                        success: false,
                        error: { code: 'VALIDATION_ERROR', message: 'Valid product family (A/B/C/D) is required' }
                    });
                }
                updates.push('product_family = ?');
                params.push(product_family);
                db.prepare(`UPDATE tickets SET product_family = ? WHERE product_id = ?`).run(product_family, productId);
            }

            // IoT fields
            if (is_iot_device !== undefined) {
                updates.push('is_iot_device = ?');
                params.push(is_iot_device ? 1 : 0);
            }
            if (is_activated !== undefined) {
                updates.push('is_activated = ?');
                params.push(is_activated ? 1 : 0);
            }
            addUpdate('activation_date', activation_date);

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
            addUpdate('warranty_source', warranty_source);
            addUpdate('warranty_start_date', warranty_start_date);
            if (warranty_months !== undefined) {
                updates.push('warranty_months = ?');
                params.push(warranty_months);
            }
            addUpdate('warranty_status', warranty_status);

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

            const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);

            res.json({
                success: true,
                data: { 
                    ...updated, 
                    is_active: !!updated.is_active,
                    is_iot_device: !!updated.is_iot_device,
                    is_activated: !!updated.is_activated
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

            // Get all related tickets
            const tickets = db.prepare(`
                SELECT 
                    CASE 
                        WHEN ticket_type = 'inquiry' THEN 'Inquiry'
                        WHEN ticket_type = 'rma' THEN 'RMA'
                        WHEN ticket_type = 'svc' THEN 'DealerRepair'
                        ELSE ticket_type
                    END as ticket_type,
                    id, ticket_number, status, created_at,
                    contact_name,
                    COALESCE(problem_summary, problem_description, title) as summary
                FROM tickets WHERE product_id = ?
                ORDER BY created_at DESC
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
