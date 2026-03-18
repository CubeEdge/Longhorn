/**
 * Ticket Activities Routes (工单活动时间轴)
 * P2 架构升级
 * 
 * 参考: Service_API.md Section 23
 */

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const { execSync } = require('child_process');

module.exports = function (db, authenticate, serviceUpload) {
    // ==============================
    // Database Schema Initialization
    // ==============================
    try {
        // 1. Ensure accounts table has is_deleted column
        const accountColumns = db.prepare("PRAGMA table_info(accounts)").all();
        if (!accountColumns.some(c => c.name === 'is_deleted')) {
            console.log('[Activities DB] Adding is_deleted to accounts table...');
            db.exec("ALTER TABLE accounts ADD COLUMN is_deleted INTEGER DEFAULT 0; ALTER TABLE accounts ADD COLUMN deleted_at DATETIME;");
        }

        // 2. Ensure ticket_activities CHECK constraint is up to date
        // Since SQLite doesn't support ALTER CHECK, we must recreate the table if necessary
        const activitiesSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='ticket_activities'").get();
        if (activitiesSchema && !activitiesSchema.sql.includes('op_repair_report')) {
            console.log('[Activities DB] Upgrading ticket_activities table schema (new activity types)...');
            
            db.transaction(() => {
                // Rename old table
                db.exec("ALTER TABLE ticket_activities RENAME TO ticket_activities_old;");
                
                // Create new table with updated CHECK constraint
                db.exec(`
                    CREATE TABLE ticket_activities (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticket_id INTEGER NOT NULL,
                        activity_type TEXT NOT NULL CHECK(activity_type IN (
                            'status_change', 'comment', 'internal_note', 'attachment', 'mention',
                            'participant_added', 'assignment_change', 'priority_change', 'sla_breach',
                            'field_update', 'ticket_linked', 'system_event', 'diagnostic_report',
                            'soft_delete', 'creation', 'document_published', 'document_recalled',
                            'system', 'op_repair_report', 'shipping_info', 'receiving_info'
                        )),
                        content TEXT,
                        content_html TEXT,
                        metadata TEXT,
                        visibility TEXT DEFAULT 'all' CHECK(visibility IN ('all', 'internal', 'customer')),
                        actor_id INTEGER,
                        actor_name TEXT,
                        actor_role TEXT,
                        is_edited INTEGER DEFAULT 0,
                        edited_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
                    );
                `);

                // Migrate data
                db.exec(`
                    INSERT INTO ticket_activities (
                        id, ticket_id, activity_type, content, content_html, metadata,
                        visibility, actor_id, actor_name, actor_role, is_edited, edited_at, created_at
                    )
                    SELECT 
                        id, ticket_id, activity_type, content, content_html, metadata,
                        visibility, actor_id, actor_name, actor_role, is_edited, edited_at, created_at
                    FROM ticket_activities_old;
                `);

                // Re-create indexes
                db.exec("CREATE INDEX idx_activities_ticket ON ticket_activities(ticket_id);");
                db.exec("CREATE INDEX idx_activities_type ON ticket_activities(activity_type);");
                db.exec("CREATE INDEX idx_activities_actor ON ticket_activities(actor_id);");
                db.exec("CREATE INDEX idx_activities_created ON ticket_activities(created_at);");
                
                // Drop old table
                db.exec("DROP TABLE ticket_activities_old;");
            })();
            console.log('[Activities DB] ticket_activities table upgraded successfully.');
        }

        // 3. Ensure mention/invite stats tables exist
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_mention_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                mentioned_user_id INTEGER NOT NULL,
                mention_count INTEGER DEFAULT 0,
                last_mention_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (mentioned_user_id) REFERENCES users(id),
                UNIQUE(user_id, mentioned_user_id)
            );
            CREATE TABLE IF NOT EXISTS user_invite_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                invited_user_id INTEGER NOT NULL,
                invite_count INTEGER DEFAULT 0,
                last_invite_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (invited_user_id) REFERENCES users(id),
                UNIQUE(user_id, invited_user_id)
            );
        `);
    } catch (e) {
        console.error('[Activities DB] Initialization Error:', e.message);
    }

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

        // Match @[name](user_id) or @username patterns (supports Chinese characters)
        const mentionRegex = /@\[([^\]]+)\]\((\d+)\)|@([\w\u4e00-\u9fff]+)/g;
        const mentions = [];
        let match;

        while ((match = mentionRegex.exec(content)) !== null) {
            if (match[2]) {
                // @[name](user_id) format
                mentions.push({ user_id: parseInt(match[2]), name: match[1] });
            } else if (match[3]) {
                // @username format - look up by username or display_name case-insensitively
                const usernameInput = match[3].toLowerCase();
                const user = db.prepare(
                    'SELECT id, COALESCE(display_name, username) as name FROM users WHERE LOWER(username) = ? OR LOWER(display_name) = ?'
                ).get(usernameInput, usernameInput);
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
    function addParticipant(ticketId, userId, role = 'mentioned', addedBy = null, joinMethod = 'mention') {
        try {
            // Check if already participant
            const existing = db.prepare('SELECT id FROM ticket_participants WHERE ticket_id = ? AND user_id = ?').get(ticketId, userId);
            if (existing) {
                return false;
            }

            db.prepare(`
                INSERT INTO ticket_participants (ticket_id, user_id, role, added_by, join_method, joined_at) 
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(ticketId, userId, role, addedBy, joinMethod, new Date().toISOString());

            return true;
        } catch (e) {
            console.error('[Activities] addParticipant error:', e);
            return false;
        }
    }

    /**
     * Update mention stats for sorting users by frequency
     */
    function updateMentionStats(actorId, mentionedUserIds) {
        if (!actorId || !mentionedUserIds?.length) return;
        const now = new Date().toISOString();

        for (const mentionedId of mentionedUserIds) {
            if (mentionedId === actorId) continue;
            try {
                // Try update first
                const result = db.prepare(`
                    UPDATE user_mention_stats 
                    SET mention_count = mention_count + 1, last_mention_at = ?
                    WHERE user_id = ? AND mentioned_user_id = ?
                `).run(now, actorId, mentionedId);

                // If no row updated, insert
                if (result.changes === 0) {
                    db.prepare(`
                        INSERT INTO user_mention_stats (user_id, mentioned_user_id, mention_count, last_mention_at)
                        VALUES (?, ?, 1, ?)
                    `).run(actorId, mentionedId, now);
                }
            } catch (e) {
                console.error('[Activities] updateMentionStats error:', e);
            }
        }
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
                name: row.resolved_actor_name || row.actor_name || null,
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

            // Check ticket access
            const ticket = db.prepare('SELECT id, dealer_id FROM tickets WHERE id = ?').get(ticketId);
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

            // Get activities - JOIN users to resolve actor names
            const sql = `
                SELECT ta.*, 
                       COALESCE(u.display_name, u.username) as resolved_actor_name
                FROM ticket_activities ta
                LEFT JOIN users u ON ta.actor_id = u.id
                WHERE ${whereClause.replace(/ticket_id/g, 'ta.ticket_id').replace(/visibility/g, 'ta.visibility').replace(/activity_type/g, 'ta.activity_type')}
                ORDER BY ta.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const rows = db.prepare(sql).all(...params, parseInt(page_size), offset);

            // Enrich with attachments
            const data = rows.map(row => {
                const activity = formatActivity(row);
                // Bug fix: 必须同时验证 ticket_id 和 activity_id，防止跨工单附件关联错误
                const attachments = db.prepare(`
                    SELECT id, file_name, file_size, file_type, uploaded_at
                    FROM ticket_attachments
                    WHERE activity_id = ? AND ticket_id = ?
                `).all(row.id, ticketId);

                if (attachments.length > 0) {
                    activity.attachments = attachments.map(att => ({
                        ...att,
                        file_url: `/api/v1/system/attachments/${att.id}/download`,
                        thumbnail_url: att.file_type?.startsWith('image/') ? `/api/v1/system/attachments/${att.id}/thumbnail` : null
                    }));
                }
                return activity;
            });

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
    router.post('/:ticketId/activities', authenticate, serviceUpload.array('attachments', 10), (req, res) => {
        try {
            const { ticketId } = req.params;
            const user = req.user;

            // Extract from body (FormData or JSON)
            let {
                activity_type = 'comment',
                content,
                content_html,
                visibility = 'all',
                metadata,
                mentions = []
            } = req.body;

            // metadata and mentions may be JSON strings if sent via FormData
            if (typeof metadata === 'string') {
                try { metadata = JSON.parse(metadata); } catch (e) { metadata = null; }
            }
            if (typeof mentions === 'string') {
                try { mentions = JSON.parse(mentions); } catch (e) { mentions = []; }
            }

            if (!content && activity_type === 'comment' && (!req.files || req.files.length === 0)) {
                return res.status(400).json({ success: false, error: '内容不能为空且无附件' });
            }

            // Check ticket
            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
            const ticketTable = 'tickets';
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
                content || (req.files?.length > 0 ? "上传了附件" : ""),
                content_html,
                metadata ? JSON.stringify(metadata) : null,
                finalVisibility,
                user.id,
                user.display_name || user.username,
                actorRole,
                now
            );

            const activityId = result.lastInsertRowid;

            // Save attachments if any
            const attachments = [];
            if (req.files && req.files.length > 0) {
                // OPS Reference: Tickets/{Type}/{TicketNumber}/
                const typeMap = { 'rma': 'RMA', 'inquiry': 'Inquiry', 'svc': 'Inquiry', 'dealer_repair': 'DealerRepair' };
                const typeDir = typeMap[ticket.ticket_type.toLowerCase()] || 'Other';
                const ticketNumber = ticket.ticket_number || `T${ticketId}`;

                // Base Dir Calculation (Consistent with server/index.js)
                const SERVICE_BASE_DIR = (process.platform === 'darwin' && !__dirname.includes('KineCore'))
                    ? '/Volumes/fileserver/Service'
                    : path.join(__dirname, '../../data/Service');

                const finalTargetDir = path.join(SERVICE_BASE_DIR, 'Tickets', typeDir, ticketNumber);
                fs.ensureDirSync(finalTargetDir);

                req.files.forEach(file => {
                    const finalPath = path.join(finalTargetDir, file.filename);
                    try {
                        // Move from Temp to Final
                        fs.moveSync(file.path, finalPath, { overwrite: true });

                        // In DB we store the path relative to SERVICE_BASE_DIR
                        const dbPath = `Tickets/${typeDir}/${ticketNumber}/${file.filename}`;

                        const insertFile = db.prepare(`
                            INSERT INTO ticket_attachments (
                                ticket_id, activity_id, file_name, file_path, 
                                file_size, file_type, uploaded_by
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        `).run(
                            ticketId,
                            activityId,
                            file.originalname,
                            dbPath,
                            file.size,
                            file.mimetype,
                            user.id
                        );

                        // Fire-and-forget background thumbnail generation
                        if (file.mimetype.startsWith('image/')) {
                            const thumbDir = path.resolve(__dirname, '../../data/.thumbnails');
                            fs.ensureDirSync(thumbDir);
                            const thumbFilename = String(dbPath).replace(/[^a-zA-Z0-9.-]/g, '_') + '_thumb.webp';
                            const thumbPath = path.join(thumbDir, thumbFilename);
                            const THUMB_SIZE = 400; // Larger size for better clarity
                            
                            const ext = path.extname(finalPath).toLowerCase();
                            const isHeic = ext === '.heic' || ext === '.heif';
                            
                            if (isHeic && process.platform === 'darwin') {
                                // Use macOS native sips for HEIC/HEIF, then convert to WebP
                                const tempJpeg = thumbPath.replace('.webp', '_temp.jpg');
                                try {
                                    execSync(`sips -s format jpeg -s formatOptions 80 -Z ${THUMB_SIZE} "${finalPath}" --out "${tempJpeg}"`, {
                                        timeout: 15000,
                                        stdio: 'pipe'
                                    });
                                    sharp(tempJpeg)
                                        .rotate() // Auto-rotate based on EXIF orientation
                                        .webp({ quality: 80 })
                                        .toFile(thumbPath)
                                        .then(() => {
                                            fs.unlinkSync(tempJpeg);
                                            console.log(`[Activities] HEIC thumbnail generated: ${thumbFilename}`);
                                        })
                                        .catch(err => {
                                            console.error('[Activities] WebP conversion error:', err.message);
                                            if (fs.existsSync(tempJpeg)) fs.unlinkSync(tempJpeg);
                                        });
                                } catch (sipsErr) {
                                    console.error('[Activities] sips thumbnail error:', sipsErr.message);
                                    if (fs.existsSync(tempJpeg)) fs.unlinkSync(tempJpeg);
                                }
                            } else {
                                // Use sharp for other formats
                                sharp(finalPath)
                                    .rotate() // Respect EXIF orientation
                                    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
                                    .webp({ quality: 80 })
                                    .toFile(thumbPath)
                                    .catch(err => console.error('[Activities] Background Thumbnail Error:', err));
                            }
                        }

                        attachments.push({
                            id: insertFile.lastInsertRowid,
                            file_name: file.originalname,
                            file_size: file.size,
                            file_type: file.mimetype,
                            file_url: `/api/v1/system/attachments/${insertFile.lastInsertRowid}/download`,
                            thumbnail_url: file.mimetype.startsWith('image/') ? `/api/v1/system/attachments/${insertFile.lastInsertRowid}/thumbnail` : null
                        });
                    } catch (moveErr) {
                        console.error('[Activities] File Move Error:', moveErr);
                    }
                });

                // Update activity type if it was just an attachment upload
                if (!content && activity_type === 'comment') {
                    db.prepare('UPDATE ticket_activities SET activity_type = ? WHERE id = ?').run('attachment', activityId);
                }
            }

            // Ensure mentions are actual members (not just @text)
            const resolvedMentions = parseMentions(content);
            const allMentionedIds = Array.from(new Set([
                ...(Array.isArray(mentions) ? mentions.map(m => parseInt(m)) : []), // Ensure mentions from body are parsed as int
                ...resolvedMentions.map(m => m.user_id)
            ]));

            // Fetch full mention objects for notifications if needed, or just pass IDs
            const fullMentionObjects = [];
            for (const userId of allMentionedIds) {
                const mUser = db.prepare('SELECT id, username as name FROM users WHERE id = ?').get(userId);
                if (mUser) {
                    fullMentionObjects.push({ user_id: mUser.id, name: mUser.name });
                }
            }

            if (fullMentionObjects.length > 0) {
                // Notify mentioned users
                createMentionNotifications(ticketId, ticket.ticket_number, fullMentionObjects, user.id, user.display_name || user.username, activityId);

                // Add participants
                fullMentionObjects.forEach(mention => {
                    addParticipant(ticketId, mention.user_id, 'mentioned', user.id, 'mention');
                });

                // Update mention stats for user sorting
                updateMentionStats(user.id, fullMentionObjects.map(m => m.user_id));

                // Store mention info in the comment's metadata
                db.prepare(`
                    UPDATE ticket_activities SET metadata = ? WHERE id = ?
                `).run(
                    JSON.stringify({ ...metadata, mentioned_users: fullMentionObjects }),
                    activityId
                );
            }

            if (ticket.assigned_to && ticket.assigned_to !== user.id && !allMentionedIds.includes(ticket.assigned_to)) {
                try {
                    db.prepare(`
                        INSERT INTO notifications (
                            recipient_id, notification_type, title, content, icon,
                            related_type, related_id, action_url, metadata, created_at
                        ) VALUES (?, 'new_comment', ?, ?, 'info', 'ticket', ?, ?, ?, ?)
                    `).run(
                        ticket.assigned_to,
                        `${user.display_name || user.username} 更新了您负责的工单`,
                        `工单 ${ticket.ticket_number}`,
                        ticketId,
                        `/service/tickets/${ticketId}`,
                        JSON.stringify({ ticket_number: ticket.ticket_number, updated_by: user.display_name || user.username, activity_id: activityId }),
                        now
                    );
                } catch (e) {
                    console.error('[Activities] Failed to notify assignee:', e.message);
                }
            }

            // Update ticket's updated_at
            db.prepare(`UPDATE tickets SET updated_at = ? WHERE id = ?`).run(now, ticketId);

            // First response tracking (only for unified tickets)
            if (!ticket.first_response_at && user.department === 'marketing') {
                const responseMinutes = Math.floor((new Date(now) - new Date(ticket.created_at)) / 60000);
                db.prepare(`
                    UPDATE tickets SET first_response_at = ?, first_response_minutes = ? WHERE id = ?
                `).run(now, responseMinutes, ticketId);
            }

            res.json({
                success: true,
                data: {
                    id: activityId,
                    activity_type: !content && activity_type === 'comment' && req.files?.length > 0 ? 'attachment' : activity_type,
                    visibility: finalVisibility,
                    created_at: now,
                    attachments
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
            const { content, content_html, metadata } = req.body;
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

            // Only comments and certain reports can be edited
            if (!['comment', 'internal_note', 'op_repair_report', 'shipping_info', 'receiving_info'].includes(activity.activity_type)) {
                return res.status(400).json({ success: false, error: '该类型活动不可编辑' });
            }

            const now = new Date().toISOString();

            let updateSql = `
                UPDATE ticket_activities SET
                    content = ?,
                    content_html = ?,
                    is_edited = 1,
                    edited_at = ?
            `;
            let params = [content || null, content_html || null, now];

            if (metadata !== undefined) {
                updateSql += `, metadata = ?`;
                params.push(typeof metadata === 'string' ? metadata : (metadata ? JSON.stringify(metadata) : null));
            }
            updateSql += ` WHERE id = ?`;
            params.push(activityId);

            db.prepare(updateSql).run(...params);

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

    /**
     * POST /api/v1/tickets/:ticketId/activities/:activityId/correct
     * 活动更正 - 用于修正已提交活动中的数据错误
     * 权限: 原操作人、部门主管(Lead)、Admin、Exec
     * 支持的活动类型: op_repair_report, diagnostic_report, shipping_info等metadata活动
     */
    router.post('/:ticketId/activities/:activityId/correct', authenticate, (req, res) => {
        try {
            const { ticketId, activityId } = req.params;
            const { corrections, correction_reason, new_content } = req.body;
            // corrections: [{ field_path: 'repair_process.parts_replaced[0].name', old_value: '主板', new_value: '子板' }, ...]
            // new_content: 直接更新活动的content字段（适用于评论、发货信息等文本内容）
            const user = req.user;

            if (!correction_reason || correction_reason.trim().length === 0) {
                return res.status(400).json({ success: false, error: '更正原因为必填项' });
            }

            if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
                return res.status(400).json({ success: false, error: '请提供需要更正的字段' });
            }

            // 获取活动
            const activity = db.prepare(`
                SELECT a.*, t.ticket_number, t.ticket_type
                FROM ticket_activities a
                JOIN tickets t ON t.id = a.ticket_id
                WHERE a.id = ? AND a.ticket_id = ?
            `).get(activityId, ticketId);

            if (!activity) {
                return res.status(404).json({ success: false, error: '活动不存在' });
            }

            // 可更正的活动类型
            const correctableTypes = ['op_repair_report', 'diagnostic_report', 'shipping_info', 'comment', 'internal_note'];
            if (!correctableTypes.includes(activity.activity_type)) {
                return res.status(400).json({ success: false, error: `${activity.activity_type} 类型活动不支持更正` });
            }

            // 权限检查：原操作人、部门主管、Admin、Exec
            const isOriginalActor = activity.actor_id === user.id;
            const isAdmin = user.role === 'Admin' || user.role === 'Exec';
            const isLead = user.role === 'Lead';
            
            // 如果是Lead，检查是否是同部门
            let isSameDeptLead = false;
            if (isLead && activity.actor_id) {
                const actorUser = db.prepare('SELECT department_name FROM users WHERE id = ?').get(activity.actor_id);
                // 规范化部门代码比较
                const normalizeDept = (deptName) => {
                    if (!deptName) return '';
                    const codeMatch = deptName.match(/\(([A-Za-z]+)\)$/);
                    if (codeMatch) return codeMatch[1].toUpperCase();
                    const chineseMap = { '市场部': 'MS', '生产运营部': 'OP', '运营部': 'OP', '研发部': 'RD', '财务部': 'GE' };
                    return chineseMap[deptName] || deptName.toUpperCase();
                };
                const actorDept = actorUser ? normalizeDept(actorUser.department_name) : '';
                const userDept = user.department_code || normalizeDept(user.department_name);
                isSameDeptLead = actorDept && actorDept === userDept;
            }

            if (!isOriginalActor && !isAdmin && !isSameDeptLead) {
                return res.status(403).json({ success: false, error: '只有原操作人、部门主管或管理员可以更正此活动' });
            }

            const now = new Date().toISOString();

            // 解析现有metadata
            let metadata = {};
            try {
                metadata = activity.metadata ? JSON.parse(activity.metadata) : {};
            } catch (e) {
                metadata = {};
            }

            // 应用更正并记录历史
            const correctionHistory = metadata._correction_history || [];
            const newCorrectionEntry = {
                corrected_at: now,
                corrected_by: user.id,
                corrected_by_name: user.display_name || user.username,
                correction_reason: correction_reason.trim(),
                changes: []
            };

            // 处理每个更正项
            for (const correction of corrections) {
                const { field_path, old_value, new_value } = correction;
                if (!field_path) continue;

                // 记录更正历史
                newCorrectionEntry.changes.push({
                    field_path,
                    old_value,
                    new_value
                });

                // 应用更正到metadata (简单路径支持, 如 "repair_process.parts_replaced")
                const pathParts = field_path.split('.');
                let target = metadata;
                for (let i = 0; i < pathParts.length - 1; i++) {
                    const part = pathParts[i];
                    // 处理数组索引 如 parts_replaced[0]
                    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
                    if (arrayMatch) {
                        target = target[arrayMatch[1]][parseInt(arrayMatch[2])];
                    } else {
                        if (!target[part]) target[part] = {};
                        target = target[part];
                    }
                }
                const lastPart = pathParts[pathParts.length - 1];
                const lastArrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/);
                if (lastArrayMatch) {
                    target[lastArrayMatch[1]][parseInt(lastArrayMatch[2])] = new_value;
                } else {
                    target[lastPart] = new_value;
                }
            }

            // 更新历史记录
            correctionHistory.push(newCorrectionEntry);
            metadata._correction_history = correctionHistory;
            metadata._last_corrected_at = now;
            metadata._correction_count = correctionHistory.length;

            // 更新活动 - 支持更新 content 字段
            if (new_content !== undefined && new_content !== activity.content) {
                // 记录原始内容到历史
                if (!metadata._original_content) {
                    metadata._original_content = activity.content;
                }
                db.prepare(`
                    UPDATE ticket_activities SET
                        content = ?,
                        metadata = ?,
                        is_edited = 1,
                        edited_at = ?
                    WHERE id = ?
                `).run(new_content, JSON.stringify(metadata), now, activityId);
            } else {
                // 仅更新 metadata
                db.prepare(`
                    UPDATE ticket_activities SET
                        metadata = ?,
                        is_edited = 1,
                        edited_at = ?
                    WHERE id = ?
                `).run(JSON.stringify(metadata), now, activityId);
            }

            // 创建更正活动记录到时间轴 (使用 system_event 类型)
            const activityTypeLabel = {
                'op_repair_report': 'OP维修记录',
                'diagnostic_report': '诊断报告',
                'comment': '评论',
                'internal_note': '内部备注'
            }[activity.activity_type] || activity.activity_type;
            
            db.prepare(`
                INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, visibility, actor_id, actor_name, actor_role, created_at)
                VALUES (?, 'system_event', ?, ?, 'internal', ?, ?, ?, ?)
            `).run(
                ticketId,
                `【数据更正】${user.display_name || user.username} 更正了 ${activityTypeLabel}`,
                JSON.stringify({
                    event_type: 'activity_correction',
                    corrected_activity_id: parseInt(activityId),
                    corrected_activity_type: activity.activity_type,
                    correction_reason: correction_reason.trim(),
                    changes: newCorrectionEntry.changes
                }),
                user.id,
                user.display_name || user.username,
                user.department_code || 'MS',
                now
            );

            // 如果不是原操作人进行的更正，通知原操作人
            if (!isOriginalActor && activity.actor_id) {
                db.prepare(`
                    INSERT INTO notifications (user_id, type, ticket_id, content, metadata, created_at)
                    VALUES (?, 'activity_corrected', ?, ?, ?, ?)
                `).run(
                    activity.actor_id,
                    ticketId,
                    `${user.display_name || user.username} 更正了你在工单 ${activity.ticket_number} 中提交的 ${activity.activity_type === 'op_repair_report' ? '维修记录' : '活动'}`,
                    JSON.stringify({
                        corrected_by: user.id,
                        corrected_by_name: user.display_name || user.username,
                        correction_reason: correction_reason.trim()
                    }),
                    now
                );
            }

            res.json({ 
                success: true, 
                message: '更正成功',
                data: {
                    correction_count: correctionHistory.length,
                    corrected_at: now
                }
            });
        } catch (err) {
            console.error('[Activities] Correction error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    return router;
};
