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

            let conditions = ['pm.is_deleted = 0'];
            let params = [];

            if (status) {
                conditions.push('pm.status = ?');
                params.push(status);
            }

            if (category) {
                conditions.push('pm.category = ?');
                params.push(category);
            }

            if (search) {
                conditions.push('(pm.sku LIKE ? OR pm.name LIKE ? OR pm.name_en LIKE ?)');
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern);
            }

            if (compatible_model) {
                conditions.push('pm.compatible_models LIKE ?');
                params.push(`%${compatible_model}%`);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // 获取总数
            const countSql = `SELECT COUNT(*) as total FROM parts_master pm ${whereClause}`;
            const { total } = db.prepare(countSql).get(...params);

            // 获取分页数据
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const dataSql = `
                SELECT 
                    pm.*,
                    sp.price_cny, sp.price_usd, sp.price_eur, sp.cost_cny,
                    u.display_name as created_by_name,
                    u2.display_name as updated_by_name
                FROM parts_master pm
                LEFT JOIN sku_prices sp ON pm.sku = sp.sku
                LEFT JOIN users u ON pm.created_by = u.id
                LEFT JOIN users u2 ON pm.updated_by = u2.id
                ${whereClause}
                ORDER BY pm.category, pm.sku
                LIMIT ? OFFSET ?
            `;

            const data = db.prepare(dataSql).all(...params, parseInt(page_size), offset);

            // 解析JSON字段
            const parsedData = data.map(item => {
                const mapped = {
                    ...item,
                    specifications: item.specifications ? JSON.parse(item.specifications) : null,
                    compatible_models: item.compatible_models ? JSON.parse(item.compatible_models) : []
                };
                if (req.user.department_name === 'OP') {
                    delete mapped.price_cny;
                    delete mapped.price_usd;
                    delete mapped.price_eur;
                    delete mapped.cost_cny;
                }
                return mapped;
            });

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
                       sp.price_cny, sp.price_usd, sp.price_eur, sp.cost_cny,
                       u.display_name as created_by_name,
                       u2.display_name as updated_by_name
                FROM parts_master pm
                LEFT JOIN sku_prices sp ON pm.sku = sp.sku
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

            // 获取关联的产品型号信息（含族群）
            const compatibleModels = db.prepare(`
                SELECT pmp.*, pm.name_zh as model_name, pm.name_en as model_name_en, pm.product_family, pm.model_code
                FROM product_model_parts pmp
                JOIN product_models pm ON pmp.product_model_id = pm.id
                WHERE pmp.part_id = ?
            `).all(req.params.id);

            const responseData = {
                ...part,
                specifications: part.specifications ? JSON.parse(part.specifications) : null,
                compatible_models: part.compatible_models ? JSON.parse(part.compatible_models) : [],
                model_bom: compatibleModels
            };

            if (req.user.department_name === 'OP') {
                delete responseData.price_cny;
                delete responseData.price_usd;
                delete responseData.price_eur;
                delete responseData.cost_cny;
            }

            res.json({
                success: true,
                data: responseData
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
                material_id,
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

            const insertPart = db.prepare(`
                INSERT INTO parts_master (
                    sku, name, name_en, name_internal, name_internal_en, category, material_id, description, specifications,
                    compatible_models, min_stock_level, reorder_point,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `);

            const insertPrice = db.prepare(`
                INSERT OR REPLACE INTO sku_prices (
                    sku, item_type, price_cny, price_usd, price_eur, cost_cny
                ) VALUES (?, 'part', ?, ?, ?, ?)
            `);

            let lastInsertRowid;

            db.transaction(() => {
                const result = insertPart.run(
                    sku, name, name_en || null, name, name_en || null, category, material_id || null, description || null,
                    specifications ? JSON.stringify(specifications) : null,
                    '[]', // Initially empty, will update below
                    min_stock_level || 5, reorder_point || 10,
                    req.user.id
                );
                lastInsertRowid = result.lastInsertRowid;

                insertPrice.run(
                    sku,
                    price_cny || 0,
                    price_usd || 0,
                    price_eur || 0,
                    cost_cny || 0
                );

                // 处理机型关联
                if (Array.isArray(compatible_models) && compatible_models.length > 0) {
                    const modelInfos = [];
                    const insertJoin = db.prepare(`
                        INSERT INTO product_model_parts (product_model_id, product_model_name, part_id, part_sku, part_name)
                        VALUES (?, ?, ?, ?, ?)
                    `);

                    for (const modelId of compatible_models) {
                        const m = db.prepare('SELECT id, name_zh, model_code FROM product_models WHERE id = ?').get(modelId);
                        if (m) {
                            insertJoin.run(m.id, m.name_zh, lastInsertRowid, sku, name);
                            modelInfos.push(m.model_code || m.name_zh);
                        }
                    }

                    // 更新冗余字段用于搜索
                    db.prepare('UPDATE parts_master SET compatible_models = ? WHERE id = ?').run(
                        JSON.stringify(modelInfos),
                        lastInsertRowid
                    );
                }
            })();

            const result = { lastInsertRowid };

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

            const partUpdates = [];
            const priceUpdates = [];
            const partParams = [];
            const priceParams = [];

            const partFields = [
                'name', 'name_en', 'name_internal', 'name_internal_en', 'category', 'description', 
                'specifications', 'compatible_models', 'min_stock_level', 'reorder_point', 'status', 'material_id'
            ];
            const priceFields = ['price_cny', 'price_usd', 'price_eur', 'cost_cny'];

            partFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    partUpdates.push(`${field} = ?`);
                    if (field === 'specifications' || field === 'compatible_models') {
                        partParams.push(JSON.stringify(req.body[field]));
                    } else {
                        partParams.push(req.body[field]);
                    }
                }
            });

            priceFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    priceUpdates.push(`${field} = ?`);
                    priceParams.push(req.body[field]);
                }
            });

            if (partUpdates.length === 0 && priceUpdates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_CHANGES', message: '没有可更新的字段' }
                });
            }

            db.transaction(() => {
                if (partUpdates.length > 0) {
                    partUpdates.push('updated_at = CURRENT_TIMESTAMP');
                    partUpdates.push('updated_by = ?');
                    partParams.push(req.user.id);
                    partParams.push(req.params.id);
                    
                    db.prepare(`UPDATE parts_master SET ${partUpdates.join(', ')} WHERE id = ?`).run(...partParams);
                }

                if (priceUpdates.length > 0) {
                    priceUpdates.push('updated_at = CURRENT_TIMESTAMP');
                    priceParams.push(part.sku); 
                    
                    db.prepare(`UPDATE sku_prices SET ${priceUpdates.join(', ')} WHERE sku = ?`).run(...priceParams);
                }

                // 处理机型关联更新
                if (req.body.compatible_models !== undefined) {
                    const newModelIds = Array.isArray(req.body.compatible_models) ? req.body.compatible_models : [];
                    
                    // 1. 清除旧关联
                    db.prepare('DELETE FROM product_model_parts WHERE part_id = ?').run(req.params.id);
                    
                    // 2. 写入新关联
                    const modelInfos = [];
                    const insertJoin = db.prepare(`
                        INSERT INTO product_model_parts (product_model_id, product_model_name, part_id, part_sku, part_name)
                        VALUES (?, ?, ?, ?, ?)
                    `);

                    for (const modelId of newModelIds) {
                        const m = db.prepare('SELECT id, name_zh, model_code FROM product_models WHERE id = ?').get(modelId);
                        if (m) {
                            insertJoin.run(m.id, m.name_zh, req.params.id, part.sku, part.name);
                            modelInfos.push(m.model_code || m.name_zh);
                        }
                    }

                    // 3. 同步更新冗余字段
                    db.prepare('UPDATE parts_master SET compatible_models = ? WHERE id = ?').run(
                        JSON.stringify(modelInfos),
                        req.params.id
                    );
                }
            })();

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
