/**
 * Search Synonyms Routes
 * CRUD API for managing synonym groups used in knowledge search expansion
 */

const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/synonyms
     * List all synonym groups
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const rows = db.prepare(`
                SELECT s.*, u.username as created_by_name
                FROM search_synonyms s
                LEFT JOIN users u ON s.created_by = u.id
                ORDER BY s.category ASC
            `).all();

            const groups = rows.map(r => ({
                id: r.id,
                category: r.category,
                words: JSON.parse(r.words),
                created_by: r.created_by,
                created_by_name: r.created_by_name,
                created_at: r.created_at,
                updated_at: r.updated_at
            }));

            // Stats
            const totalWords = groups.reduce((sum, g) => sum + g.words.length, 0);

            res.json({
                success: true,
                data: groups,
                meta: {
                    total_groups: groups.length,
                    total_words: totalWords
                }
            });
        } catch (err) {
            console.error('[Synonyms] List error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/v1/synonyms
     * Create a new synonym group (Admin/Lead only)
     */
    router.post('/', authenticate, (req, res) => {
        try {
            if (req.user.role !== 'Admin' && req.user.role !== 'Lead') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '需要管理员权限' }
                });
            }

            const { category, words } = req.body;
            if (!category || !words || !Array.isArray(words) || words.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '需要分类名和至少 2 个同义词' }
                });
            }

            const result = db.prepare(`
                INSERT INTO search_synonyms (category, words, created_by)
                VALUES (?, ?, ?)
            `).run(category.trim(), JSON.stringify(words.map(w => w.trim())), req.user.id);

            // Rebuild in-memory cache
            rebuildSynonymCache(db);

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    category: category.trim(),
                    words: words.map(w => w.trim())
                }
            });
        } catch (err) {
            console.error('[Synonyms] Create error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * PUT /api/v1/synonyms/:id
     * Update a synonym group (Admin/Lead only)
     */
    router.put('/:id', authenticate, (req, res) => {
        try {
            if (req.user.role !== 'Admin' && req.user.role !== 'Lead') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '需要管理员权限' }
                });
            }

            const { id } = req.params;
            const { category, words } = req.body;

            const existing = db.prepare('SELECT id FROM search_synonyms WHERE id = ?').get(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '同义词组不存在' }
                });
            }

            if (!words || !Array.isArray(words) || words.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '至少需要 2 个同义词' }
                });
            }

            const updates = [];
            const params = [];

            if (category !== undefined) {
                updates.push('category = ?');
                params.push(category.trim());
            }
            updates.push('words = ?');
            params.push(JSON.stringify(words.map(w => w.trim())));
            updates.push("updated_at = datetime('now')");
            params.push(id);

            db.prepare(`
                UPDATE search_synonyms SET ${updates.join(', ')} WHERE id = ?
            `).run(...params);

            // Rebuild in-memory cache
            rebuildSynonymCache(db);

            res.json({
                success: true,
                data: { id: parseInt(id), category: category?.trim(), words: words.map(w => w.trim()) }
            });
        } catch (err) {
            console.error('[Synonyms] Update error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * DELETE /api/v1/synonyms/:id
     * Delete a synonym group (Admin/Lead only)
     */
    router.delete('/:id', authenticate, (req, res) => {
        try {
            if (req.user.role !== 'Admin' && req.user.role !== 'Lead') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '需要管理员权限' }
                });
            }

            const { id } = req.params;
            const existing = db.prepare('SELECT id, category FROM search_synonyms WHERE id = ?').get(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '同义词组不存在' }
                });
            }

            db.prepare('DELETE FROM search_synonyms WHERE id = ?').run(id);

            // Rebuild in-memory cache
            rebuildSynonymCache(db);

            res.json({
                success: true,
                data: { id: parseInt(id), deleted: true }
            });
        } catch (err) {
            console.error('[Synonyms] Delete error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    return router;
};

/**
 * Rebuild the global synonym cache from database
 * Called after every CRUD operation
 */
let synonymMap = new Map();

function rebuildSynonymCache(db) {
    try {
        const rows = db.prepare('SELECT words FROM search_synonyms').all();
        const newMap = new Map();
        rows.forEach(row => {
            const group = JSON.parse(row.words);
            group.forEach(word => {
                const lowerWord = word.toLowerCase();
                const existing = newMap.get(lowerWord) || new Set();
                group.forEach(w => existing.add(w));
                newMap.set(lowerWord, existing);
            });
        });
        synonymMap = newMap;
        console.log(`[Synonyms] Cache rebuilt: ${rows.length} groups, ${newMap.size} entries`);
    } catch (err) {
        console.error('[Synonyms] Cache rebuild error:', err);
    }
}

/**
 * Get synonyms for a keyword (used by knowledge.js)
 */
function expandWithSynonyms(keyword) {
    const synonyms = synonymMap.get(keyword.toLowerCase());
    if (synonyms) {
        return Array.from(synonyms);
    }
    return [keyword];
}

// Export helpers for use by knowledge.js
module.exports.rebuildSynonymCache = rebuildSynonymCache;
module.exports.expandWithSynonyms = expandWithSynonyms;
