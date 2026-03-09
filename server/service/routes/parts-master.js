/**
 * Parts Master API Routes
 * 配件主数据管理API
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    // ==========================================
    // 权限检查辅助函数
    // ==========================================
    function checkPartsAdminAccess(user) {
        return ['Admin', 'Lead', 'Exec'].includes(user.role) || 
               ['MS', 'GE'].includes(user.department_name);
    }

    function checkPartsViewAccess(user) {
        return ['Admin', 'Lead', 'Exec'].includes(user.role) || 
               ['MS', 'GE', 'OP'].includes(user.department_name);
    }

    // ==========================================
    // GET /api/v1/parts-master
    // 获取配件列表
    // ==========================================
    router.get('/', authenticate, (req, res) => {
        try {
            if (!checkPartsViewAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看配件数据' }
                });
            }

            const {
                page = 1,
                page_size = 20,
                search,
                category,
                status = 'active',
                compatible_model
            } = req.query;

            let conditions = ['is_deleted = 0'];
            let params = [];

            if (status) {
                conditions.push('status = ?');
                params.push(status);
            }

            if (category) {
                conditions.push('category = ?');
                params.push(category);
            }

            if (search) {
                conditions.push('(sku LIKE ? OR name LIKE ? OR name_en LIKE ?)');
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern);
            }

            if (compatible_model) {
                conditions.push('compatible_models LIKE ?');
                params.push(`%${compatible_model}%`);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // 获取总数
            const countSql = `SELECT COUNT(*) as total FROM parts_master ${whereClause}`;
            const { total } = db.prepare(countSql).get(...params);

            // 获取分页数据
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const dataSql = `
                SELECT 
                    pm.*,
                    u.display_name as created_by_name,
                    u2.display_name as updated_by_name
                FROM parts_master pm
                LEFT JOIN users u ON pm.created_by = u.id
                LEFT JOIN users u2 ON pm.updated_by = u2.id
                ${whereClause}
                ORDER BY pm.category, pm.sku
                LIMIT ? OFFSET ?
            `;

            const data = db.prepare(dataSql).all(...params, parseInt(page_size), offset);

            // 解析JSON字段
            const parsedData = data.map(item => ({
                ...item,
                specifications: item.specifications ? JSON.parse(item.specifications) : null,
                compatible_models: item.compatible_models ? JSON.parse(item.compatible_models) : []
            }));

            res.json({
                success: true,
                data: parsedData,
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Parts Master] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // GET /api/v1/parts-master/:id
    // 获取配件详情
    // ==========================================
    router.get('/:id', authenticate, (req, res) => {
        try {
            if (!checkPartsViewAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看配件数据' }
                });
            }

            const part = db.prepare(`
                SELECT pm.*,
                       u.display_name as created_by_name,
                       u2.display_name as updated_by_name
                FROM parts_master pm
                LEFT JOIN users u ON pm.created_by = u.id
                LEFT JOIN users u2 ON pm.updated_by = u2.id
                WHERE pm.id = ? AND pm.is_deleted = 0
            `).get(req.params.id);

            if (!part) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '配件不存在' }
                });
            }

            // 获取关联的产品型号信息
            const compatibleModels = db.prepare(`
                SELECT pmp.*, pm.name as model_name
                FROM product_model_parts pmp
                JOIN product_models pm ON pmp.product_model_id = pm.id
                WHERE pmp.part_id = ?
            `).all(req.params.id);

            res.json({
                success: true,
                data: {
                    ...part,
                    specifications: part.specifications ? JSON.parse(part.specifications) : null,
                    compatible_models: part.compatible_models ? JSON.parse(part.compatible_models) : [],
                    model_bom: compatibleModels
                }
            });
        } catch (err) {
            console.error('[Parts Master] Get error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // POST /api/v1/parts-master
    // 创建配件
    // ==========================================
    router.post('/', authenticate, (req, res) => {
        try {
            if (!checkPartsAdminAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权创建配件' }
                });
            }

            const {
                sku,
                name,
                name_en,
                category,
                description,
                specifications,
                price_cny,
                price_usd,
                price_eur,
                cost_cny,
                compatible_models,
                min_stock_level,
                reorder_point
            } = req.body;

            // 验证必填字段
            if (!sku || !name || !category) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'SKU、名称、分类为必填项' }
                });
            }

            // 检查SKU是否已存在
            const existing = db.prepare('SELECT id FROM parts_master WHERE sku = ? AND is_deleted = 0').get(sku);
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: { code: 'DUPLICATE_SKU', message: 'SKU已存在' }
                });
            }

            const result = db.prepare(`
                INSERT INTO parts_master (
                    sku, name, name_en, category, description, specifications,
                    price_cny, price_usd, price_eur, cost_cny,
                    compatible_models, min_stock_level, reorder_point,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
                sku, name, name_en || null, category, description || null,
                specifications ? JSON.stringify(specifications) : null,
                price_cny || 0, price_usd || 0, price_eur || 0, cost_cny || 0,
                compatible_models ? JSON.stringify(compatible_models) : '[]',
                min_stock_level || 5, reorder_point || 10,
                req.user.id
            );

            res.status(201).json({
                success: true,
                data: { id: result.lastInsertRowid, sku }
            });
        } catch (err) {
            console.error('[Parts Master] Create error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // PATCH /api/v1/parts-master/:id
    // 更新配件
    // ==========================================
    router.patch('/:id', authenticate, (req, res) => {
        try {
            if (!checkPartsAdminAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权更新配件' }
                });
            }

            const part = db.prepare('SELECT * FROM parts_master WHERE id = ? AND is_deleted = 0').get(req.params.id);
            if (!part) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '配件不存在' }
                });
            }

            const updates = [];
            const params = [];

            const fields = [
                'name', 'name_en', 'category', 'description', 'specifications',
                'price_cny', 'price_usd', 'price_eur', 'cost_cny',
                'compatible_models', 'min_stock_level', 'reorder_point', 'status'
            ];

            fields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    if (field === 'specifications' || field === 'compatible_models') {
                        params.push(JSON.stringify(req.body[field]));
                    } else {
                        params.push(req.body[field]);
                    }
                }
            });

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_CHANGES', message: '没有可更新的字段' }
                });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            updates.push('updated_by = ?');
            params.push(req.user.id);
            params.push(req.params.id);

            db.prepare(`UPDATE parts_master SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id) }
            });
        } catch (err) {
            console.error('[Parts Master] Update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // DELETE /api/v1/parts-master/:id
    // 软删除配件
    // ==========================================
    router.delete('/:id', authenticate, (req, res) => {
        try {
            if (!checkPartsAdminAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权删除配件' }
                });
            }

            const part = db.prepare('SELECT * FROM parts_master WHERE id = ? AND is_deleted = 0').get(req.params.id);
            if (!part) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '配件不存在' }
                });
            }

            db.prepare(`
                UPDATE parts_master 
                SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, deleted_by = ?
                WHERE id = ?
            `).run(req.user.id, req.params.id);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id) }
            });
        } catch (err) {
            console.error('[Parts Master] Delete error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // GET /api/v1/parts-master/categories/list
    // 获取配件分类列表
    // ==========================================
    router.get('/categories/list', authenticate, (req, res) => {
        try {
            const categories = db.prepare(`
                SELECT DISTINCT category FROM parts_master 
                WHERE is_deleted = 0 AND status = 'active'
                ORDER BY category
            `).all();

            res.json({
                success: true,
                data: categories.map(c => c.category)
            });
        } catch (err) {
            console.error('[Parts Master] Categories error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    return router;
};
