/**
 * Knowledge Base Routes
 * Knowledge articles with visibility tiers
 * Phase 3: Knowledge base system
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/knowledge
     * List knowledge articles with visibility filtering
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 20,
                category,
                product_line,
                visibility,
                status = 'Published',
                search,
                tag
            } = req.query;

            const user = req.user;
            let conditions = ['ka.status = ?'];
            let params = [status];

            // Visibility filtering based on user type
            const visibilityConditions = buildVisibilityConditions(user);
            conditions.push(`(${visibilityConditions.sql})`);
            params.push(...visibilityConditions.params);

            if (category) {
                conditions.push('ka.category = ?');
                params.push(category);
            }
            if (product_line) {
                conditions.push('ka.product_line = ?');
                params.push(product_line);
            }
            if (visibility && (user.role === 'Admin' || user.role === 'Lead')) {
                conditions.push('ka.visibility = ?');
                params.push(visibility);
            }
            if (tag) {
                conditions.push('ka.tags LIKE ?');
                params.push(`%"${tag}"%`);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            // Full-text search if provided
            let searchJoin = '';
            if (search) {
                searchJoin = `
                    INNER JOIN knowledge_articles_fts fts ON fts.rowid = ka.id
                    AND fts MATCH ?
                `;
                params.unshift(search);
            }

            const countSql = `
                SELECT COUNT(*) as total 
                FROM knowledge_articles ka
                ${searchJoin}
                ${whereClause}
            `;
            const total = db.prepare(countSql).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const sql = `
                SELECT 
                    ka.id, ka.title, ka.slug, ka.summary,
                    ka.category, ka.subcategory, ka.tags,
                    ka.product_line, ka.visibility,
                    ka.view_count, ka.helpful_count, ka.not_helpful_count,
                    ka.published_at, ka.created_at,
                    u.username as author_name
                FROM knowledge_articles ka
                ${searchJoin}
                LEFT JOIN users u ON ka.created_by = u.id
                ${whereClause}
                ORDER BY ka.published_at DESC, ka.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const articles = db.prepare(sql).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: articles.map(formatArticleListItem),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Knowledge] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/knowledge/:idOrSlug
     * Get article detail
     */
    router.get('/:idOrSlug', authenticate, (req, res) => {
        try {
            const { idOrSlug } = req.params;
            const isNumeric = /^\d+$/.test(idOrSlug);

            const article = db.prepare(`
                SELECT ka.*, u.username as author_name, updater.username as updated_by_name
                FROM knowledge_articles ka
                LEFT JOIN users u ON ka.created_by = u.id
                LEFT JOIN users updater ON ka.updated_by = updater.id
                WHERE ${isNumeric ? 'ka.id = ?' : 'ka.slug = ?'}
            `).get(idOrSlug);

            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            // Check visibility permission
            if (!canAccessArticle(req.user, article)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权访问此文章' }
                });
            }

            // Increment view count
            db.prepare('UPDATE knowledge_articles SET view_count = view_count + 1 WHERE id = ?').run(article.id);

            // Get related articles
            const relatedArticles = db.prepare(`
                SELECT ka.id, ka.title, ka.slug, ka.category, kal.link_type
                FROM knowledge_article_links kal
                JOIN knowledge_articles ka ON ka.id = kal.target_article_id
                WHERE kal.source_article_id = ? AND ka.status = 'Published'
            `).all(article.id);

            res.json({
                success: true,
                data: {
                    ...formatArticleDetail(article),
                    related_articles: relatedArticles.map(a => ({
                        id: a.id,
                        title: a.title,
                        slug: a.slug,
                        category: a.category,
                        link_type: a.link_type
                    })),
                    permissions: {
                        can_edit: canEditArticle(req.user, article)
                    }
                }
            });
        } catch (err) {
            console.error('[Knowledge] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/knowledge
     * Create new article (Internal users only)
     */
    router.post('/', authenticate, (req, res) => {
        try {
            if (req.user.user_type !== 'Employee') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '只有内部员工可以创建文章' }
                });
            }

            const {
                title,
                slug,
                summary,
                content,
                category,
                subcategory,
                tags = [],
                product_line,
                product_models = [],
                firmware_versions = [],
                visibility = 'Internal',
                department_ids = [],
                status = 'Draft'
            } = req.body;

            if (!title || !content || !category) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必填字段: title, content, category' }
                });
            }

            // Generate slug if not provided
            const finalSlug = slug || generateSlug(title);

            const result = db.prepare(`
                INSERT INTO knowledge_articles (
                    title, slug, summary, content,
                    category, subcategory, tags,
                    product_line, product_models, firmware_versions,
                    visibility, department_ids,
                    status, published_at,
                    created_by
                ) VALUES (
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?,
                    ?, ?,
                    ?
                )
            `).run(
                title, finalSlug, summary || null, content,
                category, subcategory || null, JSON.stringify(tags),
                product_line || null, JSON.stringify(product_models), JSON.stringify(firmware_versions),
                visibility, JSON.stringify(department_ids),
                status, status === 'Published' ? new Date().toISOString() : null,
                req.user.id
            );

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    slug: finalSlug,
                    status,
                    created_at: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error('[Knowledge] Create error:', err);
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'DUPLICATE_SLUG', message: '文章别名已存在' }
                });
            }
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/knowledge/:id
     * Update article
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const article = db.prepare('SELECT * FROM knowledge_articles WHERE id = ?').get(req.params.id);
            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            if (!canEditArticle(req.user, article)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权编辑此文章' }
                });
            }

            const allowedFields = [
                'title', 'slug', 'summary', 'content',
                'category', 'subcategory', 'tags',
                'product_line', 'product_models', 'firmware_versions',
                'visibility', 'department_ids', 'status'
            ];

            const updates = [];
            const params = [];

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    let value = req.body[field];
                    if (['tags', 'product_models', 'firmware_versions', 'department_ids'].includes(field)) {
                        value = JSON.stringify(value);
                    }
                    updates.push(`${field} = ?`);
                    params.push(value);
                }
            }

            // Handle status change to Published
            if (req.body.status === 'Published' && article.status !== 'Published') {
                updates.push('published_at = CURRENT_TIMESTAMP');
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_CHANGES', message: '没有需要更新的字段' }
                });
            }

            // Save version history
            db.prepare(`
                INSERT INTO knowledge_article_versions (article_id, version, title, content, change_summary, created_by)
                SELECT id, COALESCE((SELECT MAX(version) FROM knowledge_article_versions WHERE article_id = ?), 0) + 1, title, content, ?, ?
                FROM knowledge_articles WHERE id = ?
            `).run(article.id, req.body.change_summary || '更新文章', req.user.id, article.id);

            updates.push('updated_by = ?', 'updated_at = CURRENT_TIMESTAMP');
            params.push(req.user.id, req.params.id);

            db.prepare(`UPDATE knowledge_articles SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), updated_at: new Date().toISOString() }
            });
        } catch (err) {
            console.error('[Knowledge] Update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/knowledge/:id/feedback
     * Submit feedback for article
     */
    router.post('/:id/feedback', authenticate, (req, res) => {
        try {
            const article = db.prepare('SELECT id FROM knowledge_articles WHERE id = ?').get(req.params.id);
            if (!article) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '文章不存在' }
                });
            }

            const { is_helpful, feedback_text } = req.body;
            if (is_helpful === undefined) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '请指定是否有帮助' }
                });
            }

            db.prepare(`
                INSERT INTO knowledge_article_feedback (article_id, is_helpful, feedback_text, user_id, user_type)
                VALUES (?, ?, ?, ?, ?)
            `).run(req.params.id, is_helpful ? 1 : 0, feedback_text || null, req.user.id, req.user.user_type);

            // Update counts
            if (is_helpful) {
                db.prepare('UPDATE knowledge_articles SET helpful_count = helpful_count + 1 WHERE id = ?').run(req.params.id);
            } else {
                db.prepare('UPDATE knowledge_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = ?').run(req.params.id);
            }

            res.json({ success: true });
        } catch (err) {
            console.error('[Knowledge] Feedback error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/knowledge/categories/stats
     * Get article counts by category
     */
    router.get('/categories/stats', authenticate, (req, res) => {
        try {
            const user = req.user;
            const visibilityConditions = buildVisibilityConditions(user);

            const stats = db.prepare(`
                SELECT category, COUNT(*) as count
                FROM knowledge_articles ka
                WHERE status = 'Published' AND (${visibilityConditions.sql})
                GROUP BY category
                ORDER BY count DESC
            `).all(...visibilityConditions.params);

            res.json({
                success: true,
                data: stats
            });
        } catch (err) {
            console.error('[Knowledge] Category stats error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // Helper functions
    function buildVisibilityConditions(user) {
        if (user.role === 'Admin') {
            return { sql: '1=1', params: [] };
        }

        const conditions = [];
        const params = [];

        // Public articles are always visible
        conditions.push("ka.visibility = 'Public'");

        if (user.user_type === 'Dealer') {
            // Dealers can see Public and Dealer visibility
            conditions.push("ka.visibility = 'Dealer'");
        } else if (user.user_type === 'Employee') {
            // Employees can see Public, Dealer, Internal, and their department's articles
            conditions.push("ka.visibility IN ('Dealer', 'Internal')");
            if (user.department_id) {
                conditions.push("(ka.visibility = 'Department' AND ka.department_ids LIKE ?)");
                params.push(`%${user.department_id}%`);
            }
        }

        return { sql: conditions.join(' OR '), params };
    }

    function canAccessArticle(user, article) {
        if (user.role === 'Admin') return true;
        if (article.visibility === 'Public') return true;
        if (article.visibility === 'Dealer' && (user.user_type === 'Dealer' || user.user_type === 'Employee')) return true;
        if (article.visibility === 'Internal' && user.user_type === 'Employee') return true;
        if (article.visibility === 'Department' && user.user_type === 'Employee') {
            const deptIds = JSON.parse(article.department_ids || '[]');
            return deptIds.includes(user.department_id);
        }
        return false;
    }

    function canEditArticle(user, article) {
        if (user.role === 'Admin') return true;
        if (user.role === 'Lead') return true;
        return article.created_by === user.id;
    }

    function generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50) + '-' + Date.now().toString(36);
    }

    function formatArticleListItem(article) {
        let tags = [];
        try { tags = JSON.parse(article.tags || '[]'); } catch (e) {}

        return {
            id: article.id,
            title: article.title,
            slug: article.slug,
            summary: article.summary,
            category: article.category,
            subcategory: article.subcategory,
            tags,
            product_line: article.product_line,
            visibility: article.visibility,
            view_count: article.view_count,
            helpful_count: article.helpful_count,
            not_helpful_count: article.not_helpful_count,
            author: article.author_name,
            published_at: article.published_at,
            created_at: article.created_at
        };
    }

    function formatArticleDetail(article) {
        let tags = [], productModels = [], firmwareVersions = [], departmentIds = [];
        try { tags = JSON.parse(article.tags || '[]'); } catch (e) {}
        try { productModels = JSON.parse(article.product_models || '[]'); } catch (e) {}
        try { firmwareVersions = JSON.parse(article.firmware_versions || '[]'); } catch (e) {}
        try { departmentIds = JSON.parse(article.department_ids || '[]'); } catch (e) {}

        return {
            id: article.id,
            title: article.title,
            slug: article.slug,
            summary: article.summary,
            content: article.content,
            category: article.category,
            subcategory: article.subcategory,
            tags,
            product_line: article.product_line,
            product_models: productModels,
            firmware_versions: firmwareVersions,
            visibility: article.visibility,
            department_ids: departmentIds,
            status: article.status,
            view_count: article.view_count,
            helpful_count: article.helpful_count,
            not_helpful_count: article.not_helpful_count,
            author: { id: article.created_by, name: article.author_name },
            updated_by: article.updated_by ? { id: article.updated_by, name: article.updated_by_name } : null,
            published_at: article.published_at,
            created_at: article.created_at,
            updated_at: article.updated_at
        };
    }

    return router;
};
