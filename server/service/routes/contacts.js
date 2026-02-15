/**
 * Contacts Routes
 * 联系人管理独立路由
 * 
 * 提供联系人的独立CRUD操作，不依赖账户路径
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/contacts
     * 联系人列表查询（跨账户）
     * Query参数:
     * - account_id: 按账户筛选
     * - status: 状态筛选 (ACTIVE/INACTIVE/PRIMARY)
     * - search: 名称/邮箱/电话模糊搜索
     * - page, page_size: 分页
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const { 
                account_id,
                status,
                search,
                page = 1, 
                page_size = 20 
            } = req.query;

            let conditions = [];
            let params = [];

            if (account_id) {
                conditions.push('c.account_id = ?');
                params.push(account_id);
            }
            if (status) {
                conditions.push('c.status = ?');
                params.push(status);
            }
            if (search) {
                conditions.push('(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)');
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const offset = (parseInt(page) - 1) * parseInt(page_size);

            // 查询总数
            const totalResult = db.prepare(`
                SELECT COUNT(*) as total FROM contacts c ${whereClause}
            `).get(...params);

            // 查询列表（包含账户信息）
            const contacts = db.prepare(`
                SELECT 
                    c.id,
                    c.account_id,
                    c.name,
                    c.email,
                    c.phone,
                    c.wechat,
                    c.job_title,
                    c.department,
                    c.status,
                    c.is_primary,
                    c.language_preference,
                    c.communication_preference,
                    c.notes,
                    c.created_at,
                    c.updated_at,
                    a.name as account_name,
                    a.account_type,
                    a.account_number
                FROM contacts c
                JOIN accounts a ON c.account_id = a.id
                ${whereClause}
                ORDER BY c.created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: contacts,
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total: totalResult.total,
                    total_pages: Math.ceil(totalResult.total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Contacts] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/contacts/:id
     * 获取联系人详情
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const contactId = req.params.id;

            const contact = db.prepare(`
                SELECT 
                    c.*,
                    a.name as account_name,
                    a.account_type,
                    a.account_number,
                    a.service_tier
                FROM contacts c
                JOIN accounts a ON c.account_id = a.id
                WHERE c.id = ?
            `).get(contactId);

            if (!contact) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Contact not found' }
                });
            }

            // 获取该联系人的工单历史
            const tickets = db.prepare(`
                SELECT 'inquiry' as type, ticket_number, status, created_at, problem_summary as summary
                FROM inquiry_tickets WHERE contact_id = ?
                UNION ALL
                SELECT 'rma' as type, ticket_number, status, created_at, problem_description as summary
                FROM rma_tickets WHERE contact_id = ?
                UNION ALL
                SELECT 'dealer_repair' as type, ticket_number, status, created_at, problem_description as summary
                FROM dealer_repairs WHERE contact_id = ?
                ORDER BY created_at DESC
                LIMIT 10
            `).all(contactId, contactId, contactId);

            res.json({
                success: true,
                data: {
                    ...contact,
                    recent_tickets: tickets
                }
            });
        } catch (err) {
            console.error('[Contacts] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/contacts/:id
     * 更新联系人信息
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const contactId = req.params.id;
            const updates = req.body;

            // 检查联系人是否存在
            const existing = db.prepare('SELECT id, account_id, status FROM contacts WHERE id = ?').get(contactId);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Contact not found' }
                });
            }

            // 构建更新字段
            const allowedFields = [
                'name', 'email', 'phone', 'wechat',
                'job_title', 'department',
                'language_preference', 'communication_preference',
                'status', 'is_primary', 'notes'
            ];

            const fields = [];
            const values = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = ?`);
                    if (key === 'is_primary') {
                        values.push(value ? 1 : 0);
                    } else {
                        values.push(value);
                    }
                }
            }

            if (fields.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' }
                });
            }

            // 特殊处理：如果设为 PRIMARY，先将该账户下其他 PRIMARY 改为 ACTIVE
            if (updates.status === 'PRIMARY' || updates.is_primary === true) {
                db.prepare(`
                    UPDATE contacts 
                    SET status = 'ACTIVE', is_primary = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE account_id = ? AND id != ? AND (status = 'PRIMARY' OR is_primary = 1)
                `).run(existing.account_id, contactId);
            }

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(contactId);

            db.prepare(`
                UPDATE contacts SET ${fields.join(', ')} WHERE id = ?
            `).run(...values);

            res.json({
                success: true,
                data: { id: contactId, updated: true }
            });
        } catch (err) {
            console.error('[Contacts] Update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * DELETE /api/v1/contacts/:id
     * 删除联系人（硬删除 - 真正从数据库删除）
     * 注：由于 contacts 表有 UNIQUE(account_id, email) 约束，
     * 软删除会导致编辑时无法重新创建相同 email 的联系人
     * 
     * 删除前会将工单表中引用该联系人的记录置为 NULL，
     * 避免外键约束错误
     */
    router.delete('/:id', authenticate, (req, res) => {
        try {
            const contactId = req.params.id;

            // 检查联系人是否存在
            const existing = db.prepare('SELECT id, status FROM contacts WHERE id = ?').get(contactId);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Contact not found' }
                });
            }

            // 先将工单表中引用该联系人的记录置为 NULL，避免外键约束错误
            db.prepare('UPDATE inquiry_tickets SET contact_id = NULL WHERE contact_id = ?').run(contactId);
            db.prepare('UPDATE rma_tickets SET contact_id = NULL WHERE contact_id = ?').run(contactId);
            db.prepare('UPDATE dealer_repairs SET contact_id = NULL WHERE contact_id = ?').run(contactId);

            // 硬删除：真正从数据库中删除记录
            db.prepare('DELETE FROM contacts WHERE id = ?').run(contactId);

            res.json({
                success: true,
                data: { id: contactId, deleted: true }
            });
        } catch (err) {
            console.error('[Contacts] Delete error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    return router;
};
