/**
 * Knowledge Audit Log Routes
 * Admin用于查询和追踪知识库所有写操作
 */

const express = require('express');
const crypto = require('crypto');

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * 记录审计日志的工具函数
     * @param {Object} params - 日志参数
     */
    function logKnowledgeAudit(params) {
        const {
            operation,
            operation_detail,
            article_id,
            article_title,
            article_slug,
            category,
            product_line,
            product_models,
            changes_summary,
            old_status,
            new_status,
            source_type,
            source_reference,
            batch_id,
            user_id,
            user_name,
            user_role
        } = params;

        try {
            const stmt = db.prepare(`
                INSERT INTO knowledge_audit_log (
                    operation, operation_detail,
                    article_id, article_title, article_slug,
                    category, product_line, product_models,
                    changes_summary, old_status, new_status,
                    source_type, source_reference, batch_id,
                    user_id, user_name, user_role
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                operation,
                operation_detail || null,
                article_id || null,
                article_title,
                article_slug || null,
                category || null,
                product_line || null,
                product_models ? JSON.stringify(product_models) : null,
                changes_summary ? JSON.stringify(changes_summary) : null,
                old_status || null,
                new_status || null,
                source_type || null,
                source_reference || null,
                batch_id || null,
                user_id,
                user_name,
                user_role || null
            );

            console.log(`[Audit] ${operation} by ${user_name} - ${article_title}`);
        } catch (err) {
            console.error('[Audit] Failed to log:', err.message);
            // 不抛出错误，避免影响主业务
        }
    }

    /**
     * GET /api/v1/knowledge/audit
     * 获取知识库操作审计日志（仅Admin）
     */
    router.get('/', authenticate, (req, res) => {
        try {
            // 权限检查：仅Admin
            if (req.user.role !== 'Admin') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '仅管理员可访问审计日志' }
                });
            }

            const {
                page = 1,
                page_size = 50,
                operation, // 过滤：操作类型
                user_id, // 过滤：操作人
                product_line, // 过滤：产品线
                batch_id, // 过滤：批次
                start_date, // 过滤：开始日期
                end_date, // 过滤：结束日期
                search // 搜索：文章标题
            } = req.query;

            let conditions = [];
            let params = [];

            if (operation) {
                conditions.push('operation = ?');
                params.push(operation);
            }

            if (user_id) {
                conditions.push('user_id = ?');
                params.push(parseInt(user_id));
            }

            if (product_line) {
                conditions.push('product_line = ?');
                params.push(product_line);
            }

            if (batch_id) {
                conditions.push('batch_id = ?');
                params.push(batch_id);
            }

            if (start_date) {
                conditions.push('created_at >= ?');
                params.push(start_date);
            }

            if (end_date) {
                conditions.push('created_at <= ?');
                params.push(end_date + ' 23:59:59');
            }

            if (search) {
                conditions.push('article_title LIKE ?');
                params.push(`%${search}%`);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // 统计总数
            const countSql = `SELECT COUNT(*) as total FROM knowledge_audit_log ${whereClause}`;
            const total = db.prepare(countSql).get(...params).total;

            // 分页查询
            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const sql = `
                SELECT 
                    id, operation, operation_detail,
                    article_id, article_title, article_slug,
                    category, product_line, product_models,
                    changes_summary, old_status, new_status,
                    source_type, source_reference, batch_id,
                    user_id, user_name, user_role,
                    created_at
                FROM knowledge_audit_log
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;

            const logs = db.prepare(sql).all(...params, parseInt(page_size), offset);

            // 格式化输出
            const formattedLogs = logs.map(log => ({
                ...log,
                product_models: log.product_models ? JSON.parse(log.product_models) : null,
                changes_summary: log.changes_summary ? JSON.parse(log.changes_summary) : null
            }));

            res.json({
                success: true,
                data: formattedLogs,
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });

        } catch (err) {
            console.error('[Audit] Query error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/knowledge/audit/stats
     * 获取审计日志统计信息（仅Admin）
     */
    router.get('/stats', authenticate, (req, res) => {
        try {
            if (req.user.role !== 'Admin') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '仅管理员可访问' }
                });
            }

            // 按操作类型统计
            const byOperation = db.prepare(`
                SELECT operation, COUNT(*) as count
                FROM knowledge_audit_log
                GROUP BY operation
                ORDER BY count DESC
            `).all();

            // 按用户统计
            const byUser = db.prepare(`
                SELECT user_id, user_name, COUNT(*) as count
                FROM knowledge_audit_log
                GROUP BY user_id
                ORDER BY count DESC
                LIMIT 10
            `).all();

            // 按产品线统计
            const byProductLine = db.prepare(`
                SELECT product_line, COUNT(*) as count
                FROM knowledge_audit_log
                WHERE product_line IS NOT NULL
                GROUP BY product_line
                ORDER BY count DESC
            `).all();

            // 最近7天的操作趋势
            const last7Days = db.prepare(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as count
                FROM knowledge_audit_log
                WHERE created_at >= DATE('now', '-7 days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `).all();

            // 总统计
            const totalStats = db.prepare(`
                SELECT 
                    COUNT(*) as total_operations,
                    COUNT(DISTINCT user_id) as total_users,
                    COUNT(DISTINCT batch_id) as total_batches
                FROM knowledge_audit_log
            `).get();

            res.json({
                success: true,
                data: {
                    by_operation: byOperation,
                    by_user: byUser,
                    by_product_line: byProductLine,
                    last_7_days: last7Days,
                    total: totalStats
                }
            });

        } catch (err) {
            console.error('[Audit] Stats error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // 导出日志记录函数供其他模块使用
    router.logAudit = logKnowledgeAudit;

    // 生成批次ID的工具函数
    router.generateBatchId = () => {
        return crypto.randomBytes(8).toString('hex');
    };

    return router;
};
