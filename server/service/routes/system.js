/**
 * System Routes
 * System dictionaries, configuration, and utilities
 */

const express = require('express');
const path = require('path');
const fs = require('fs-extra');

module.exports = function(db, authenticate) {
    const router = express.Router();

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
     * Get products list for dropdowns
     */
    router.get('/products', authenticate, (req, res) => {
        try {
            const { category } = req.query;
            
            let sql = 'SELECT id, product_line, model_name, current_firmware_version FROM products';
            let params = [];

            if (category) {
                sql += ' WHERE product_line = ?';
                params.push(category);
            }

            sql += ' ORDER BY product_line, model_name';

            const products = db.prepare(sql).all(...params);

            res.json({
                success: true,
                data: products.map(p => ({
                    id: p.id,
                    name: p.model_name,
                    line: p.product_line,
                    firmware_version: p.current_firmware_version
                }))
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
     */
    router.get('/users', authenticate, (req, res) => {
        try {
            const { department, role } = req.query;
            
            let conditions = ["user_type = 'Employee' OR user_type IS NULL"];
            let params = [];

            if (department) {
                conditions.push('department_id = ?');
                params.push(department);
            }
            if (role) {
                conditions.push('role = ?');
                params.push(role);
            }

            const users = db.prepare(`
                SELECT u.id, u.username as name, u.role, d.name as department
                FROM users u
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE ${conditions.join(' AND ')}
                ORDER BY u.username
            `).all(...params);

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
     * Search customers for autocomplete
     */
    router.get('/customers', authenticate, (req, res) => {
        try {
            const { search, limit = 20 } = req.query;
            
            let sql = `
                SELECT id, customer_name as name, customer_type as type, 
                       company_name as company, phone, email
                FROM customers
            `;
            let params = [];

            if (search) {
                sql += ` WHERE customer_name LIKE ? OR company_name LIKE ? OR phone LIKE ?`;
                const term = `%${search}%`;
                params.push(term, term, term);
            }

            sql += ` ORDER BY customer_name LIMIT ?`;
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
     * Quick create customer
     */
    router.post('/customers', authenticate, (req, res) => {
        try {
            const {
                customer_name, customer_type = 'EndUser',
                contact_person, phone, email,
                country, province, city, company_name
            } = req.body;

            if (!customer_name) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '客户名称不能为空' }
                });
            }

            const result = db.prepare(`
                INSERT INTO customers (customer_name, customer_type, contact_person, 
                    phone, email, country, province, city, company_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                customer_name, customer_type, contact_person || null,
                phone || null, email || null,
                country || null, province || null, city || null, company_name || null
            );

            res.status(201).json({
                success: true,
                data: { id: result.lastInsertRowid, name: customer_name }
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
            const attachment = db.prepare(`
                SELECT ia.*, i.created_by, i.assigned_to, i.dealer_id, i.customer_id
                FROM issue_attachments ia
                JOIN issues i ON ia.issue_id = i.id
                WHERE ia.id = ?
            `).get(req.params.id);

            if (!attachment) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '附件不存在' }
                });
            }

            // Permission check
            const user = req.user;
            let hasAccess = false;

            if (user.role === 'Admin' || user.role === 'Lead') {
                hasAccess = true;
            } else if (user.user_type === 'Dealer' && attachment.dealer_id === user.dealer_id) {
                hasAccess = true;
            } else if (attachment.created_by === user.id || attachment.assigned_to === user.id) {
                hasAccess = true;
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权下载此附件' }
                });
            }

            const attachmentsDir = path.join(__dirname, '../../data/issue_attachments');
            const filePath = path.join(attachmentsDir, attachment.file_path);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'FILE_NOT_FOUND', message: '文件不存在' }
                });
            }

            res.download(filePath, attachment.file_name);
        } catch (err) {
            console.error('[System] Download error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/attachments/:id/thumbnail
     * Get image thumbnail
     */
    router.get('/attachments/:id/thumbnail', authenticate, async (req, res) => {
        try {
            const attachment = db.prepare(`
                SELECT ia.*, i.created_by, i.assigned_to
                FROM issue_attachments ia
                JOIN issues i ON ia.issue_id = i.id
                WHERE ia.id = ? AND ia.file_type = 'image'
            `).get(req.params.id);

            if (!attachment) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '图片附件不存在' }
                });
            }

            const attachmentsDir = path.join(__dirname, '../../data/issue_attachments');
            const filePath = path.join(attachmentsDir, attachment.file_path);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'FILE_NOT_FOUND', message: '文件不存在' }
                });
            }

            // Check if thumbnail exists, generate if not
            const thumbDir = path.join(__dirname, '../../data/.thumbnails');
            fs.ensureDirSync(thumbDir);
            const thumbPath = path.join(thumbDir, `${attachment.file_path}_thumb.jpg`);

            if (!fs.existsSync(thumbPath)) {
                try {
                    const sharp = require('sharp');
                    await sharp(filePath)
                        .resize(200, 200, { fit: 'cover' })
                        .jpeg({ quality: 80 })
                        .toFile(thumbPath);
                } catch (sharpErr) {
                    // If sharp fails, serve original
                    return res.sendFile(filePath);
                }
            }

            res.sendFile(thumbPath);
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
