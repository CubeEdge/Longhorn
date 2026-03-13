/**
 * System Routes
 * System dictionaries, configuration, and utilities
 */

const express = require('express');
const path = require('path');
const fs = require('fs-extra');

module.exports = function (db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/system/public-settings
     * Get public system settings for clients
     */
    router.get('/public-settings', (req, res) => {
        try {
            const settings = db.prepare('SELECT system_name, ai_search_history_limit, show_daily_word, notification_refresh_interval, require_finance_confirmation FROM system_settings LIMIT 1').get();
            res.json({
                success: true,
                data: {
                    system_name: settings?.system_name || 'Longhorn System',
                    ai_search_history_limit: parseInt(settings?.ai_search_history_limit) || 10,
                    show_daily_word: Boolean(settings?.show_daily_word),
                    notification_refresh_interval: parseInt(settings?.notification_refresh_interval) || 30,
                    require_finance_confirmation: settings?.require_finance_confirmation !== 0
                }
            });
        } catch (err) {
            console.error('[System] Public settings error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/system/dictionaries
     * Get all system dictionaries for frontend dropdowns
     */
    router.get('/dictionaries', authenticate, (req, res) => {
        try {
            const dicts = db.prepare(`
                SELECT dict_type, dict_key, dict_value, sort_order
                FROM system_dictionaries
                WHERE is_active = 1
                ORDER BY dict_type, sort_order
            `).all();

            // Group by type
            const grouped = {};
            for (const d of dicts) {
                if (!grouped[d.dict_type]) {
                    grouped[d.dict_type] = [];
                }
                grouped[d.dict_type].push({
                    key: d.dict_key,
                    value: d.dict_value
                });
            }

            // Format for API response
            res.json({
                success: true,
                data: {
                    issue_types: grouped.issue_type || [],
                    issue_categories: grouped.issue_category || [],
                    severity_levels: grouped.severity || [],
                    payment_channels: grouped.payment_channel || [],
                    regions: grouped.region || [],
                    rma_product_codes: grouped.rma_product_code || [],
                    rma_channel_codes: grouped.rma_channel_code || [],

                    // Static values not in DB
                    status_list: [
                        { key: 'Pending', value: '待处理' },
                        { key: 'Assigned', value: '已分配' },
                        { key: 'InProgress', value: '处理中' },
                        { key: 'AwaitingVerification', value: '待验证' },
                        { key: 'Closed', value: '已关闭' },
                        { key: 'Rejected', value: '已拒绝' }
                    ],
                    reporter_types: [
                        { key: 'Customer', value: '客户' },
                        { key: 'Dealer', value: '经销商' },
                        { key: 'Internal', value: '内部' }
                    ]
                }
            });
        } catch (err) {
            console.error('[System] Dictionaries error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/system/rma-rules
     * Get RMA numbering rules
     */
    router.get('/rma-rules', authenticate, (req, res) => {
        try {
            const productCodes = db.prepare(`
                SELECT dict_key as code, dict_value as name
                FROM system_dictionaries
                WHERE dict_type = 'rma_product_code' AND is_active = 1
                ORDER BY sort_order
            `).all();

            const channelCodes = db.prepare(`
                SELECT dict_key as code, dict_value as name
                FROM system_dictionaries
                WHERE dict_type = 'rma_channel_code' AND is_active = 1
                ORDER BY sort_order
            `).all();

            res.json({
                success: true,
                data: {
                    format: 'RA + 产品类型(2) + 渠道(2) + 年份(2) + 序号(3)',
                    example: 'RA090126001',
                    product_codes: Object.fromEntries(productCodes.map(p => [p.code, p.name])),
                    channel_codes: Object.fromEntries(channelCodes.map(c => [c.code, c.name]))
                }
            });
        } catch (err) {
            console.error('[System] RMA rules error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/system/products
     * Get product models list for dropdowns (distinct model names from installed base)
     */
    router.get('/products', authenticate, (req, res) => {
        try {
            const { category } = req.query;

            // Get distinct model names from products (installed base) table
            // Use MIN(id) as representative ID for each model_name
            let sql = `
                SELECT 
                    MIN(id) as id,
                    model_name as name, 
                    MAX(product_line) as line, 
                    MAX(product_family) as family
                FROM products 
                WHERE model_name IS NOT NULL AND model_name != ''
            `;
            let params = [];

            if (category) {
                sql += ' AND product_family = ?';
                params.push(category);
            }

            sql += ' GROUP BY model_name ORDER BY model_name';

            const products = db.prepare(sql).all(...params);

            res.json({
                success: true,
                data: products
            });
        } catch (err) {
            console.error('[System] Products error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/system/users
     * Get users list for assignment dropdowns
     * P2: Sort by: 1) current user's dept first, 2) MS > OP > RD, 3) name
     */
    router.get('/users', authenticate, (req, res) => {
        try {
            const { department, role } = req.query;
            const currentUserId = req.user.id;

            let conditions = ["(u.status = 'active' OR u.status IS NULL)"];
            let params = [];

            if (department) {
                // department can be numeric ID or code string (OP/MS/RD)
                // d.code stores 'OP','MS','RD', d.name stores Chinese
                conditions.push('(u.department_id = ? OR d.code = ?)');
                params.push(department, department);
            }
            if (role) {
                conditions.push('u.role = ?');
                params.push(role);
            }

            // P2: Get current user's department code for sorting
            const currentUser = db.prepare(`
                SELECT d.code as dept_code 
                FROM users u 
                LEFT JOIN departments d ON u.department_id = d.id 
                WHERE u.id = ?
            `).get(currentUserId);
            const currentDeptCode = currentUser?.dept_code || '';

            // P2: Sort by: 1) current user's dept first, 2) MS > OP > RD, 3) name
            const users = db.prepare(`
                SELECT u.id, COALESCE(u.display_name, u.username) as name, 
                       u.username, u.display_name, u.role, 
                       d.name as department, d.name as department_name, d.code as dept_code
                FROM users u
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE ${conditions.join(' AND ')}
                ORDER BY 
                    CASE 
                        WHEN d.code = ? THEN 0
                        WHEN d.code = 'MS' THEN 1
                        WHEN d.code = 'OP' THEN 2
                        WHEN d.code = 'RD' THEN 3
                        ELSE 4
                    END,
                    u.username
            `).all(...params, currentDeptCode);

            res.json({
                success: true,
                data: users
            });
        } catch (err) {
            console.error('[System] Users error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/system/customers
     * Search customers for autocomplete (now from accounts table)
     */
    router.get('/customers', authenticate, (req, res) => {
        try {
            const { search, limit = 20 } = req.query;

            let sql = `
                SELECT id, name, account_type as type, 
                       name as company, 
                       (SELECT phone FROM contacts WHERE account_id = accounts.id AND status = 'PRIMARY' LIMIT 1) as phone,
                       (SELECT email FROM contacts WHERE account_id = accounts.id AND status = 'PRIMARY' LIMIT 1) as email
                FROM accounts
            `;
            let params = [];

            if (search) {
                sql += ` WHERE name LIKE ?`;
                const term = `%${search}%`;
                params.push(term);
            }

            sql += ` ORDER BY name LIMIT ?`;
            params.push(parseInt(limit));

            const customers = db.prepare(sql).all(...params);

            res.json({
                success: true,
                data: customers
            });
        } catch (err) {
            console.error('[System] Customers error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/system/customers
     * Quick create customer (now creates account + contact)
     */
    router.post('/customers', authenticate, (req, res) => {
        try {
            const {
                customer_name, customer_type = 'INDIVIDUAL',
                contact_person, phone, email,
                country, province, city, company_name
            } = req.body;

            if (!customer_name) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '客户名称不能为空' }
                });
            }

            // Create account
            const accountResult = db.prepare(`
                INSERT INTO accounts (name, account_type, country, province, city)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                customer_name, customer_type,
                country || null, province || null, city || null
            );

            const accountId = accountResult.lastInsertRowid;

            // Create primary contact if contact info provided
            if (contact_person || phone || email) {
                db.prepare(`
                    INSERT INTO contacts (account_id, name, phone, email, status, is_primary)
                    VALUES (?, ?, ?, ?, 'PRIMARY', 1)
                `).run(
                    accountId, contact_person || customer_name, phone || null, email || null
                );
            }

            res.status(201).json({
                success: true,
                data: { id: accountId, name: customer_name }
            });
        } catch (err) {
            console.error('[System] Create customer error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/attachments/:id/download
     * Download attachment file
     */
    router.get('/attachments/:id/download', authenticate, (req, res) => {
        try {
            // First check ticket_attachments (P2 Unified System)
            let attachment = db.prepare(`
                SELECT ta.*, t.created_by, t.assigned_to, t.dealer_id
                FROM ticket_attachments ta
                JOIN tickets t ON ta.ticket_id = t.id
                WHERE ta.id = ?
            `).get(req.params.id);

            // Determine Full Path across different systems
            let fullPath;
            const DISK_A = process.env.STORAGE_PATH || (process.platform === 'darwin' && !__dirname.includes('KineCore') ? '/Volumes/fileserver/Files' : path.join(__dirname, '../../data/DiskA'));
            const SERVICE_BASE_DIR = (process.platform === 'darwin' && !__dirname.includes('KineCore'))
                ? '/Volumes/fileserver/Service'
                : path.join(__dirname, '../../data/Service');

            console.log(`[System] SERVICE_BASE_DIR: ${SERVICE_BASE_DIR}`);

            if (attachment && attachment.file_path.includes('/')) {
                // Case 1: New OPS-compliant structure (e.g. Tickets/RMA/...)
                fullPath = path.join(SERVICE_BASE_DIR, attachment.file_path);
            } else if (attachment && attachment.ticket_id) {
                // Case 2: Legacy P2 unified (just filename in Service_Uploads)
                fullPath = path.join(DISK_A, 'Service_Uploads', attachment.file_path);
            } else if (attachment) {
                // Case 3: Legacy Issue system
                fullPath = path.join(__dirname, '../../data/issue_attachments', attachment.file_path);
            }

            if (!attachment || !fullPath) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '附件不存在' }
                });
            }

            // Permission check
            const user = req.user;
            let hasAccess = false;

            if (user.role === 'Admin' || user.role === 'Exec' || user.role === 'Lead' || user.department === 'marketing' || user.department === 'production' || user.department === 'rd') {
                hasAccess = true;
            } else if (user.user_type === 'Dealer' && attachment.dealer_id === user.dealer_id) {
                hasAccess = true;
            } else if (attachment.uploaded_by === user.id || attachment.created_by === user.id || attachment.assigned_to === user.id) {
                hasAccess = true;
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权下载此附件' }
                });
            }

            if (!fs.existsSync(fullPath)) {
                console.warn(`[System] File not found on disk: ${fullPath}`);
                return res.status(404).json({
                    success: false,
                    error: { code: 'FILE_NOT_FOUND', message: '文件不存在' }
                });
            }

            if (req.query.inline === 'true') {
                res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.file_name)}"`);
                return res.sendFile(fullPath, { dotfiles: 'allow' });
            }
            res.download(fullPath, attachment.file_name);
        } catch (err) {
            console.error('[System] Download error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/system/seed
     * Manually trigger database seeding
     */
    router.post('/seed', authenticate, (req, res) => {
        try {
            const seedPath = path.join(__dirname, '../seeds/seed_tickets.sql');

            if (!fs.existsSync(seedPath)) {
                return res.status(404).json({ success: false, error: "Seed file not found" });
            }

            const sql = fs.readFileSync(seedPath, 'utf8');
            const statements = sql.split(';').filter(s => s.trim());

            db.transaction(() => {
                for (const stmt of statements) {
                    try {
                        db.exec(stmt);
                    } catch (err) {
                        // Ignore unique constraint violations (already seeded)
                        if (!err.message.includes('UNIQUE constraint failed')) {
                            throw err;
                        }
                    }
                }
            })();

            res.json({ success: true, message: "Database seeded successfully" });
        } catch (err) {
            console.error('[System] Seed error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * GET /api/v1/attachments/:id/thumbnail
     * Get image thumbnail
     */
    router.get('/attachments/:id/thumbnail', authenticate, async (req, res) => {
        try {
            // First check ticket_attachments
            let attachment = db.prepare(`
                SELECT ta.*, t.created_by, t.assigned_to
                FROM ticket_attachments ta
                JOIN tickets t ON ta.ticket_id = t.id
                WHERE ta.id = ? AND (ta.file_type LIKE 'image/%' OR ta.file_type = 'image')
            `).get(req.params.id);

            let fullPath;
            const DISK_A = process.env.STORAGE_PATH || (process.platform === 'darwin' && !__dirname.includes('KineCore') ? '/Volumes/fileserver/Files' : path.join(__dirname, '../../data/DiskA'));
            const SERVICE_BASE_DIR = (process.platform === 'darwin' && !__dirname.includes('KineCore'))
                ? '/Volumes/fileserver/Service'
                : path.join(__dirname, '../../data/Service');

            if (attachment && attachment.file_path.includes('/')) {
                fullPath = path.join(SERVICE_BASE_DIR, attachment.file_path);
            } else if (attachment && attachment.ticket_id) {
                fullPath = path.join(DISK_A, 'Service_Uploads', attachment.file_path);
            } else {
                // Check legacy issue attachments if not found in ticket_attachments
                attachment = db.prepare(`
                    SELECT ia.*, i.created_by, i.assigned_to
                    FROM issue_attachments ia
                    JOIN issues i ON ia.issue_id = i.id
                    WHERE ia.id = ? AND (ia.file_type LIKE 'image/%' OR ia.file_type = 'image')
                `).get(req.params.id);

                if (attachment) {
                    fullPath = path.join(__dirname, '../../data/issue_attachments', attachment.file_path);
                }
            }

            if (!attachment || !fullPath) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '附件不存在' }
                });
            }

            // Verify file exists
            if (!fs.existsSync(fullPath)) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'FILE_NOT_FOUND', message: '文件不存在' }
                });
            }

            // Check if thumbnail exists, generate if not
            const thumbDir = path.resolve(__dirname, '../../data/.thumbnails');
            fs.ensureDirSync(thumbDir);
            
            // Support preview mode for larger, higher quality images (Chrome HEIC workaround)
            const isPreview = req.query.size === 'preview';
            const THUMB_SIZE = isPreview ? 1200 : 400;
            const sizeSuffix = isPreview ? '_preview' : '_thumb';
            
            const thumbBaseName = String(attachment.file_path).replace(/[^a-zA-Z0-9.-]/g, '_') + sizeSuffix;
            const thumbPathWebp = path.join(thumbDir, thumbBaseName + '.webp');
            const thumbPathJpg = path.join(thumbDir, thumbBaseName + '.jpg'); // Legacy fallback

            console.log(`[System] Thumbnail request: ${req.params.id}, preview=${isPreview}`);

            // Check for existing thumbnails (prefer WebP, fallback to JPG)
            if (fs.existsSync(thumbPathWebp)) {
                return res.sendFile(thumbPathWebp, { dotfiles: 'allow' });
            }
            if (fs.existsSync(thumbPathJpg)) {
                return res.sendFile(thumbPathJpg, { dotfiles: 'allow' });
            }

            // Generate new thumbnail
            const ext = path.extname(fullPath).toLowerCase();
            const isHeic = ext === '.heic' || ext === '.heif';
            
            if (isHeic && process.platform === 'darwin') {
                // Use macOS native sips for HEIC/HEIF, then convert to WebP
                const tempJpeg = path.join(thumbDir, thumbBaseName + '_temp.jpg');
                try {
                    const { execSync } = require('child_process');
                    // sips: -Z limits max dimension while preserving aspect ratio
                    // sips preserves EXIF orientation but doesn't rotate pixels
                    execSync(`sips -s format jpeg -s formatOptions 80 -Z ${THUMB_SIZE} "${fullPath}" --out "${tempJpeg}"`, {
                        timeout: 15000,
                        stdio: 'pipe'
                    });
                    // Convert to WebP - .rotate() applies EXIF orientation
                    const sharp = require('sharp');
                    await sharp(tempJpeg)
                        .rotate() // Auto-rotate based on EXIF orientation
                        .webp({ quality: 80 })
                        .toFile(thumbPathWebp);
                    fs.unlinkSync(tempJpeg);
                    console.log(`[System] HEIC thumbnail generated via sips: ${thumbPathWebp}`);
                    return res.sendFile(thumbPathWebp, { dotfiles: 'allow' });
                } catch (sipsErr) {
                    console.error('[System] sips error:', sipsErr.message);
                    if (fs.existsSync(tempJpeg)) fs.unlinkSync(tempJpeg);
                    return res.sendFile(fullPath, { dotfiles: 'allow' });
                }
            } else {
                // Use sharp for other formats
                try {
                    const sharp = require('sharp');
                    await sharp(fullPath)
                        .rotate() // Respect EXIF orientation
                        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 80 })
                        .toFile(thumbPathWebp);
                    return res.sendFile(thumbPathWebp, { dotfiles: 'allow' });
                } catch (sharpErr) {
                    console.error('[System] Sharp error:', sharpErr);
                    // If sharp fails, serve original
                    return res.sendFile(fullPath, { dotfiles: 'allow' });
                }
            }
        } catch (err) {
            console.error('[System] Thumbnail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    return router;
};
