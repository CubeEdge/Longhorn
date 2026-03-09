/**
 * Parts Settlement Routes
 * 经销商配件结算管理
 *
 * 功能：
 * - 结算单生成与管理
 * - 月度/季度结算汇总
 * - 结算状态追踪
 * - 与配件消耗记录关联
 */

const express = require('express');

function checkSettlementAdminAccess(req, res, next) {
    const allowedRoles = ['Admin', 'Lead', 'Exec', 'MS'];
    if (!allowedRoles.includes(req.user?.role)) {
        return res.status(403).json({
            success: false,
            error: { message: '无权访问结算管理功能' }
        });
    }
    next();
}

function checkSettlementViewAccess(req, res, next) {
    const allowedRoles = ['Admin', 'Lead', 'Exec', 'MS', 'OP', 'GE'];
    if (!allowedRoles.includes(req.user?.role)) {
        return res.status(403).json({
            success: false,
            error: { message: '无权查看结算信息' }
        });
    }
    next();
}

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/parts-settlements
     * 获取结算单列表
     */
    router.get('/', authenticate, checkSettlementViewAccess, (req, res) => {
        try {
            const {
                dealer_id,
                status,
                settlement_type,
                period_start,
                period_end,
                page = 1,
                page_size = 20
            } = req.query;

            let sql = `
                SELECT
                    s.*,
                    d.name as dealer_name,
                    d.code as dealer_code,
                    u.name as created_by_name,
                    u2.name as confirmed_by_name,
                    (SELECT COUNT(*) FROM parts_consumption WHERE settlement_id = s.id) as consumption_count,
                    (SELECT SUM(total_price_cny) FROM parts_consumption WHERE settlement_id = s.id) as total_amount
                FROM dealer_parts_settlements s
                LEFT JOIN dealers d ON s.dealer_id = d.id
                LEFT JOIN users u ON s.created_by = u.id
                LEFT JOIN users u2 ON s.confirmed_by = u2.id
                WHERE 1=1
            `;
            const params = [];

            if (dealer_id) {
                sql += ' AND s.dealer_id = ?';
                params.push(dealer_id);
            }
            if (status) {
                sql += ' AND s.status = ?';
                params.push(status);
            }
            if (settlement_type) {
                sql += ' AND s.settlement_type = ?';
                params.push(settlement_type);
            }
            if (period_start) {
                sql += ' AND s.period_end >= ?';
                params.push(period_start);
            }
            if (period_end) {
                sql += ' AND s.period_start <= ?';
                params.push(period_end);
            }

            sql += ' ORDER BY s.created_at DESC';

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            sql += ' LIMIT ? OFFSET ?';
            params.push(parseInt(page_size), offset);

            const settlements = db.prepare(sql).all(...params);

            let countSql = 'SELECT COUNT(*) as total FROM dealer_parts_settlements s WHERE 1=1';
            const countParams = [];
            if (dealer_id) {
                countSql += ' AND s.dealer_id = ?';
                countParams.push(dealer_id);
            }
            if (status) {
                countSql += ' AND s.status = ?';
                countParams.push(status);
            }
            if (settlement_type) {
                countSql += ' AND s.settlement_type = ?';
                countParams.push(settlement_type);
            }

            const { total } = db.prepare(countSql).get(...countParams);

            res.json({
                success: true,
                data: settlements,
                pagination: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('Error fetching settlements:', err);
            res.status(500).json({
                success: false,
                error: { message: '获取结算单列表失败' }
            });
        }
    });

    /**
     * GET /api/v1/parts-settlements/summary
     * 获取结算汇总统计
     */
    router.get('/summary', authenticate, checkSettlementViewAccess, (req, res) => {
        try {
            const { dealer_id, period_start, period_end } = req.query;

            let sql = `
                SELECT
                    COUNT(*) as total_settlements,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
                    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
                    SUM(total_amount_cny) as total_amount,
                    SUM(CASE WHEN status = 'paid' THEN total_amount_cny ELSE 0 END) as paid_amount,
                    SUM(CASE WHEN status IN ('draft', 'confirmed') THEN total_amount_cny ELSE 0 END) as pending_amount
                FROM dealer_parts_settlements
                WHERE 1=1
            `;
            const params = [];

            if (dealer_id) {
                sql += ' AND dealer_id = ?';
                params.push(dealer_id);
            }
            if (period_start) {
                sql += ' AND period_end >= ?';
                params.push(period_start);
            }
            if (period_end) {
                sql += ' AND period_start <= ?';
                params.push(period_end);
            }

            const summary = db.prepare(sql).get(...params);

            const dealerStats = db.prepare(`
                SELECT
                    d.id as dealer_id,
                    d.name as dealer_name,
                    d.code as dealer_code,
                    COUNT(s.id) as settlement_count,
                    SUM(s.total_amount_cny) as total_amount,
                    SUM(CASE WHEN s.status = 'paid' THEN s.total_amount_cny ELSE 0 END) as paid_amount
                FROM dealers d
                LEFT JOIN dealer_parts_settlements s ON d.id = s.dealer_id
                WHERE s.id IS NOT NULL
                ${dealer_id ? 'AND d.id = ?' : ''}
                GROUP BY d.id
                ORDER BY total_amount DESC
                LIMIT 10
            `).all(...(dealer_id ? [dealer_id] : []));

            res.json({
                success: true,
                data: {
                    overall: summary,
                    by_dealer: dealerStats
                }
            });
        } catch (err) {
            console.error('Error fetching settlement summary:', err);
            res.status(500).json({
                success: false,
                error: { message: '获取结算汇总失败' }
            });
        }
    });

    /**
     * GET /api/v1/parts-settlements/pending-consumptions
     * 获取待结算的消耗记录
     */
    router.get('/pending-consumptions', authenticate, checkSettlementViewAccess, (req, res) => {
        try {
            const { dealer_id, date_from, date_to } = req.query;

            let sql = `
                SELECT
                    c.*,
                    p.sku as part_sku,
                    p.name as part_name,
                    p.category as part_category,
                    t.ticket_number,
                    d.name as dealer_name,
                    d.code as dealer_code
                FROM parts_consumption c
                JOIN parts_master p ON c.part_id = p.id
                JOIN tickets t ON c.ticket_id = t.id
                LEFT JOIN dealers d ON c.dealer_id = d.id
                WHERE c.settlement_status = 'pending'
                AND c.source_type IN ('hq_inventory', 'dealer_inventory')
            `;
            const params = [];

            if (dealer_id) {
                sql += ' AND c.dealer_id = ?';
                params.push(dealer_id);
            }
            if (date_from) {
                sql += ' AND DATE(c.created_at) >= ?';
                params.push(date_from);
            }
            if (date_to) {
                sql += ' AND DATE(c.created_at) <= ?';
                params.push(date_to);
            }

            sql += ' ORDER BY c.created_at DESC';

            const consumptions = db.prepare(sql).all(...params);

            const summary = db.prepare(`
                SELECT
                    COUNT(*) as total_count,
                    SUM(c.quantity) as total_quantity,
                    SUM(c.total_price_cny) as total_amount,
                    COUNT(DISTINCT c.dealer_id) as dealer_count
                FROM parts_consumption c
                WHERE c.settlement_status = 'pending'
                AND c.source_type IN ('hq_inventory', 'dealer_inventory')
                ${dealer_id ? 'AND c.dealer_id = ?' : ''}
                ${date_from ? 'AND DATE(c.created_at) >= ?' : ''}
                ${date_to ? 'AND DATE(c.created_at) <= ?' : ''}
            `).get(...params);

            res.json({
                success: true,
                data: consumptions,
                summary
            });
        } catch (err) {
            console.error('Error fetching pending consumptions:', err);
            res.status(500).json({
                success: false,
                error: { message: '获取待结算记录失败' }
            });
        }
    });

    /**
     * POST /api/v1/parts-settlements
     * 创建结算单
     */
    router.post('/', authenticate, checkSettlementAdminAccess, (req, res) => {
        const transaction = db.transaction(() => {
            const {
                dealer_id,
                settlement_type,
                period_start,
                period_end,
                consumption_ids,
                notes
            } = req.body;

            if (!dealer_id || !settlement_type || !period_start || !period_end) {
                throw new Error('缺少必要参数');
            }

            if (!['monthly', 'quarterly', 'custom'].includes(settlement_type)) {
                throw new Error('无效的结算类型');
            }

            const dealer = db.prepare('SELECT id, name FROM dealers WHERE id = ?').get(dealer_id);
            if (!dealer) {
                throw new Error('经销商不存在');
            }

            let consumptionSql = `
                SELECT c.*, p.sku as part_sku, p.name as part_name
                FROM parts_consumption c
                JOIN parts_master p ON c.part_id = p.id
                WHERE c.dealer_id = ?
                AND c.settlement_status = 'pending'
                AND c.source_type IN ('hq_inventory', 'dealer_inventory')
                AND DATE(c.created_at) BETWEEN ? AND ?
            `;
            const consumptionParams = [dealer_id, period_start, period_end];

            if (consumption_ids && consumption_ids.length > 0) {
                consumptionSql += ` AND c.id IN (${consumption_ids.map(() => '?').join(',')})`;
                consumptionParams.push(...consumption_ids);
            }

            const consumptions = db.prepare(consumptionSql).all(...consumptionParams);

            if (consumptions.length === 0) {
                throw new Error('指定期间内没有待结算的消耗记录');
            }

            const totalAmount = consumptions.reduce((sum, c) => sum + c.total_price_cny, 0);
            const totalQuantity = consumptions.reduce((sum, c) => sum + c.quantity, 0);

            const settlementNumber = generateSettlementNumber(db, settlement_type);

            const result = db.prepare(`
                INSERT INTO dealer_parts_settlements (
                    settlement_number, dealer_id, settlement_type,
                    period_start, period_end, total_amount_cny,
                    total_quantity, status, notes, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, datetime('now'))
            `).run(
                settlementNumber,
                dealer_id,
                settlement_type,
                period_start,
                period_end,
                totalAmount,
                totalQuantity,
                notes || null,
                req.user.id
            );

            const settlementId = result.lastInsertRowid;

            for (const consumption of consumptions) {
                db.prepare(`
                    UPDATE parts_consumption
                    SET settlement_id = ?, settlement_status = 'included'
                    WHERE id = ?
                `).run(settlementId, consumption.id);
            }

            return {
                id: settlementId,
                settlement_number: settlementNumber,
                dealer_name: dealer.name,
                total_amount_cny: totalAmount,
                total_quantity: totalQuantity,
                consumption_count: consumptions.length
            };
        });

        try {
            const result = transaction();
            res.json({
                success: true,
                data: result,
                message: '结算单创建成功'
            });
        } catch (err) {
            console.error('Error creating settlement:', err);
            res.status(400).json({
                success: false,
                error: { message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/parts-settlements/:id
     * 获取结算单详情
     */
    router.get('/:id', authenticate, checkSettlementViewAccess, (req, res) => {
        try {
            const { id } = req.params;

            const settlement = db.prepare(`
                SELECT
                    s.*,
                    d.name as dealer_name,
                    d.code as dealer_code,
                    d.contact_email as dealer_email,
                    d.contact_phone as dealer_phone,
                    u.name as created_by_name,
                    u2.name as confirmed_by_name,
                    u3.name as paid_by_name
                FROM dealer_parts_settlements s
                LEFT JOIN dealers d ON s.dealer_id = d.id
                LEFT JOIN users u ON s.created_by = u.id
                LEFT JOIN users u2 ON s.confirmed_by = u2.id
                LEFT JOIN users u3 ON s.paid_by = u3.id
                WHERE s.id = ?
            `).get(id);

            if (!settlement) {
                return res.status(404).json({
                    success: false,
                    error: { message: '结算单不存在' }
                });
            }

            const consumptions = db.prepare(`
                SELECT
                    c.*,
                    p.sku as part_sku,
                    p.name as part_name,
                    p.category as part_category,
                    t.ticket_number
                FROM parts_consumption c
                JOIN parts_master p ON c.part_id = p.id
                JOIN tickets t ON c.ticket_id = t.id
                WHERE c.settlement_id = ?
                ORDER BY c.created_at DESC
            `).all(id);

            res.json({
                success: true,
                data: {
                    ...settlement,
                    consumptions
                }
            });
        } catch (err) {
            console.error('Error fetching settlement detail:', err);
            res.status(500).json({
                success: false,
                error: { message: '获取结算单详情失败' }
            });
        }
    });

    /**
     * PATCH /api/v1/parts-settlements/:id/confirm
     * 确认结算单
     */
    router.patch('/:id/confirm', authenticate, checkSettlementAdminAccess, (req, res) => {
        try {
            const { id } = req.params;

            const settlement = db.prepare('SELECT * FROM dealer_parts_settlements WHERE id = ?').get(id);
            if (!settlement) {
                return res.status(404).json({
                    success: false,
                    error: { message: '结算单不存在' }
                });
            }

            if (settlement.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    error: { message: '只能确认草稿状态的结算单' }
                });
            }

            db.prepare(`
                UPDATE dealer_parts_settlements
                SET status = 'confirmed',
                    confirmed_by = ?,
                    confirmed_at = datetime('now')
                WHERE id = ?
            `).run(req.user.id, id);

            res.json({
                success: true,
                message: '结算单已确认'
            });
        } catch (err) {
            console.error('Error confirming settlement:', err);
            res.status(500).json({
                success: false,
                error: { message: '确认结算单失败' }
            });
        }
    });

    /**
     * PATCH /api/v1/parts-settlements/:id/pay
     * 标记结算单为已付款
     */
    router.patch('/:id/pay', authenticate, checkSettlementAdminAccess, (req, res) => {
        try {
            const { id } = req.params;
            const { payment_method, payment_reference } = req.body;

            const settlement = db.prepare('SELECT * FROM dealer_parts_settlements WHERE id = ?').get(id);
            if (!settlement) {
                return res.status(404).json({
                    success: false,
                    error: { message: '结算单不存在' }
                });
            }

            if (settlement.status !== 'confirmed') {
                return res.status(400).json({
                    success: false,
                    error: { message: '只能对已确认的结算单进行付款' }
                });
            }

            db.prepare(`
                UPDATE dealer_parts_settlements
                SET status = 'paid',
                    paid_by = ?,
                    paid_at = datetime('now'),
                    payment_method = ?,
                    payment_reference = ?
                WHERE id = ?
            `).run(req.user.id, payment_method || null, payment_reference || null, id);

            res.json({
                success: true,
                message: '结算单已标记为已付款'
            });
        } catch (err) {
            console.error('Error marking settlement as paid:', err);
            res.status(500).json({
                success: false,
                error: { message: '标记付款失败' }
            });
        }
    });

    /**
     * PATCH /api/v1/parts-settlements/:id/cancel
     * 取消结算单
     */
    router.patch('/:id/cancel', authenticate, checkSettlementAdminAccess, (req, res) => {
        const transaction = db.transaction(() => {
            const { id } = req.params;
            const { reason } = req.body;

            const settlement = db.prepare('SELECT * FROM dealer_parts_settlements WHERE id = ?').get(id);
            if (!settlement) {
                throw new Error('结算单不存在');
            }

            if (settlement.status === 'paid') {
                throw new Error('已付款的结算单不能取消');
            }

            db.prepare(`
                UPDATE parts_consumption
                SET settlement_id = NULL, settlement_status = 'pending'
                WHERE settlement_id = ?
            `).run(id);

            db.prepare(`
                UPDATE dealer_parts_settlements
                SET status = 'cancelled',
                    cancelled_by = ?,
                    cancelled_at = datetime('now'),
                    cancellation_reason = ?
                WHERE id = ?
            `).run(req.user.id, reason || null, id);

            return { id };
        });

        try {
            transaction();
            res.json({
                success: true,
                message: '结算单已取消，相关消耗记录已恢复为待结算状态'
            });
        } catch (err) {
            console.error('Error cancelling settlement:', err);
            res.status(400).json({
                success: false,
                error: { message: err.message }
            });
        }
    });

    /**
     * DELETE /api/v1/parts-settlements/:id
     * 删除结算单（仅限草稿状态）
     */
    router.delete('/:id', authenticate, checkSettlementAdminAccess, (req, res) => {
        const transaction = db.transaction(() => {
            const { id } = req.params;

            const settlement = db.prepare('SELECT * FROM dealer_parts_settlements WHERE id = ?').get(id);
            if (!settlement) {
                throw new Error('结算单不存在');
            }

            if (settlement.status !== 'draft') {
                throw new Error('只能删除草稿状态的结算单');
            }

            db.prepare(`
                UPDATE parts_consumption
                SET settlement_id = NULL, settlement_status = 'pending'
                WHERE settlement_id = ?
            `).run(id);

            db.prepare('DELETE FROM dealer_parts_settlements WHERE id = ?').run(id);

            return { id };
        });

        try {
            transaction();
            res.json({
                success: true,
                message: '结算单已删除'
            });
        } catch (err) {
            console.error('Error deleting settlement:', err);
            res.status(400).json({
                success: false,
                error: { message: err.message }
            });
        }
    });

    return router;
};

function generateSettlementNumber(db, type) {
    const prefix = type === 'monthly' ? 'MS' : type === 'quarterly' ? 'QS' : 'CS';
    const now = new Date();
    const yearMonth = `${String(now.getFullYear() % 100).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const seqKey = `SETTLE-${prefix}-${yearMonth}`;

    const existing = db.prepare('SELECT last_sequence FROM service_sequences WHERE sequence_key = ?').get(seqKey);

    let seq;
    if (existing) {
        seq = existing.last_sequence + 1;
        db.prepare('UPDATE service_sequences SET last_sequence = ?, updated_at = datetime("now") WHERE sequence_key = ?').run(seq, seqKey);
    } else {
        seq = 1;
        db.prepare('INSERT INTO service_sequences (sequence_key, last_sequence, created_at, updated_at) VALUES (?, ?, datetime("now"), datetime("now"))').run(seqKey, seq);
    }

    return `${prefix}-${yearMonth}-${String(seq).padStart(4, '0')}`;
}
