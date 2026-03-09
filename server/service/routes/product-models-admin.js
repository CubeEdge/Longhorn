/**
 * Product Models Admin Routes
 * CRUD API for product model management (Admin/Exec/MS Lead only)
 */
const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    // Check if user can manage product models (Admin, Exec, or MS Lead)
    const requireModelAdmin = (req, res, next) => {
        const user = req.user;
        const canManage = user.role === 'Admin' || 
                          user.role === 'Exec' || 
                          (user.role === 'Lead' && user.department_code === 'MS');
        
        if (!canManage) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Only Admin, Exec, or MS Lead can manage product models' }
            });
        }
        next();
    };

    /**
     * GET /api/v1/admin/product-models
     * List product models with filtering
     */
    router.get('/', authenticate, requireModelAdmin, (req, res) => {
        try {
            const { product_family, keyword } = req.query;

            let conditions = [];
            let params = [];

            // Product family filtering
            if (product_family && product_family !== 'all') {
                conditions.push('product_family = ?');
                params.push(product_family);
            }

            // Keyword filtering
            if (keyword) {
                conditions.push('(model_name LIKE ? OR internal_name LIKE ?)');
                params.push(`%${keyword}%`, `%${keyword}%`);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get product models with instance count
            const models = db.prepare(`
                SELECT 
                    pm.*,
                    (SELECT COUNT(*) FROM products p WHERE p.model_name = pm.model_name) as instance_count
                FROM product_models pm
                ${whereClause}
                ORDER BY pm.created_at DESC
            `).all(...params);

            res.json({
                success: true,
                data: models
            });
        } catch (err) {
            console.error('Failed to fetch product models:', err);
            res.status(500).json({
                success: false,
                error: { code: 'DB_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/admin/product-models
     * Create a new product model
     */
    router.post('/', authenticate, requireModelAdmin, (req, res) => {
        try {
            const {
                model_name,
                internal_name,
                product_family,
                product_type,
                description,
                is_active
            } = req.body;

            // Validation
            if (!model_name || !product_family) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Model name and product family are required' }
                });
            }

            // Check for duplicate model name
            const existing = db.prepare('SELECT id FROM product_models WHERE model_name = ?').get(model_name);
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: { code: 'DUPLICATE', message: 'Product model with this name already exists' }
                });
            }

            const result = db.prepare(`
                INSERT INTO product_models (
                    model_name, internal_name, product_family, product_type,
                    description, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).run(
                model_name,
                internal_name || null,
                product_family,
                product_type || 'CAMERA',
                description || null,
                is_active !== false ? 1 : 0
            );

            const newModel = db.prepare('SELECT * FROM product_models WHERE id = ?').get(result.lastInsertRowid);

            res.json({
                success: true,
                data: newModel
            });
        } catch (err) {
            console.error('Failed to create product model:', err);
            res.status(500).json({
                success: false,
                error: { code: 'DB_ERROR', message: err.message }
            });
        }
    });

    /**
     * PUT /api/v1/admin/product-models/:id
     * Update a product model
     */
    router.put('/:id', authenticate, requireModelAdmin, (req, res) => {
        try {
            const { id } = req.params;
            const {
                model_name,
                internal_name,
                product_family,
                product_type,
                description,
                is_active
            } = req.body;

            // Check if model exists
            const existing = db.prepare('SELECT id FROM product_models WHERE id = ?').get(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Product model not found' }
                });
            }

            // Check for duplicate name (excluding current model)
            if (model_name) {
                const duplicate = db.prepare('SELECT id FROM product_models WHERE model_name = ? AND id != ?').get(model_name, id);
                if (duplicate) {
                    return res.status(409).json({
                        success: false,
                        error: { code: 'DUPLICATE', message: 'Another product model with this name already exists' }
                    });
                }
            }

            db.prepare(`
                UPDATE product_models SET
                    model_name = COALESCE(?, model_name),
                    internal_name = ?,
                    product_family = COALESCE(?, product_family),
                    product_type = COALESCE(?, product_type),
                    description = ?,
                    is_active = COALESCE(?, is_active),
                    updated_at = datetime('now')
                WHERE id = ?
            `).run(
                model_name,
                internal_name !== undefined ? internal_name : null,
                product_family,
                product_type,
                description !== undefined ? description : null,
                is_active !== undefined ? (is_active ? 1 : 0) : null,
                id
            );

            const updatedModel = db.prepare('SELECT * FROM product_models WHERE id = ?').get(id);

            res.json({
                success: true,
                data: updatedModel
            });
        } catch (err) {
            console.error('Failed to update product model:', err);
            res.status(500).json({
                success: false,
                error: { code: 'DB_ERROR', message: err.message }
            });
        }
    });

    /**
     * DELETE /api/v1/admin/product-models/:id
     * Delete a product model (only if no instances exist)
     */
    router.delete('/:id', authenticate, requireModelAdmin, (req, res) => {
        try {
            const { id } = req.params;

            // Check if model exists
            const model = db.prepare('SELECT model_name FROM product_models WHERE id = ?').get(id);
            if (!model) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Product model not found' }
                });
            }

            // Check if any products use this model
            const instanceCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE model_name = ?').get(model.model_name);
            if (instanceCount.count > 0) {
                return res.status(409).json({
                    success: false,
                    error: { code: 'IN_USE', message: `Cannot delete: ${instanceCount.count} product instances are using this model` }
                });
            }

            db.prepare('DELETE FROM product_models WHERE id = ?').run(id);

            res.json({
                success: true,
                message: 'Product model deleted successfully'
            });
        } catch (err) {
            console.error('Failed to delete product model:', err);
            res.status(500).json({
                success: false,
                error: { code: 'DB_ERROR', message: err.message }
            });
        }
    });

    return router;
};
