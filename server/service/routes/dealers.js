/**
 * Dealers Routes
 * Manage dealer/distributor information
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/dealers
     * List all dealers (查询accounts表中account_type='DEALER'的记录)
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const { region, can_repair } = req.query;
            
            let conditions = ["account_type = 'DEALER'"];
            let params = [];

            if (region) {
                conditions.push('region = ?');
                params.push(region);
            }
            if (can_repair !== undefined) {
                conditions.push('can_repair = ?');
                params.push(can_repair === 'true' || can_repair === '1' ? 1 : 0);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const dealers = db.prepare(`
                SELECT * FROM accounts ${whereClause} ORDER BY name
            `).all(...params);

            res.json({
                success: true,
                data: dealers.map(d => ({
                    id: d.id,
                    name: d.name,
                    code: d.dealer_code,
                    dealer_type: d.dealer_level,
                    region: d.region,
                    country: d.country,
                    city: d.city,
                    contact_info: {
                        contact_person: d.contact_name,
                        email: d.email,
                        phone: d.phone
                    },
                    service_capabilities: {
                        can_repair: !!d.can_repair,
                        repair_level: d.repair_level
                    },
                    notes: d.notes,
                    created_at: d.created_at
                }))
            });
        } catch (err) {
            console.error('[Dealers] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/dealers/:id
     * Get dealer detail (查询accounts表)
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const dealer = db.prepare('SELECT * FROM accounts WHERE id = ? AND account_type = ?').get(req.params.id, 'DEALER');
            
            if (!dealer) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '经销商不存在' }
                });
            }

            // Get dealer's issue statistics
            const stats = db.prepare(`
                SELECT 
                    COUNT(*) as total_issues,
                    SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed_issues,
                    SUM(CASE WHEN status NOT IN ('Closed', 'Rejected') THEN 1 ELSE 0 END) as open_issues
                FROM issues WHERE dealer_id = ?
            `).get(req.params.id);

            res.json({
                success: true,
                data: {
                    id: dealer.id,
                    name: dealer.name,
                    code: dealer.dealer_code,
                    dealer_type: dealer.dealer_level,
                    region: dealer.region,
                    country: dealer.country,
                    city: dealer.city,
                    contact_info: {
                        contact_person: dealer.contact_name,
                        email: dealer.email,
                        phone: dealer.phone
                    },
                    service_capabilities: {
                        can_repair: !!dealer.can_repair,
                        repair_level: dealer.repair_level
                    },
                    notes: dealer.notes,
                    statistics: stats,
                    created_at: dealer.created_at,
                    updated_at: dealer.updated_at
                }
            });
        } catch (err) {
            console.error('[Dealers] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/dealers/:id/issues
     * Get issues for a specific dealer
     */
    router.get('/:id/issues', authenticate, (req, res) => {
        try {
            const { page = 1, page_size = 20, status } = req.query;
            
            // Check if user has permission (must be admin/lead or the dealer themselves)
            if (req.user.user_type === 'Dealer' && req.user.dealer_id !== parseInt(req.params.id)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看其他经销商的工单' }
                });
            }

            let conditions = ['i.dealer_id = ?'];
            let params = [req.params.id];

            if (status) {
                conditions.push('i.status = ?');
                params.push(status);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;
            const offset = (parseInt(page) - 1) * parseInt(page_size);

            const total = db.prepare(`
                SELECT COUNT(*) as total FROM issues i ${whereClause}
            `).get(...params).total;

            const issues = db.prepare(`
                SELECT 
                    i.id, i.issue_number, i.rma_number,
                    i.issue_type, i.issue_category, i.severity, i.status,
                    i.problem_description, i.serial_number,
                    i.reporter_name, i.region,
                    i.created_at, i.updated_at,
                    p.model_name as product_name
                FROM issues i
                LEFT JOIN products p ON i.product_id = p.id
                ${whereClause}
                ORDER BY i.created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: issues,
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Dealers] Issues error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/dealers
     * Create new dealer (Admin only) - 创建到accounts表
     */
    router.post('/', authenticate, (req, res) => {
        try {
            if (req.user.role !== 'Admin') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有Admin可以创建经销商' }
                });
            }

            const {
                name, code, dealer_type = 'FirstTier',
                region = '海外', country, city,
                contact_person, contact_email, contact_phone,
                can_repair = false, repair_level, notes
            } = req.body;

            if (!name || !code) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必填字段: name, code' }
                });
            }

            const result = db.prepare(`
                INSERT INTO accounts (name, dealer_code, dealer_level, account_type, region, country, city,
                    contact_name, email, phone,
                    can_repair, repair_level, notes)
                VALUES (?, ?, ?, 'DEALER', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                name, code.toUpperCase(), dealer_type,
                region, country || null, city || null,
                contact_person || null, contact_email || null, contact_phone || null,
                can_repair ? 1 : 0, repair_level || null, notes || null
            );

            res.status(201).json({
                success: true,
                data: { id: result.lastInsertRowid, code: code.toUpperCase() }
            });
        } catch (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'DUPLICATE_CODE', message: '经销商代码已存在' }
                });
            }
            console.error('[Dealers] Create error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/dealers/:id
     * Update dealer (Admin only) - 更新accounts表
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            if (req.user.role !== 'Admin') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有Admin可以修改经销商' }
                });
            }

            const dealer = db.prepare('SELECT * FROM accounts WHERE id = ? AND account_type = ?').get(req.params.id, 'DEALER');
            if (!dealer) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '经销商不存在' }
                });
            }

            // 字段映射: API字段 -> accounts表字段
            const fieldMapping = {
                name: 'name',
                dealer_type: 'dealer_level',
                region: 'region',
                country: 'country',
                city: 'city',
                contact_person: 'contact_name',
                contact_email: 'email',
                contact_phone: 'phone',
                can_repair: 'can_repair',
                repair_level: 'repair_level',
                notes: 'notes'
            };

            const updates = [];
            const params = [];

            for (const [apiField, dbField] of Object.entries(fieldMapping)) {
                if (req.body[apiField] !== undefined) {
                    updates.push(`${dbField} = ?`);
                    params.push(apiField === 'can_repair' ? (req.body[apiField] ? 1 : 0) : req.body[apiField]);
                }
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_CHANGES', message: '没有需要更新的字段' }
                });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(req.params.id);

            db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            res.json({ success: true });
        } catch (err) {
            console.error('[Dealers] Update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    return router;
};
