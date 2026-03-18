/**
 * Product SKUs Admin Routes
 * CRUD API for product SKU management (Admin/Exec/MS Lead only)
 */
const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    // Check if user can manage product skus (Admin, Exec, or MS Lead/Staff)
    const canViewSkus = (user) => {
        return user.role === 'Admin' ||
            user.role === 'Exec' ||
            ['MS', 'OP'].includes(user.department_code) ||
            (user.department_name || '').includes('市场') ||
            (user.department_name || '').includes('运营');
    };

    const requireSkuAdmin = (req, res, next) => {
        const user = req.user;
        const isMsLeadPlus = user.role === 'Admin' ||
            user.role === 'Exec' ||
            (user.role === 'Lead' && user.department_code === 'MS');

        // For non-GET requests (POST/PUT/DELETE), require Lead+
        if (req.method !== 'GET' && !isMsLeadPlus) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Only Admin, Exec, or MS Lead can manage product SKUs' }
            });
        }

        // For GET requests, allow all MS staff
        if (req.method === 'GET' && !canViewSkus(user)) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Access denied' }
            });
        }
        next();
    };

    /**
     * GET /api/v1/admin/product-skus
     * List all SKUs with optional filtering
     */
    router.get('/', authenticate, requireSkuAdmin, (req, res) => {
        try {
            const { model_id, keyword } = req.query;

            let conditions = [];
            let params = [];

            if (model_id) {
                conditions.push('ps.model_id = ?');
                params.push(model_id);
            }

            if (keyword) {
                conditions.push('(ps.sku_code LIKE ? OR ps.display_name LIKE ? OR ps.material_id LIKE ?)');
                params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const skus = db.prepare(`
                SELECT 
                    ps.*,
                    pm.name_zh,
                    (SELECT COUNT(*) FROM products p WHERE p.sku_id = ps.id) as instance_count
                FROM product_skus ps
                JOIN product_models pm ON ps.model_id = pm.id
                ${whereClause}
                ORDER BY ps.created_at DESC
            `).all(...params);

            res.json({
                success: true,
                data: skus
            });
        } catch (err) {
            console.error('Failed to fetch product SKUs:', err);
            res.status(500).json({
                success: false,
                error: { code: 'DB_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/admin/product-skus/:id
     * Get a single SKU detail
     */
    router.get('/:id', authenticate, requireSkuAdmin, (req, res) => {
        try {
            const { id } = req.params;
            const sku = db.prepare(`
                SELECT ps.*, pm.name_zh, pm.product_family
                FROM product_skus ps
                JOIN product_models pm ON ps.model_id = pm.id
                WHERE ps.id = ?
            `).get(id);

            if (!sku) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'SKU not found' }
                });
            }

            res.json({
                success: true,
                data: sku
            });
        } catch (err) {
            console.error('Failed to fetch SKU details:', err);
            res.status(500).json({
                success: false,
                error: { code: 'DB_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/admin/product-skus
     * Create a new product SKU
     */
    router.post('/', authenticate, requireSkuAdmin, (req, res) => {
        try {
            const {
                model_id,
                sku_code,
                material_id,
                display_name,
                display_name_en,
                spec_label,
                sku_image,
                is_active,
                weight_kg,
                volume_cum,
                length_cm,
                width_cm,
                depth_cm,
                is_dangerous_goods,
                upc,
                sn_prefix
            } = req.body;

            // Validation
            if (!model_id || !sku_code || !display_name) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Model ID, SKU code, and display name are required' }
                });
            }

            // Check if model exists
            const model = db.prepare('SELECT id FROM product_models WHERE id = ?').get(model_id);
            if (!model) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Parent product model not found' }
                });
            }

            // Check for duplicate SKU code
            const existing = db.prepare('SELECT id FROM product_skus WHERE sku_code = ?').get(sku_code);
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: { code: 'DUPLICATE', message: 'SKU with this code already exists' }
                });
            }

            const result = db.prepare(`
                INSERT INTO product_skus (
                    model_id, sku_code, material_id, display_name, display_name_en,
                    spec_label, sku_image, is_active, 
                    weight_kg, volume_cum, length_cm, width_cm, depth_cm,
                    is_dangerous_goods, upc, sn_prefix,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).run(
                model_id,
                sku_code,
                material_id || null,
                display_name,
                display_name_en || null,
                spec_label || null,
                sku_image || null,
                is_active !== false ? 1 : 0,
                weight_kg || null,
                volume_cum || null,
                length_cm || null,
                width_cm || null,
                depth_cm || null,
                is_dangerous_goods ? 1 : 0,
                upc || null,
                sn_prefix || null
            );

            const newSku = db.prepare('SELECT * FROM product_skus WHERE id = ?').get(result.lastInsertRowid);

            res.json({
                success: true,
                data: newSku
            });
        } catch (err) {
            console.error('Failed to create SKU:', err);
            res.status(500).json({
                success: false,
                error: { code: 'DB_ERROR', message: err.message }
            });
        }
    });

    /**
     * PUT /api/v1/admin/product-skus/:id
     * Update a product SKU
     */
    router.put('/:id', authenticate, requireSkuAdmin, (req, res) => {
        try {
            const { id } = req.params;
            const {
                model_id,
                sku_code,
                material_id,
                display_name,
                display_name_en,
                spec_label,
                sku_image,
                is_active,
                weight_kg,
                volume_cum,
                length_cm,
                width_cm,
                depth_cm,
                is_dangerous_goods,
                upc,
                sn_prefix
            } = req.body;

            // Check if SKU exists
            const existing = db.prepare('SELECT id FROM product_skus WHERE id = ?').get(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'SKU not found' }
                });
            }

            // Check for duplicate code (excluding current)
            if (sku_code) {
                const duplicate = db.prepare('SELECT id FROM product_skus WHERE sku_code = ? AND id != ?').get(sku_code, id);
                if (duplicate) {
                    return res.status(409).json({
                        success: false,
                        error: { code: 'DUPLICATE', message: 'Another SKU with this code already exists' }
                    });
                }
            }

            db.prepare(`
                UPDATE product_skus SET
                    model_id = COALESCE(?, model_id),
                    sku_code = COALESCE(?, sku_code),
                    material_id = ?,
                    display_name = COALESCE(?, display_name),
                    display_name_en = ?,
                    spec_label = ?,
                    sku_image = ?,
                    is_active = COALESCE(?, is_active),
                    weight_kg = ?,
                    volume_cum = ?,
                    length_cm = ?,
                    width_cm = ?,
                    depth_cm = ?,
                    is_dangerous_goods = ?,
                    upc = ?,
                    sn_prefix = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `).run(
                model_id,
                sku_code,
                material_id !== undefined ? material_id : null,
                display_name,
                display_name_en !== undefined ? display_name_en : null,
                spec_label !== undefined ? spec_label : null,
                sku_image !== undefined ? sku_image : null,
                is_active !== undefined ? (is_active ? 1 : 0) : null,
                weight_kg !== undefined ? weight_kg : null,
                volume_cum !== undefined ? volume_cum : null,
                length_cm !== undefined ? length_cm : null,
                width_cm !== undefined ? width_cm : null,
                depth_cm !== undefined ? depth_cm : null,
                is_dangerous_goods !== undefined ? (is_dangerous_goods ? 1 : 0) : null,
                upc !== undefined ? upc : null,
                sn_prefix !== undefined ? sn_prefix : null,
                id
            );

            const updatedSku = db.prepare('SELECT * FROM product_skus WHERE id = ?').get(id);

            res.json({
                success: true,
                data: updatedSku
            });
        } catch (err) {
            console.error('Failed to update SKU:', err);
            res.status(500).json({
                success: false,
                error: { code: 'DB_ERROR', message: err.message }
            });
        }
    });

    /**
     * DELETE /api/v1/admin/product-skus/:id
     * Delete a product SKU (only if no instances exist)
     */
    router.delete('/:id', authenticate, requireSkuAdmin, (req, res) => {
        try {
            const { id } = req.params;

            // Check if any products use this SKU
            const instanceCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE sku_id = ?').get(id);
            if (instanceCount.count > 0) {
                return res.status(409).json({
                    success: false,
                    error: { code: 'IN_USE', message: `Cannot delete: ${instanceCount.count} product instances are using this SKU` }
                });
            }

            db.prepare('DELETE FROM product_skus WHERE id = ?').run(id);

            res.json({
                success: true,
                message: 'SKU deleted successfully'
            });
        } catch (err) {
            console.error('Failed to delete SKU:', err);
            res.status(500).json({
                success: false,
                error: { code: 'DB_ERROR', message: err.message }
            });
        }
    });

    return router;
};
