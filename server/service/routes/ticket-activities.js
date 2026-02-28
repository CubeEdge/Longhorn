/**
 * Ticket Activities Routes (工单活动时间轴)
 * P2 架构升级
 * 
 * 参考: Service_API.md Section 23
 */

const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    // ==============================
    // Helper Functions
    // ==============================

    /**
     * Parse @mentions from content
     * Returns array of mentioned user ids
     */
    function parseMentions(content) {
        if (!content) return [];
        
        // Match @[name](user_id) or @username patterns
        const mentionRegex = /@\[([^\]]+)\]\((\d+)\)|@(\w+)/g;
        const mentions = [];
        let match;
        
        while ((match = mentionRegex.exec(content)) !== null) {
            if (match[2]) {
                // @[name](user_id) format
                mentions.push({ user_id: parseInt(match[2]), name: match[1] });
            } else if (match[3]) {
                // @username format - need to look up user
                const user = db.prepare('SELECT id, name FROM users WHERE name LIKE ?').get(`%${match[3]}%`);
                if (user) {
                    mentions.push({ user_id: user.id, name: user.name });
                }
            }
        }
        
        return mentions;
    }

    /**
     * Create notification for mentioned users
     */
    function createMentionNotifications(ticketId, ticketNumber, mentions, actorId, actorName, activityId) {
        const now = new Date().toISOString();
        
        for (const mention of mentions) {
            if (mention.user_id === actorId) continue; // Don't notify self
            
            db.prepare(`
                INSERT INTO notifications (
                    recipient_id, notification_type, title, content, icon,
                    related_type, related_id, action_url, metadata, created_at
                ) VALUES (?, 'mention', ?, ?, 'ticket', 'ticket', ?, ?, ?, ?)
            `).run(
                mention.user_id,
                `${actorName} 在工单中 @提及了您`,
                `工单 ${ticketNumber}`,
                ticketId,
                `/service/tickets/${ticketId}`,
                JSON.stringify({ ticket_number: ticketNumber, mentioned_by: actorName, activity_id: activityId }),
                now
            );
        }
    }

    /**
     * Add user to ticket participants
     */
    function addParticipant(ticketId, userId, role, addedBy) {
        const ticket = db.prepare('SELECT participants FROM tickets WHERE id = ?').get(ticketId);
        let participants = [];
        
        try {
            participants = ticket.participants ? JSON.parse(ticket.participants) : [];
        } catch (e) {
            participants = [];
        }
        
        // Check if already participant
        if (participants.some(p => p.user_id === userId)) {
            return false;
        }
        
        participants.push({
            user_id: userId,
            role: role || 'mentioned',
            added_at: new Date().toISOString(),
            added_by: addedBy
        });
        
        db.prepare('UPDATE tickets SET participants = ? WHERE id = ?')
            .run(JSON.stringify(participants), ticketId);
        
        return true;
    }

    /**
     * Format activity for response
     */
    function formatActivity(row) {
        return {
            id: row.id,
            ticket_id: row.ticket_id,
            activity_type: row.activity_type,
            content: row.content,
            content_html: row.content_html,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            visibility: row.visibility,
            actor: row.actor_id ? {
                id: row.actor_id,
                name: row.actor_name,
                role: row.actor_role
            } : null,
            is_edited: !!row.is_edited,
            edited_at: row.edited_at,
            created_at: row.created_at
        };
    }

    // ==============================
    // Routes
    // ==============================

    /**
     * GET /api/v1/tickets/:ticketId/activities
     * Get activities for a ticket
     */
    router.get('/:ticketId/activities', authenticate, (req, res) => {
        try {
            const { ticketId } = req.params;
            const { visibility, activity_type, page = 1, page_size = 50 } = req.query;
            const user = req.user;

            // Check ticket access - support both unified tickets and legacy inquiry_tickets
            let ticket = db.prepare('SELECT id, dealer_id FROM tickets WHERE id = ?').get(ticketId);
            if (!ticket) {
                // Fallback to inquiry_tickets table
                ticket = db.prepare('SELECT id, dealer_id FROM inquiry_tickets WHERE id = ?').get(ticketId);
            }
            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            if (user.user_type === 'Dealer' && ticket.dealer_id !== user.dealer_id) {
                return res.status(403).json({ success: false, error: '无权访问此工单' });
            }

            // Build query
            let conditions = ['ticket_id = ?'];
            let params = [ticketId];

            // Visibility filtering based on user role
            if (user.user_type === 'Dealer') {
                // Dealers can only see 'all' visibility
                conditions.push("visibility = 'all'");
            } else if (user.department === 'marketing') {
                // MS can see 'all' and 'internal'
                conditions.push("visibility IN ('all', 'internal')");
            } else if (visibility) {
                conditions.push('visibility = ?');
                params.push(visibility);
            }
            // OP/RD can see all visibilities

            if (activity_type) {
                conditions.push('activity_type = ?');
                params.push(activity_type);
            }

            const whereClause = conditions.join(' AND ');
            const offset = (parseInt(page) - 1) * parseInt(page_size);

            // Count
            const total = db.prepare(`SELECT COUNT(*) as count FROM ticket_activities WHERE ${whereClause}`).get(...params).count;

            // Get activities
            const sql = `
                SELECT * FROM ticket_activities
                WHERE ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;

            const rows = db.prepare(sql).all(...params, parseInt(page_size), offset);
            const data = rows.map(formatActivity);

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
            console.error('[Activities] List error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * POST /api/v1/tickets/:ticketId/activities
     * Add activity (comment/note)
     */
    router.post('/:ticketId/activities', authenticate, (req, res) => {
        try {
            const { ticketId } = req.params;
            const {
                activity_type = 'comment',
                content,
                content_html,
                visibility = 'all',
                metadata
            } = req.body;
            const user = req.user;

            if (!content && activity_type === 'comment') {
                return res.status(400).json({ success: false, error: '内容不能为空' });
            }

            // Check ticket - support both unified tickets and legacy inquiry_tickets
            let ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
            let ticketTable = 'tickets';
            if (!ticket) {
                // Fallback to inquiry_tickets table
                ticket = db.prepare('SELECT * FROM inquiry_tickets WHERE id = ?').get(ticketId);
                ticketTable = 'inquiry_tickets';
            }
            if (!ticket) {
                return res.status(404).json({ success: false, error: '工单不存在' });
            }

            // Check permission
            if (user.user_type === 'Dealer' && ticket.dealer_id !== user.dealer_id) {
                return res.status(403).json({ success: false, error: '无权操作此工单' });
            }

            // Dealers can only add 'all' visibility comments
            let finalVisibility = visibility;
            if (user.user_type === 'Dealer') {
                finalVisibility = 'all';
            }

            // Determine actor role
            let actorRole = 'MS';
            if (user.user_type === 'Dealer') {
                actorRole = 'DL';
            } else if (user.department === 'production') {
                actorRole = 'OP';
            } else if (user.department === 'rd') {
                actorRole = 'RD';
            } else if (user.department === 'finance') {
                actorRole = 'GE';
            }

            const now = new Date().toISOString();

            // Insert activity
            const result = db.prepare(`
                INSERT INTO ticket_activities (
                    ticket_id, activity_type, content, content_html, metadata,
                    visibility, actor_id, actor_name, actor_role, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                ticketId,
                activity_type,
                content,
                content_html,
                metadata ? JSON.stringify(metadata) : null,
                finalVisibility,
                user.id,
                user.name,
                actorRole,
                now
            );

            const activityId = result.lastInsertRowid;

            // Handle @mentions
            const mentions = parseMentions(content);
            if (mentions.length > 0) {
                // Create mention notifications
                createMentionNotifications(ticketId, ticket.ticket_number, mentions, user.id, user.name, activityId);
                
                // Add mentioned users as participants
                for (const mention of mentions) {
                    addParticipant(ticketId, mention.user_id, 'mentioned', user.id);
                }

                // Record mention activity
                db.prepare(`
                    INSERT INTO ticket_activities (
                        ticket_id, activity_type, content, metadata,
                        visibility, actor_id, actor_name, actor_role, created_at
                    ) VALUES (?, 'mention', ?, ?, 'internal', ?, ?, ?, ?)
                `).run(
                    ticketId,
                    `提及了 ${mentions.map(m => m.name).join(', ')}`,
                    JSON.stringify({ mentioned_users: mentions }),
                    user.id,
                    user.name,
                    actorRole,
                    now
                );
            }

            // Update ticket's updated_at
            db.prepare(`UPDATE ${ticketTable} SET updated_at = ? WHERE id = ?`).run(now, ticketId);

            // First response tracking (only for unified tickets)
            if (ticketTable === 'tickets' && !ticket.first_response_at && user.department === 'marketing') {
                const responseMinutes = Math.floor((new Date(now) - new Date(ticket.created_at)) / 60000);
                db.prepare(`
                    UPDATE tickets SET first_response_at = ?, first_response_minutes = ? WHERE id = ?
                `).run(now, responseMinutes, ticketId);
            }

            res.json({
                success: true,
                data: {
                    id: activityId,
                    activity_type,
                    visibility: finalVisibility,
                    created_at: now
                }
            });
        } catch (err) {
            console.error('[Activities] Create error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * PATCH /api/v1/tickets/:ticketId/activities/:activityId
     * Edit activity (only comments, by original author)
     */
    router.patch('/:ticketId/activities/:activityId', authenticate, (req, res) => {
        try {
            const { ticketId, activityId } = req.params;
            const { content, content_html } = req.body;
            const user = req.user;

            const activity = db.prepare(`
                SELECT * FROM ticket_activities WHERE id = ? AND ticket_id = ?
            `).get(activityId, ticketId);

            if (!activity) {
                return res.status(404).json({ success: false, error: '活动不存在' });
            }

            // Only author can edit
            if (activity.actor_id !== user.id) {
                return res.status(403).json({ success: false, error: '只能编辑自己的评论' });
            }

            // Only comments can be edited
            if (!['comment', 'internal_note'].includes(activity.activity_type)) {
                return res.status(400).json({ success: false, error: '该类型活动不可编辑' });
            }

            const now = new Date().toISOString();

            db.prepare(`
                UPDATE ticket_activities SET
                    content = ?,
                    content_html = ?,
                    is_edited = 1,
                    edited_at = ?
                WHERE id = ?
            `).run(content, content_html || null, now, activityId);

            res.json({ success: true, message: '更新成功' });
        } catch (err) {
            console.error('[Activities] Update error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * DELETE /api/v1/tickets/:ticketId/activities/:activityId
     * Delete activity (only comments, by original author or admin)
     */
    router.delete('/:ticketId/activities/:activityId', authenticate, (req, res) => {
        try {
            const { ticketId, activityId } = req.params;
            const user = req.user;

            const activity = db.prepare(`
                SELECT * FROM ticket_activities WHERE id = ? AND ticket_id = ?
            `).get(activityId, ticketId);

            if (!activity) {
                return res.status(404).json({ success: false, error: '活动不存在' });
            }

            // Only author or admin can delete
            if (activity.actor_id !== user.id && user.role !== 'admin') {
                return res.status(403).json({ success: false, error: '无权删除此评论' });
            }

            // Only comments can be deleted
            if (!['comment', 'internal_note'].includes(activity.activity_type)) {
                return res.status(400).json({ success: false, error: '该类型活动不可删除' });
            }

            db.prepare('DELETE FROM ticket_activities WHERE id = ?').run(activityId);

            res.json({ success: true, message: '删除成功' });
        } catch (err) {
            console.error('[Activities] Delete error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    return router;
};
