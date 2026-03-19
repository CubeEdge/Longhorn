/**
 * Product Models Admin Routes
 * CRUD API for product model management (Admin/Exec/MS Lead only)
 */
const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    // Check if user can manage product models (Admin, Exec, or MS Lead/Staff)
    const canViewModels = (user) => {
        return user.role === 'Admin' ||
            user.role === 'Exec' ||
            ['MS', 'OP'].includes(user.department_code) ||
            (user.department_name || '').includes('市场') ||
            (user.department_name || '').includes('运营');
    };

    const requireModelAdmin = (req, res, next) => {
        const user = req.user;
        const isMsLeadPlus = user.role === 'Admin' ||
            user.role === 'Exec' ||
            (user.role === 'Lead' && user.department_code === 'MS');

        // For non-GET requests (POST/PUT/DELETE), require Lead+
        if (req.method !== 'GET' && !isMsLeadPlus) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Only Admin, Exec, or MS Lead can manage product models' }
            });
        }

        // For GET requests, allow all MS staff
        if (req.method === 'GET' && !canViewModels(user)) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Access denied' }
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
                conditions.push('(name_zh LIKE ? OR name_en LIKE ? OR model_code LIKE ?)');
                params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get product models with instance count
            // 排序规则：1. 电影机/摄像机/电子寻像器优先 2. 有SN前缀的次之 3. 创建时间倒序
            const models = db.prepare(`
                SELECT 
                    pm.*,
                    (SELECT COUNT(*) FROM products p WHERE p.model_name = pm.name_zh) as instance_count,
                    (SELECT COUNT(*) FROM product_skus ps WHERE ps.model_id = pm.id) as sku_count,
                    CASE 
                        WHEN pm.product_type LIKE '%电影机%' OR pm.product_type LIKE '%摄像机%' THEN 1
                        WHEN pm.product_type LIKE '%电子寻像器%' OR pm.product_type LIKE '%寻像器%' THEN 2
                        ELSE 3
                    END as type_priority,
                    CASE WHEN pm.sn_prefix IS NOT NULL AND pm.sn_prefix != '' THEN 1 ELSE 2 END as has_sn_prefix
                FROM product_models pm
                ${whereClause}
                ORDER BY 
                    pm.is_active DESC,
                    type_priority ASC,
                    has_sn_prefix ASC,
                    pm.created_at DESC
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
     * GET /api/v1/admin/product-models/:id
     * Get a single product model detail
     */
    router.get('/:id', authenticate, requireModelAdmin, (req, res) => {
        try {
            const { id } = req.params;
            const model = db.prepare(`
                SELECT 
                    pm.*,
                    (SELECT COUNT(*) FROM products p WHERE p.model_name = pm.name_zh) as instance_count,
                    (SELECT COUNT(*) FROM product_skus ps WHERE ps.model_id = pm.id) as sku_count
                FROM product_models pm
                WHERE pm.id = ?
            `).get(id);

            if (!model) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Product model not found' }
                });
            }

            res.json({
                success: true,
                data: model
            });
        } catch (err) {
            console.error('Failed to fetch product model details:', err);
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
                name_zh,
                name_en,
                model_code,
                material_id,
                product_family,
                product_type,
                description,
                is_active,
                hero_image,
                brand
            } = req.body;

            // Validation
            if (!name_zh || !product_family) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Name (ZH) and product family are required' }
                });
            }

            // Check for duplicate model code or name
            const existing = db.prepare('SELECT id FROM product_models WHERE name_zh = ? OR (model_code IS NOT NULL AND model_code = ?)').get(name_zh, model_code);
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: { code: 'DUPLICATE', message: 'Product model with this name or code already exists' }
                });
            }

            const result = db.prepare(`
                INSERT INTO product_models (
                    name_zh, name_en, brand, model_code, material_id,
                    product_family, product_type, description, hero_image,
                    is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).run(
                name_zh,
                name_en || null,
                brand || 'Kinefinity',
                model_code || null,
                material_id || null,
                product_family,
                product_type || 'CAMERA',
                description || null,
                hero_image || null,
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
                name_zh,
                name_en,
                model_code,
                material_id,
                product_family,
                product_type,
                description,
                is_active,
                hero_image,
                brand
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
            if (name_zh) {
                const duplicate = db.prepare('SELECT id FROM product_models WHERE name_zh = ? AND id != ?').get(name_zh, id);
                if (duplicate) {
                    return res.status(409).json({
                        success: false,
                        error: { code: 'DUPLICATE', message: 'Another product model with this name already exists' }
                    });
                }
            }
            if (model_code) {
                const duplicate = db.prepare('SELECT id FROM product_models WHERE model_code = ? AND id != ?').get(model_code, id);
                if (duplicate) {
                    return res.status(409).json({
                        success: false,
                        error: { code: 'DUPLICATE', message: 'Another product model with this code already exists' }
                    });
                }
            }

            db.prepare(`
                UPDATE product_models SET
                    name_zh = COALESCE(?, name_zh),
                    name_en = COALESCE(?, name_en),
                    brand = COALESCE(?, brand),
                    model_code = ?,
                    material_id = ?,
                    product_family = COALESCE(?, product_family),
                    product_type = COALESCE(?, product_type),
                    description = ?,
                    hero_image = ?,
                    is_active = COALESCE(?, is_active),
                    updated_at = datetime('now')
                WHERE id = ?
            `).run(
                name_zh,
                name_en,
                brand,
                model_code !== undefined ? model_code : null,
                material_id !== undefined ? material_id : null,
                product_family,
                product_type,
                description !== undefined ? description : null,
                hero_image !== undefined ? hero_image : null,
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
            const model = db.prepare('SELECT name_zh FROM product_models WHERE id = ?').get(id);
            if (!model) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Product model not found' }
                });
            }

            // Check if any products use this model
            const instanceCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE model_name = ?').get(model.name_zh);
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

    /**
     * GET /api/v1/admin/product-models/:id/skus
     * List SKUs for a specific product model
     */
    router.get('/:id/skus', authenticate, requireModelAdmin, (req, res) => {
        try {
            const { id } = req.params;
            const skus = db.prepare(`
                SELECT 
                    ps.*,
                    (SELECT COUNT(*) FROM products p WHERE p.sku_id = ps.id) as instance_count
                FROM product_skus ps
                WHERE ps.model_id = ?
                ORDER BY ps.is_active DESC, ps.sku_code ASC
            `).all(id);

            res.json({
                success: true,
                data: skus
            });
        } catch (err) {
            console.error('Failed to fetch model SKUs:', err);
            res.status(500).json({
                success: false,
                error: { code: 'DB_ERROR', message: err.message }
            });
        }
    });

    return router;
};
