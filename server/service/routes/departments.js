const express = require('express');

/**
 * Department and Dispatch Rule Routes
 * 管理部门设置及自动分发规则
 */
module.exports = function (db, authenticate) {
    const router = express.Router();

    /**
     * Middleware: Lead or Admin only for their specific department
     */
    const leadOrAdminOnly = (req, res, next) => {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        if (user.role === 'Admin' || user.role === 'Exec') {
            return next();
        }

        if (user.role === 'Lead') {
            // Further checks could be added here to ensure lead only modifies their own dept
            // We'll trust current implementation for now or add a match check for department_id
            return next();
        }

        return res.status(403).json({ error: 'Access denied. Lead or Admin role required.' });
    };

    /**
     * GET /api/v1/departments/:deptId/dispatch-rules
     * 获取指定部门的所有分发规则
     */
    router.get('/:deptId/dispatch-rules', authenticate, leadOrAdminOnly, (req, res) => {
        try {
            const { deptId } = req.params;

            // Fetch rules and join with users to get assignee names
            const rules = db.prepare(`
                SELECT dr.*, COALESCE(u.display_name, u.username) as assignee_name
                FROM dispatch_rules dr
                LEFT JOIN users u ON dr.default_assignee_id = u.id
                WHERE dr.department_id = ?
            `).all(deptId);

            res.json({ success: true, data: rules });
        } catch (err) {
            console.error('[Departments] Get Dispatch Rules Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * POST /api/v1/departments/:deptId/dispatch-rules
     * 批量更新或创建部门分发规则
     */
    router.post('/:deptId/dispatch-rules', authenticate, leadOrAdminOnly, (req, res) => {
        try {
            const { deptId } = req.params;
            const { rules } = req.body; // Array of { ticket_type, node_key, default_assignee_id, is_enabled }

            if (!Array.isArray(rules)) {
                return res.status(400).json({ error: 'Invalid rules format. Must be an array.' });
            }

            const upsertRule = db.prepare(`
                INSERT INTO dispatch_rules (
                    department_id, ticket_type, node_key, default_assignee_id, is_enabled, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
                )
                ON CONFLICT(department_id, ticket_type, node_key) DO UPDATE SET
                    default_assignee_id = EXCLUDED.default_assignee_id,
                    is_enabled = EXCLUDED.is_enabled,
                    updated_at = CURRENT_TIMESTAMP
            `);

            db.transaction(() => {
                for (const r of rules) {
                    upsertRule.run(
                        deptId,
                        r.ticket_type,
                        r.node_key,
                        r.default_assignee_id || null,
                        r.is_enabled !== undefined ? (r.is_enabled ? 1 : 0) : 1
                    );
                }
            })();

            res.json({ success: true, message: 'Dispatch rules updated' });
        } catch (err) {
            console.error('[Departments] Update Dispatch Rules Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * GET /api/v1/departments/my/info
     * 获取当前用户所属部门的基本信息及 ID
     */
    router.get('/my/info', authenticate, (req, res) => {
        try {
            const userId = req.user.id;
            const dept = db.prepare(`
                SELECT d.id, d.name, d.code, d.auto_dispatch_enabled
                FROM users u
                JOIN departments d ON u.department_id = d.id
                WHERE u.id = ?
            `).get(userId);

            if (!dept) {
                return res.status(404).json({ error: 'Department not found for current user' });
            }

            res.json({ success: true, data: { ...dept, auto_dispatch_enabled: !!dept.auto_dispatch_enabled } });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * GET /api/v1/departments/code/:code/info
     * 获取指定名称的部门信息
     */
    router.get('/code/:code/info', authenticate, (req, res) => {
        try {
            const code = req.params.code;
            const dept = db.prepare(`
                SELECT id, name, code, auto_dispatch_enabled
                FROM departments
                WHERE code = ?
            `).get(code);

            if (!dept) {
                return res.status(404).json({ error: 'Department not found' });
            }

            res.json({ success: true, data: { ...dept, auto_dispatch_enabled: !!dept.auto_dispatch_enabled } });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * PATCH /api/v1/departments/:deptId/settings
     * 更新部门设置（如全局自动分发开关）
     */
    router.patch('/:deptId/settings', authenticate, leadOrAdminOnly, (req, res) => {
        try {
            const { deptId } = req.params;
            const { auto_dispatch_enabled } = req.body;

            db.prepare('UPDATE departments SET auto_dispatch_enabled = ? WHERE id = ?')
                .run(auto_dispatch_enabled ? 1 : 0, deptId);

            res.json({ success: true, message: 'Department settings updated' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
