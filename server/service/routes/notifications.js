/**
 * Notifications Routes (系统通知)
 * P2 架构升级 - macOS 26 风格通知中心
 * 
 * 参考: Service_API.md Section 19, Service_DataModel.md 2.3
 */

const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    // ==============================
    // Helper Functions
    // ==============================

    /**
     * Format notification for response
     */
    function formatNotification(row) {
        return {
            id: row.id,
            type: row.notification_type,
            title: row.title,
            content: row.content,
            icon: row.icon || 'info',
            related_type: row.related_type,
            related_id: row.related_id,
            action_url: row.action_url,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            is_read: !!row.is_read,
            read_at: row.read_at,
            is_archived: !!row.is_archived,
            created_at: row.created_at
        };
    }

    /**
     * Create a notification
     */
    function createNotification(options) {
        const {
            recipient_id,
            notification_type,
            title,
            content,
            icon = 'info',
            related_type,
            related_id,
            action_url,
            metadata
        } = options;

        const now = new Date().toISOString();

        const result = db.prepare(`
            INSERT INTO notifications (
                recipient_id, notification_type, title, content, icon,
                related_type, related_id, action_url, metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            recipient_id,
            notification_type,
            title,
            content,
            icon,
            related_type || null,
            related_id || null,
            action_url || null,
            metadata ? JSON.stringify(metadata) : null,
            now
        );

        return result.lastInsertRowid;
    }

    // ==============================
    // Routes
    // ==============================

    /**
     * GET /api/v1/notifications
     * Get notifications for current user
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                notification_type,
                is_read,
                is_archived,
                page = 1,
                page_size = 20
            } = req.query;
            const userId = req.user.id;

            let conditions = ['recipient_id = ?'];
            let params = [userId];

            if (notification_type) {
                conditions.push('notification_type = ?');
                params.push(notification_type);
            }

            if (is_read !== undefined) {
                conditions.push('is_read = ?');
                params.push(is_read === 'true' || is_read === '1' ? 1 : 0);
            }

            // Default: don't show archived
            if (is_archived === undefined) {
                conditions.push('is_archived = 0');
            } else if (is_archived === 'true' || is_archived === '1') {
                conditions.push('is_archived = 1');
            } else {
                conditions.push('is_archived = 0');
            }

            const whereClause = conditions.join(' AND ');
            const offset = (parseInt(page) - 1) * parseInt(page_size);

            // Count
            const total = db.prepare(`
                SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}
            `).get(...params).count;

            // Get notifications
            const sql = `
                SELECT * FROM notifications
                WHERE ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;

            const rows = db.prepare(sql).all(...params, parseInt(page_size), offset);
            const data = rows.map(formatNotification);

            res.json({
                success: true,
                data,
                pagination: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Notifications] List error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/v1/notifications/unread-count
     * Get unread notification count
     */
    router.get('/unread-count', authenticate, (req, res) => {
        try {
            const userId = req.user.id;

            const result = db.prepare(`
                SELECT COUNT(*) as count FROM notifications
                WHERE recipient_id = ? AND is_read = 0 AND is_archived = 0
            `).get(userId);

            // Also get counts by type for badge display
            const byType = db.prepare(`
                SELECT notification_type, COUNT(*) as count 
                FROM notifications
                WHERE recipient_id = ? AND is_read = 0 AND is_archived = 0
                GROUP BY notification_type
            `).all(userId);

            res.json({
                success: true,
                data: {
                    total: result.count,
                    by_type: byType.reduce((acc, row) => {
                        acc[row.notification_type] = row.count;
                        return acc;
                    }, {})
                }
            });
        } catch (err) {
            console.error('[Notifications] Unread count error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/v1/notifications/:id
     * Get single notification
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const notification = db.prepare(`
                SELECT * FROM notifications WHERE id = ? AND recipient_id = ?
            `).get(id, userId);

            if (!notification) {
                return res.status(404).json({ success: false, error: '通知不存在' });
            }

            res.json({
                success: true,
                data: formatNotification(notification)
            });
        } catch (err) {
            console.error('[Notifications] Get error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * PATCH /api/v1/notifications/:id/read
     * Mark notification as read
     */
    router.patch('/:id/read', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const now = new Date().toISOString();

            const result = db.prepare(`
                UPDATE notifications SET is_read = 1, read_at = ?
                WHERE id = ? AND recipient_id = ?
            `).run(now, id, userId);

            if (result.changes === 0) {
                return res.status(404).json({ success: false, error: '通知不存在' });
            }

            res.json({ success: true, message: '已标记为已读' });
        } catch (err) {
            console.error('[Notifications] Mark read error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * PATCH /api/v1/notifications/read-all
     * Mark all notifications as read
     */
    router.patch('/read-all', authenticate, (req, res) => {
        try {
            const userId = req.user.id;
            const { notification_type } = req.body;
            const now = new Date().toISOString();

            let sql = 'UPDATE notifications SET is_read = 1, read_at = ? WHERE recipient_id = ? AND is_read = 0';
            let params = [now, userId];

            if (notification_type) {
                sql += ' AND notification_type = ?';
                params.push(notification_type);
            }

            const result = db.prepare(sql).run(...params);

            res.json({
                success: true,
                message: `已将 ${result.changes} 条通知标记为已读`
            });
        } catch (err) {
            console.error('[Notifications] Mark all read error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * PATCH /api/v1/notifications/:id/archive
     * Archive notification
     */
    router.patch('/:id/archive', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = db.prepare(`
                UPDATE notifications SET is_archived = 1
                WHERE id = ? AND recipient_id = ?
            `).run(id, userId);

            if (result.changes === 0) {
                return res.status(404).json({ success: false, error: '通知不存在' });
            }

            res.json({ success: true, message: '已归档' });
        } catch (err) {
            console.error('[Notifications] Archive error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * DELETE /api/v1/notifications/:id
     * Delete notification
     */
    router.delete('/:id', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = db.prepare(`
                DELETE FROM notifications WHERE id = ? AND recipient_id = ?
            `).run(id, userId);

            if (result.changes === 0) {
                return res.status(404).json({ success: false, error: '通知不存在' });
            }

            res.json({ success: true, message: '删除成功' });
        } catch (err) {
            console.error('[Notifications] Delete error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * DELETE /api/v1/notifications/clear-all
     * Clear all notifications (move to archive or delete)
     */
    router.delete('/clear-all', authenticate, (req, res) => {
        try {
            const userId = req.user.id;
            const { permanent } = req.query;

            if (permanent === 'true') {
                // Permanently delete all
                const result = db.prepare(`
                    DELETE FROM notifications WHERE recipient_id = ?
                `).run(userId);
                
                res.json({
                    success: true,
                    message: `已删除 ${result.changes} 条通知`
                });
            } else {
                // Archive all
                const result = db.prepare(`
                    UPDATE notifications SET is_archived = 1
                    WHERE recipient_id = ? AND is_archived = 0
                `).run(userId);

                res.json({
                    success: true,
                    message: `已归档 ${result.changes} 条通知`
                });
            }
        } catch (err) {
            console.error('[Notifications] Clear all error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ==============================
    // Notification Creation Helpers (exported for use by other modules)
    // ==============================

    /**
     * Create SLA warning notification
     */
    router.createSlaWarningNotification = function(ticketId, ticketNumber, recipientId, slaDueAt, remainingTime) {
        return createNotification({
            recipient_id: recipientId,
            notification_type: 'sla_warning',
            title: 'SLA 即将超时',
            content: `工单 ${ticketNumber} 将在 ${remainingTime} 后超时`,
            icon: 'warning',
            related_type: 'ticket',
            related_id: ticketId,
            action_url: `/service/tickets/${ticketId}`,
            metadata: { ticket_number: ticketNumber, sla_due_at: slaDueAt, remaining_time: remainingTime }
        });
    };

    /**
     * Create SLA breach notification
     */
    router.createSlaBreachNotification = function(ticketId, ticketNumber, recipientId) {
        return createNotification({
            recipient_id: recipientId,
            notification_type: 'sla_breach',
            title: 'SLA 已超时',
            content: `工单 ${ticketNumber} 已超过 SLA 时限`,
            icon: 'warning',
            related_type: 'ticket',
            related_id: ticketId,
            action_url: `/service/tickets/${ticketId}`,
            metadata: { ticket_number: ticketNumber }
        });
    };

    /**
     * Create assignment notification
     */
    router.createAssignmentNotification = function(ticketId, ticketNumber, recipientId, assignedBy) {
        return createNotification({
            recipient_id: recipientId,
            notification_type: 'assignment',
            title: '新工单指派',
            content: `工单 ${ticketNumber} 已指派给您`,
            icon: 'ticket',
            related_type: 'ticket',
            related_id: ticketId,
            action_url: `/service/tickets/${ticketId}`,
            metadata: { ticket_number: ticketNumber, assigned_by: assignedBy }
        });
    };

    /**
     * Create status change notification
     */
    router.createStatusChangeNotification = function(ticketId, ticketNumber, recipientId, fromNode, toNode) {
        return createNotification({
            recipient_id: recipientId,
            notification_type: 'status_change',
            title: '工单状态变更',
            content: `工单 ${ticketNumber}: ${fromNode} → ${toNode}`,
            icon: 'info',
            related_type: 'ticket',
            related_id: ticketId,
            action_url: `/service/tickets/${ticketId}`,
            metadata: { ticket_number: ticketNumber, from_node: fromNode, to_node: toNode }
        });
    };

    /**
     * Create new comment notification
     */
    router.createNewCommentNotification = function(ticketId, ticketNumber, recipientId, commenterName) {
        return createNotification({
            recipient_id: recipientId,
            notification_type: 'new_comment',
            title: '新评论',
            content: `${commenterName} 在工单 ${ticketNumber} 中添加了评论`,
            icon: 'info',
            related_type: 'ticket',
            related_id: ticketId,
            action_url: `/service/tickets/${ticketId}`,
            metadata: { ticket_number: ticketNumber, commenter: commenterName }
        });
    };

    /**
     * Create system announcement
     */
    router.createSystemAnnouncement = function(recipientIds, title, content) {
        const now = new Date().toISOString();
        
        for (const recipientId of recipientIds) {
            createNotification({
                recipient_id: recipientId,
                notification_type: 'system_announce',
                title,
                content,
                icon: 'info'
            });
        }
    };

    return router;
};
