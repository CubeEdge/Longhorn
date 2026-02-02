/**
 * Compatibility Routes
 * Compatibility test results and queries
 * Phase 3: Knowledge base system
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/compatibility
     * List compatibility test results
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 20,
                product_model,
                target_type,
                target_brand,
                compatibility_status,
                search
            } = req.query;

            let conditions = [];
            let params = [];

            if (product_model) {
                conditions.push('ct.product_model = ?');
                params.push(product_model);
            }
            if (target_type) {
                conditions.push('ct.target_type = ?');
                params.push(target_type);
            }
            if (target_brand) {
                conditions.push('ct.target_brand LIKE ?');
                params.push(`%${target_brand}%`);
            }
            if (compatibility_status) {
                conditions.push('ct.compatibility_status = ?');
                params.push(compatibility_status);
            }
            if (search) {
                conditions.push(`(
                    ct.product_model LIKE ? OR
                    ct.target_brand LIKE ? OR
                    ct.target_model LIKE ?
                )`);
                const term = `%${search}%`;
                params.push(term, term, term);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`SELECT COUNT(*) as total FROM compatibility_tests ct ${whereClause}`).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const sql = `
                SELECT ct.*, u.username as tested_by_name
                FROM compatibility_tests ct
                LEFT JOIN users u ON ct.tested_by = u.id
                ${whereClause}
                ORDER BY ct.updated_at DESC
                LIMIT ? OFFSET ?
            `;

            const results = db.prepare(sql).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: results.map(formatCompatibilityResult),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Compatibility] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/compatibility/:id
     * Get compatibility detail
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const result = db.prepare(`
                SELECT ct.*, u.username as tested_by_name,
                       ka.id as article_id, ka.title as article_title, ka.slug as article_slug
                FROM compatibility_tests ct
                LEFT JOIN users u ON ct.tested_by = u.id
                LEFT JOIN knowledge_articles ka ON ct.related_article_id = ka.id
                WHERE ct.id = ?
            `).get(req.params.id);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '兼容性记录不存在' }
                });
            }

            res.json({
                success: true,
                data: {
                    ...formatCompatibilityDetail(result),
                    related_article: result.article_id ? {
                        id: result.article_id,
                        title: result.article_title,
                        slug: result.article_slug
                    } : null
                }
            });
        } catch (err) {
            console.error('[Compatibility] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/compatibility
     * Create compatibility test result (Internal only)
     */
    router.post('/', authenticate, (req, res) => {
        try {
            if (req.user.user_type !== 'Employee') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有内部员工可以创建兼容性记录' }
                });
            }

            const {
                product_model,
                firmware_version,
                target_type,
                target_brand,
                target_model,
                target_version,
                compatibility_status,
                test_date,
                test_notes,
                known_issues = [],
                workarounds = [],
                related_article_id
            } = req.body;

            if (!product_model || !target_type || !target_brand || !target_model || !compatibility_status) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必填字段' }
                });
            }

            const result = db.prepare(`
                INSERT INTO compatibility_tests (
                    product_model, firmware_version,
                    target_type, target_brand, target_model, target_version,
                    compatibility_status, test_date, test_notes,
                    known_issues, workarounds,
                    related_article_id, tested_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                product_model, firmware_version || null,
                target_type, target_brand, target_model, target_version || null,
                compatibility_status, test_date || null, test_notes || null,
                JSON.stringify(known_issues), JSON.stringify(workarounds),
                related_article_id || null, req.user.id
            );

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    created_at: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error('[Compatibility] Create error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/compatibility/:id
     * Update compatibility test result
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            if (req.user.user_type !== 'Employee') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有内部员工可以编辑兼容性记录' }
                });
            }

            const existing = db.prepare('SELECT id FROM compatibility_tests WHERE id = ?').get(req.params.id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '兼容性记录不存在' }
                });
            }

            const allowedFields = [
                'firmware_version', 'target_version',
                'compatibility_status', 'test_date', 'test_notes',
                'known_issues', 'workarounds', 'related_article_id'
            ];

            const updates = [];
            const params = [];

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    let value = req.body[field];
                    if (['known_issues', 'workarounds'].includes(field)) {
                        value = JSON.stringify(value);
                    }
                    updates.push(`${field} = ?`);
                    params.push(value);
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

            db.prepare(`UPDATE compatibility_tests SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), updated_at: new Date().toISOString() }
            });
        } catch (err) {
            console.error('[Compatibility] Update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/compatibility/matrix/:productModel
     * Get compatibility matrix for a product
     */
    router.get('/matrix/:productModel', authenticate, (req, res) => {
        try {
            const { productModel } = req.params;

            const results = db.prepare(`
                SELECT 
                    target_type,
                    target_brand,
                    target_model,
                    compatibility_status,
                    firmware_version,
                    test_date
                FROM compatibility_tests
                WHERE product_model = ?
                ORDER BY target_type, target_brand, target_model
            `).all(productModel);

            // Group by target type
            const matrix = {};
            for (const r of results) {
                if (!matrix[r.target_type]) {
                    matrix[r.target_type] = [];
                }
                matrix[r.target_type].push({
                    brand: r.target_brand,
                    model: r.target_model,
                    status: r.compatibility_status,
                    firmware: r.firmware_version,
                    test_date: r.test_date
                });
            }

            res.json({
                success: true,
                data: {
                    product_model: productModel,
                    matrix
                }
            });
        } catch (err) {
            console.error('[Compatibility] Matrix error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // Helper functions
    function formatCompatibilityResult(ct) {
        let knownIssues = [], workarounds = [];
        try { knownIssues = JSON.parse(ct.known_issues || '[]'); } catch (e) {}
        try { workarounds = JSON.parse(ct.workarounds || '[]'); } catch (e) {}

        return {
            id: ct.id,
            product_model: ct.product_model,
            firmware_version: ct.firmware_version,
            target_type: ct.target_type,
            target_brand: ct.target_brand,
            target_model: ct.target_model,
            target_version: ct.target_version,
            compatibility_status: ct.compatibility_status,
            test_date: ct.test_date,
            has_issues: knownIssues.length > 0,
            tested_by: ct.tested_by_name,
            updated_at: ct.updated_at
        };
    }

    function formatCompatibilityDetail(ct) {
        let knownIssues = [], workarounds = [];
        try { knownIssues = JSON.parse(ct.known_issues || '[]'); } catch (e) {}
        try { workarounds = JSON.parse(ct.workarounds || '[]'); } catch (e) {}

        return {
            id: ct.id,
            product_model: ct.product_model,
            firmware_version: ct.firmware_version,
            target_type: ct.target_type,
            target_brand: ct.target_brand,
            target_model: ct.target_model,
            target_version: ct.target_version,
            compatibility_status: ct.compatibility_status,
            test_date: ct.test_date,
            test_notes: ct.test_notes,
            known_issues: knownIssues,
            workarounds,
            tested_by: ct.tested_by ? { id: ct.tested_by, name: ct.tested_by_name } : null,
            created_at: ct.created_at,
            updated_at: ct.updated_at
        };
    }

    return router;
};
