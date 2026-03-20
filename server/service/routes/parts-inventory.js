/**
 * Parts Inventory API Routes
 * 配件库存管理API
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    // ==========================================
    // 权限检查辅助函数
    // ==========================================
    function checkInventoryAdminAccess(user) {
        return ['Admin', 'Lead', 'Exec'].includes(user.role) || 
               user.department_name === 'MS';
    }

    function checkInventoryViewAccess(user) {
        return ['Admin', 'Lead', 'Exec'].includes(user.role) || 
               ['MS', 'GE', 'OP'].includes(user.department_name);
    }

    // ==========================================
    // GET /api/v1/parts-inventory
    // 获取库存列表（总部+经销商）
    // ==========================================
    router.get('/', authenticate, (req, res) => {
        try {
            if (!checkInventoryViewAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看库存数据' }
                });
            }

            const {
                page = 1,
                page_size = 50,
                part_id,
                dealer_id,
                low_stock,
                search
            } = req.query;

            // 构建库存查询
            let sql = `
                SELECT 
                    di.*,
                    pm.sku as part_sku,
                    pm.name as part_name,
                    pm.category as part_category,
                    pm.min_stock_level,
                    pm.reorder_point,
                    d.name as dealer_name,
                    d.code as dealer_code
                FROM dealer_inventory di
                JOIN parts_master pm ON di.part_id = pm.id
                LEFT JOIN dealers d ON di.dealer_id = d.id
                WHERE pm.is_deleted = 0
            `;

            const params = [];

            if (part_id) {
                sql += ' AND di.part_id = ?';
                params.push(part_id);
            }

            if (dealer_id) {
                sql += ' AND di.dealer_id = ?';
                params.push(dealer_id);
            } else if (dealer_id === 'null' || dealer_id === '') {
                // 总部库存
                sql += ' AND di.dealer_id IS NULL';
            }

            if (low_stock === 'true') {
                sql += ' AND di.quantity <= pm.reorder_point';
            }

            if (search) {
                sql += ' AND (pm.sku LIKE ? OR pm.name LIKE ?)';
                const pattern = `%${search}%`;
                params.push(pattern, pattern);
            }

            // 获取总数
            const countResult = db.prepare(`SELECT COUNT(*) as total FROM (${sql})`).get(...params);
            const total = countResult.total;

            // 分页
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            sql += ' ORDER BY pm.category, pm.sku LIMIT ? OFFSET ?';
            params.push(parseInt(page_size), offset);

            const data = db.prepare(sql).all(...params);

            // 计算库存状态
            const enrichedData = data.map(item => ({
                ...item,
                is_low_stock: item.quantity <= item.reorder_point,
                is_critical: item.quantity <= item.min_stock_level,
                available_quantity: item.quantity - (item.reserved_quantity || 0)
            }));

            res.json({
                success: true,
                data: enrichedData,
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Parts Inventory] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // GET /api/v1/parts-inventory/summary
    // 获取库存汇总统计
    // ==========================================
    router.get('/summary', authenticate, (req, res) => {
        try {
            if (!checkInventoryViewAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看库存数据' }
                });
            }

            const { dealer_id } = req.query;

            // 总库存价值统计
            const valueStats = db.prepare(`
                SELECT 
                    SUM(di.quantity * sp.cost_cny) as total_cost_cny,
                    SUM(di.quantity * sp.price_cny) as total_value_cny,
                    COUNT(DISTINCT di.part_id) as sku_count,
                    SUM(di.quantity) as total_quantity
                FROM dealer_inventory di
                JOIN parts_master pm ON di.part_id = pm.id
                LEFT JOIN sku_prices sp ON pm.sku = sp.sku
                WHERE pm.is_deleted = 0
                ${dealer_id ? 'AND di.dealer_id = ?' : ''}
            `).get(dealer_id || []);

            // 低库存预警统计
            const lowStockStats = db.prepare(`
                SELECT 
                    COUNT(*) as low_stock_count,
                    SUM(CASE WHEN di.quantity <= pm.min_stock_level THEN 1 ELSE 0 END) as critical_count
                FROM dealer_inventory di
                JOIN parts_master pm ON di.part_id = pm.id
                WHERE pm.is_deleted = 0
                AND di.quantity <= pm.reorder_point
                ${dealer_id ? 'AND di.dealer_id = ?' : ''}
            `).get(dealer_id || []);

            // 分类统计
            const categoryStats = db.prepare(`
                SELECT 
                    pm.category,
                    COUNT(DISTINCT di.part_id) as sku_count,
                    SUM(di.quantity) as total_quantity,
                    SUM(di.quantity * sp.price_cny) as total_value_cny
                FROM dealer_inventory di
                JOIN parts_master pm ON di.part_id = pm.id
                LEFT JOIN sku_prices sp ON pm.sku = sp.sku
                WHERE pm.is_deleted = 0
                ${dealer_id ? 'AND di.dealer_id = ?' : ''}
                GROUP BY pm.category
                ORDER BY total_value_cny DESC
            `).all(dealer_id || []);

            res.json({
                success: true,
                data: {
                    value: valueStats,
                    alerts: lowStockStats,
                    categories: categoryStats
                }
            });
        } catch (err) {
            console.error('[Parts Inventory] Summary error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // GET /api/v1/parts-inventory/low-stock
    // 获取低库存预警列表
    // ==========================================
    router.get('/low-stock', authenticate, (req, res) => {
        try {
            if (!checkInventoryViewAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看库存数据' }
                });
            }

            const { dealer_id } = req.query;

            let sql = `
                SELECT 
                    di.*,
                    pm.sku as part_sku,
                    pm.name as part_name,
                    pm.category as part_category,
                    pm.reorder_point,
                    pm.min_stock_level,
                    (pm.reorder_point - di.quantity) as shortage,
                    d.name as dealer_name,
                    d.code as dealer_code
                FROM dealer_inventory di
                JOIN parts_master pm ON di.part_id = pm.id
                LEFT JOIN dealers d ON di.dealer_id = d.id
                WHERE pm.is_deleted = 0
                AND di.quantity <= pm.reorder_point
            `;

            const params = [];

            if (dealer_id) {
                sql += ' AND di.dealer_id = ?';
                params.push(dealer_id);
            }

            sql += ' ORDER BY (pm.reorder_point - di.quantity) DESC';

            const data = db.prepare(sql).all(...params);

            res.json({
                success: true,
                data: data.map(item => ({
                    ...item,
                    is_critical: item.quantity <= item.min_stock_level
                }))
            });
        } catch (err) {
            console.error('[Parts Inventory] Low stock error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // POST /api/v1/parts-inventory/inbound
    // 入库操作
    // ==========================================
    router.post('/inbound', authenticate, (req, res) => {
        try {
            if (!checkInventoryAdminAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权执行入库操作' }
                });
            }

            const {
                part_id,
                dealer_id,
                quantity,
                batch_number,
                notes,
                reference_type,
                reference_id
            } = req.body;

            if (!part_id || !quantity || quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '配件ID和数量为必填项' }
                });
            }

            // 检查配件是否存在
            const part = db.prepare('SELECT id FROM parts_master WHERE id = ? AND is_deleted = 0').get(part_id);
            if (!part) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '配件不存在' }
                });
            }

            // 获取当前库存
            const existingInventory = db.prepare(`
                SELECT * FROM dealer_inventory 
                WHERE part_id = ? AND (dealer_id = ? OR (dealer_id IS NULL AND ? IS NULL))
            `).get(part_id, dealer_id || null, dealer_id || null);

            const beforeQuantity = existingInventory ? existingInventory.quantity : 0;
            const afterQuantity = beforeQuantity + quantity;

            // 更新或创建库存记录
            if (existingInventory) {
                db.prepare(`
                    UPDATE dealer_inventory 
                    SET quantity = ?, last_inbound_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(afterQuantity, existingInventory.id);
            } else {
                db.prepare(`
                    INSERT INTO dealer_inventory (part_id, dealer_id, quantity, last_inbound_date, created_at, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `).run(part_id, dealer_id || null, quantity);
            }

            // 记录交易
            db.prepare(`
                INSERT INTO inventory_transactions 
                (transaction_type, part_id, dealer_id, quantity, before_quantity, after_quantity, 
                 reference_type, reference_id, operated_by, operated_by_name, notes, created_at)
                VALUES ('inbound', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
                part_id, dealer_id || null, quantity, beforeQuantity, afterQuantity,
                reference_type || null, reference_id || null,
                req.user.id, req.user.display_name || req.user.username, notes || null
            );

            res.json({
                success: true,
                data: {
                    part_id,
                    dealer_id: dealer_id || null,
                    before_quantity: beforeQuantity,
                    after_quantity: afterQuantity,
                    inbound_quantity: quantity
                }
            });
        } catch (err) {
            console.error('[Parts Inventory] Inbound error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // POST /api/v1/parts-inventory/outbound
    // 出库操作
    // ==========================================
    router.post('/outbound', authenticate, (req, res) => {
        try {
            if (!checkInventoryAdminAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权执行出库操作' }
                });
            }

            const {
                part_id,
                dealer_id,
                quantity,
                notes,
                reference_type,
                reference_id
            } = req.body;

            if (!part_id || !quantity || quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '配件ID和数量为必填项' }
                });
            }

            // 获取当前库存
            const inventory = db.prepare(`
                SELECT * FROM dealer_inventory 
                WHERE part_id = ? AND (dealer_id = ? OR (dealer_id IS NULL AND ? IS NULL))
            `).get(part_id, dealer_id || null, dealer_id || null);

            if (!inventory || inventory.quantity < quantity) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INSUFFICIENT_STOCK', message: '库存不足' }
                });
            }

            const beforeQuantity = inventory.quantity;
            const afterQuantity = beforeQuantity - quantity;

            // 更新库存
            db.prepare(`
                UPDATE dealer_inventory 
                SET quantity = ?, last_outbound_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(afterQuantity, inventory.id);

            // 记录交易
            db.prepare(`
                INSERT INTO inventory_transactions 
                (transaction_type, part_id, dealer_id, quantity, before_quantity, after_quantity, 
                 reference_type, reference_id, operated_by, operated_by_name, notes, created_at)
                VALUES ('outbound', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
                part_id, dealer_id || null, -quantity, beforeQuantity, afterQuantity,
                reference_type || null, reference_id || null,
                req.user.id, req.user.display_name || req.user.username, notes || null
            );

            res.json({
                success: true,
                data: {
                    part_id,
                    dealer_id: dealer_id || null,
                    before_quantity: beforeQuantity,
                    after_quantity: afterQuantity,
                    outbound_quantity: quantity
                }
            });
        } catch (err) {
            console.error('[Parts Inventory] Outbound error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // GET /api/v1/parts-inventory/transactions
    // 获取库存交易记录
    // ==========================================
    router.get('/transactions', authenticate, (req, res) => {
        try {
            if (!checkInventoryViewAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看库存数据' }
                });
            }

            const {
                page = 1,
                page_size = 50,
                part_id,
                dealer_id,
                transaction_type
            } = req.query;

            let sql = `
                SELECT 
                    it.*,
                    pm.sku as part_sku,
                    pm.name as part_name,
                    d.name as dealer_name
                FROM inventory_transactions it
                JOIN parts_master pm ON it.part_id = pm.id
                LEFT JOIN dealers d ON it.dealer_id = d.id
                WHERE 1=1
            `;

            const params = [];

            if (part_id) {
                sql += ' AND it.part_id = ?';
                params.push(part_id);
            }

            if (dealer_id) {
                sql += ' AND it.dealer_id = ?';
                params.push(dealer_id);
            }

            if (transaction_type) {
                sql += ' AND it.transaction_type = ?';
                params.push(transaction_type);
            }

            // 获取总数
            const countResult = db.prepare(`SELECT COUNT(*) as total FROM (${sql})`).get(...params);
            const total = countResult.total;

            // 分页
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            sql += ' ORDER BY it.created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(page_size), offset);

            const data = db.prepare(sql).all(...params);

            res.json({
                success: true,
                data,
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Parts Inventory] Transactions error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    return router;
};
