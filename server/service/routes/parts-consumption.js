/**
 * Parts Consumption API Routes
 * 配件消耗记录API
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    // ==========================================
    // 权限检查辅助函数
    // ==========================================
    function checkConsumptionAdminAccess(user) {
        return ['Admin', 'Lead', 'Exec'].includes(user.role) || 
               user.department_name === 'MS';
    }

    function checkConsumptionViewAccess(user) {
        return ['Admin', 'Lead', 'Exec'].includes(user.role) || 
               ['MS', 'GE', 'OP'].includes(user.department_name);
    }

    // ==========================================
    // GET /api/v1/parts-consumption
    // 获取配件消耗记录列表
    // ==========================================
    router.get('/', authenticate, (req, res) => {
        try {
            if (!checkConsumptionViewAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看消耗记录' }
                });
            }

            const {
                page = 1,
                page_size = 50,
                ticket_id,
                part_id,
                dealer_id,
                source_type,
                settlement_status,
                start_date,
                end_date
            } = req.query;

            let sql = `
                SELECT 
                    pc.*,
                    pc.total_amount as total_price_cny,
                    pm.sku as part_sku,
                    pm.name as part_name,
                    pm.category as part_category,
                    t.ticket_number,
                    t.ticket_type,
                    d.name as dealer_name,
                    d.code as dealer_code
                FROM parts_consumption pc
                JOIN parts_master pm ON pc.part_id = pm.id
                LEFT JOIN tickets t ON pc.ticket_id = t.id
                LEFT JOIN dealers d ON pc.dealer_id = d.id
                WHERE 1=1
            `;

            const params = [];

            if (ticket_id) {
                sql += ' AND pc.ticket_id = ?';
                params.push(ticket_id);
            }

            if (part_id) {
                sql += ' AND pc.part_id = ?';
                params.push(part_id);
            }

            if (dealer_id) {
                sql += ' AND pc.dealer_id = ?';
                params.push(dealer_id);
            }

            if (source_type) {
                sql += ' AND pc.source_type = ?';
                params.push(source_type);
            }

            if (settlement_status) {
                sql += ' AND pc.settlement_status = ?';
                params.push(settlement_status);
            }

            if (start_date) {
                sql += ' AND DATE(pc.used_at) >= ?';
                params.push(start_date);
            }

            if (end_date) {
                sql += ' AND DATE(pc.used_at) <= ?';
                params.push(end_date);
            }

            // 获取总数
            const countResult = db.prepare(`SELECT COUNT(*) as total FROM (${sql})`).get(...params);
            const total = countResult.total;

            // 分页
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            sql += ' ORDER BY pc.used_at DESC LIMIT ? OFFSET ?';
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
            console.error('[Parts Consumption] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // GET /api/v1/parts-consumption/summary
    // 获取消耗统计
    // ==========================================
    router.get('/summary', authenticate, (req, res) => {
        try {
            if (!checkConsumptionViewAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看消耗记录' }
                });
            }

            const { start_date, end_date, dealer_id } = req.query;

            let dateFilter = '';
            const params = [];

            if (start_date) {
                dateFilter += ' AND DATE(pc.used_at) >= ?';
                params.push(start_date);
            }

            if (end_date) {
                dateFilter += ' AND DATE(pc.used_at) <= ?';
                params.push(end_date);
            }

            if (dealer_id) {
                dateFilter += ' AND pc.dealer_id = ?';
                params.push(dealer_id);
            }

            // 总体统计
            const overallStats = db.prepare(`
                SELECT 
                    COUNT(*) as total_records,
                    SUM(pc.quantity) as total_quantity,
                    SUM(pc.total_amount) as total_amount,
                    COUNT(DISTINCT pc.ticket_id) as ticket_count,
                    COUNT(DISTINCT pc.part_id) as part_sku_count
                FROM parts_consumption pc
                WHERE 1=1 ${dateFilter}
            `).get(...params);

            // 按来源统计
            const sourceStats = db.prepare(`
                SELECT 
                    pc.source_type,
                    COUNT(*) as count,
                    SUM(pc.quantity) as total_quantity,
                    SUM(pc.total_amount) as total_amount
                FROM parts_consumption pc
                WHERE 1=1 ${dateFilter}
                GROUP BY pc.source_type
            `).all(...params);

            // 按结算状态统计
            const settlementStats = db.prepare(`
                SELECT 
                    pc.settlement_status,
                    COUNT(*) as count,
                    SUM(pc.total_amount) as total_amount
                FROM parts_consumption pc
                WHERE 1=1 ${dateFilter}
                GROUP BY pc.settlement_status
            `).all(...params);

            // 按配件分类统计
            const categoryStats = db.prepare(`
                SELECT 
                    pm.category,
                    COUNT(*) as count,
                    SUM(pc.quantity) as total_quantity,
                    SUM(pc.total_amount) as total_amount
                FROM parts_consumption pc
                JOIN parts_master pm ON pc.part_id = pm.id
                WHERE 1=1 ${dateFilter}
                GROUP BY pm.category
                ORDER BY total_amount DESC
            `).all(...params);

            res.json({
                success: true,
                data: {
                    overall: overallStats,
                    by_source: sourceStats,
                    by_settlement: settlementStats,
                    by_category: categoryStats
                }
            });
        } catch (err) {
            console.error('[Parts Consumption] Summary error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // POST /api/v1/parts-consumption
    // 记录配件消耗
    // ==========================================
    router.post('/', authenticate, (req, res) => {
        try {
            if (!checkConsumptionAdminAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权记录配件消耗' }
                });
            }

            const {
                ticket_id,
                part_id,
                quantity,
                unit_price,
                currency = 'CNY',
                source_type = 'hq_inventory',
                dealer_id,
                notes
            } = req.body;

            // 验证必填字段
            if (!ticket_id || !part_id || !quantity || quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '工单ID、配件ID和数量为必填项' }
                });
            }

            // 获取配件信息
            // 获取配件信息及统一价格
            const part = db.prepare(`
                SELECT pm.*, sp.price_cny 
                FROM parts_master pm
                LEFT JOIN sku_prices sp ON pm.sku = sp.sku
                WHERE pm.id = ? AND pm.is_deleted = 0
            `).get(part_id);
            if (!part) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '配件不存在' }
                });
            }

            // 获取工单信息
            const ticket = db.prepare('SELECT ticket_number, type FROM tickets WHERE id = ?').get(ticket_id);
            if (!ticket) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '工单不存在' }
                });
            }

            // 检查库存（如果是从库存扣减）
            if (source_type === 'hq_inventory' || source_type === 'dealer_inventory') {
                const inventory = db.prepare(`
                    SELECT * FROM dealer_inventory 
                    WHERE part_id = ? AND (dealer_id = ? OR (dealer_id IS NULL AND ? IS NULL))
                `).get(part_id, dealer_id || null, dealer_id || null);

                if (!inventory || inventory.quantity < quantity) {
                    return res.status(400).json({
                        success: false,
                        error: { code: 'INSUFFICIENT_STOCK', message: '库存不足，无法扣减' }
                    });
                }

                // 扣减库存
                const newQuantity = inventory.quantity - quantity;
                db.prepare(`
                    UPDATE dealer_inventory 
                    SET quantity = ?, last_outbound_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(newQuantity, inventory.id);

                // 记录库存交易
                db.prepare(`
                    INSERT INTO inventory_transactions 
                    (transaction_type, part_id, dealer_id, quantity, before_quantity, after_quantity, 
                     reference_type, reference_id, operated_by, operated_by_name, notes, created_at)
                    VALUES ('consumption', ?, ?, ?, ?, ?, 'ticket', ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(
                    part_id, dealer_id || null, -quantity, inventory.quantity, newQuantity,
                    ticket_id, req.user.id, req.user.display_name || req.user.username,
                    `工单消耗: ${ticket.ticket_number}`
                );
            }

            // 计算总价
            const finalUnitPrice = unit_price || part.price_cny;
            const totalAmount = quantity * finalUnitPrice;

            // 获取经销商信息
            let dealerName = null;
            if (dealer_id) {
                const dealer = db.prepare('SELECT name FROM dealers WHERE id = ?').get(dealer_id);
                dealerName = dealer?.name;
            }

            // 创建消耗记录
            const result = db.prepare(`
                INSERT INTO parts_consumption (
                    ticket_id, ticket_number, part_id, part_sku, part_name,
                    quantity, unit_price, currency, total_amount,
                    source_type, dealer_id, dealer_name,
                    used_by, used_by_name, used_at, notes, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP)
            `).run(
                ticket_id, ticket.ticket_number, part_id, part.sku, part.name,
                quantity, finalUnitPrice, currency, totalAmount,
                source_type, dealer_id || null, dealerName,
                req.user.id, req.user.display_name || req.user.username, notes || null, req.user.id
            );

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    ticket_id,
                    part_id,
                    quantity,
                    total_amount: totalAmount,
                    source_type
                }
            });
        } catch (err) {
            console.error('[Parts Consumption] Create error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // PATCH /api/v1/parts-consumption/:id/settlement
    // 更新结算状态
    // ==========================================
    router.patch('/:id/settlement', authenticate, (req, res) => {
        try {
            if (!checkConsumptionAdminAccess(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权更新结算状态' }
                });
            }

            const { settlement_status, settlement_id } = req.body;

            if (!settlement_status) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '结算状态为必填项' }
                });
            }

            const consumption = db.prepare('SELECT * FROM parts_consumption WHERE id = ?').get(req.params.id);
            if (!consumption) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '消耗记录不存在' }
                });
            }

            db.prepare(`
                UPDATE parts_consumption 
                SET settlement_status = ?, settlement_id = ?
                WHERE id = ?
            `).run(settlement_status, settlement_id || null, req.params.id);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), settlement_status }
            });
        } catch (err) {
            console.error('[Parts Consumption] Settlement update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // ==========================================
    // DELETE /api/v1/parts-consumption/:id
    // 撤销消耗记录（仅限管理员）
    // ==========================================
    router.delete('/:id', authenticate, (req, res) => {
        try {
            if (!['Admin', 'Exec'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '仅Admin可撤销消耗记录' }
                });
            }

            const consumption = db.prepare('SELECT * FROM parts_consumption WHERE id = ?').get(req.params.id);
            if (!consumption) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '消耗记录不存在' }
                });
            }

            // 如果已从库存扣减，需要恢复库存
            if (consumption.source_type === 'hq_inventory' || consumption.source_type === 'dealer_inventory') {
                const inventory = db.prepare(`
                    SELECT * FROM dealer_inventory 
                    WHERE part_id = ? AND (dealer_id = ? OR (dealer_id IS NULL AND ? IS NULL))
                `).get(consumption.part_id, consumption.dealer_id || null, consumption.dealer_id || null);

                if (inventory) {
                    const newQuantity = inventory.quantity + consumption.quantity;
                    db.prepare(`
                        UPDATE dealer_inventory 
                        SET quantity = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(newQuantity, inventory.id);

                    // 记录恢复交易
                    db.prepare(`
                        INSERT INTO inventory_transactions 
                        (transaction_type, part_id, dealer_id, quantity, before_quantity, after_quantity, 
                         reference_type, reference_id, operated_by, operated_by_name, notes, created_at)
                        VALUES ('adjustment', ?, ?, ?, ?, ?, 'consumption_reversal', ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `).run(
                        consumption.part_id, consumption.dealer_id || null, consumption.quantity,
                        inventory.quantity, newQuantity, consumption.ticket_id,
                        req.user.id, req.user.display_name || req.user.username,
                        `撤销消耗记录 #${req.params.id}`
                    );
                }
            }

            // 删除消耗记录
            db.prepare('DELETE FROM parts_consumption WHERE id = ?').run(req.params.id);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), message: '消耗记录已撤销' }
            });
        } catch (err) {
            console.error('[Parts Consumption] Delete error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    return router;
};
