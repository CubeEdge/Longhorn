/**
 * Accounts Routes
 * 账户与联系人管理 (Account + Contact Architecture)
 * 
 * 提供账户(Corporate/Individual/Dealer/Internal)和联系人的CRUD操作
 */

const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    /**
     * 生成账户编号
     * 格式: ACC-YYYY-XXXX
     */
    function generateAccountNumber() {
        const year = new Date().getFullYear();

        // 获取或创建年度序列
        let sequence = db.prepare(
            'SELECT last_sequence FROM account_sequences WHERE year = ?'
        ).get(year);

        let nextNum = 1;
        if (sequence) {
            nextNum = sequence.last_sequence + 1;
            db.prepare(
                'UPDATE account_sequences SET last_sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE year = ?'
            ).run(nextNum, year);
        } else {
            db.prepare(
                'INSERT INTO account_sequences (year, last_sequence) VALUES (?, 1)'
            ).run(year);
        }

        return `ACC-${year}-${String(nextNum).padStart(4, '0')}`;
    }

    /**
     * GET /api/v1/accounts
     * 账户列表查询
     * Query参数:
     * - account_type: 账户类型筛选 (DEALER/ORGANIZATION/INDIVIDUAL)
     * - service_tier: 服务等级 (STANDARD/VIP/VVIP/BLACKLIST)
     * - search: 名称/邮箱/电话模糊搜索
     * - region: 地区筛选
     * - page, page_size: 分页
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                account_type,
                service_tier,
                search,
                region,
                is_active,
                status, // 'active', 'inactive', 'deleted'
                sort_by = 'created_at',
                sort_order = 'desc',
                page = 1,
                page_size = 20
            } = req.query;

            let conditions = [];
            let params = [];

            if (account_type) {
                conditions.push('a.account_type = ?');
                params.push(account_type);
            }
            if (service_tier) {
                conditions.push('a.service_tier = ?');
                params.push(service_tier);
            }
            if (region) {
                conditions.push('a.region = ?');
                params.push(region);
            }

            // 支持状态筛选: active, inactive
            if (status) {
                if (status === 'active') {
                    conditions.push('a.is_active = 1');
                } else if (status === 'inactive') {
                    conditions.push('a.is_active = 0');
                }
                // Note: 'deleted' status not supported - accounts table doesn't have is_deleted column
            } else if (is_active !== undefined) {
                // 兼容旧的 is_active 参数
                conditions.push('a.is_active = ?');
                params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
            }

            if (search) {
                conditions.push('(a.name LIKE ? OR a.email LIKE ? OR a.phone LIKE ? OR a.account_number LIKE ?)');
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern, searchPattern);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const offset = (parseInt(page) - 1) * parseInt(page_size);

            // 验证排序字段
            const allowedSortFields = ['name', 'created_at', 'updated_at', 'service_tier', 'dealer_code', 'dealer_level', 'country', 'city'];
            const orderByField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
            const orderDirection = sort_order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

            // 查询总数
            const totalResult = db.prepare(`
                SELECT COUNT(*) as total FROM accounts a ${whereClause}
            `).get(...params);

            // 查询列表
            const accounts = db.prepare(`
                SELECT 
                    a.id,
                    a.account_number,
                    a.name,
                    a.account_type,
                    a.email,
                    a.phone,
                    a.country,
                    a.city,
                    a.service_tier,
                    a.industry_tags,
                    a.is_active,
                    a.created_at,
                    a.updated_at,
                    -- 主要联系人信息
                    c.name as primary_contact_name,
                    c.email as primary_contact_email,
                    c.phone as primary_contact_phone,
                    -- 经销商特有信息
                    a.dealer_code,
                    a.dealer_level,
                    a.repair_level,
                    a.region,
                    a.can_repair
                FROM accounts a
                LEFT JOIN contacts c ON c.account_id = a.id AND c.status = 'PRIMARY'
                ${whereClause}
                ORDER BY a.${orderByField} ${orderDirection}
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: accounts.map(a => ({
                    ...a,
                    industry_tags: a.industry_tags ? JSON.parse(a.industry_tags) : [],
                    is_active: !!a.is_active,
                    can_repair: !!a.can_repair
                })),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total: totalResult.total,
                    total_pages: Math.ceil(totalResult.total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Accounts] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/accounts
     * 创建新账户
     */
    router.post('/', authenticate, (req, res) => {
        try {
            const {
                name,
                account_type,
                email,
                phone,
                country,
                province,
                city,
                address,
                service_tier = 'STANDARD',
                industry_tags,
                credit_limit = 0,
                // 经销商特有
                dealer_code,
                dealer_level,
                region,
                can_repair = false,
                repair_level,
                parent_dealer_id,
                // 联系人信息 (创建账户时同时创建主要联系人)
                primary_contact
            } = req.body;

            // 验证必填字段
            if (!name || !account_type) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Name and account_type are required' }
                });
            }

            // 验证账户类型
            const validTypes = ['DEALER', 'ORGANIZATION', 'INDIVIDUAL'];
            if (!validTypes.includes(account_type)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid account_type' }
                });
            }

            // 生成账户编号
            const accountNumber = generateAccountNumber();

            // 插入账户
            const result = db.prepare(`
                INSERT INTO accounts (
                    account_number, name, account_type, email, phone,
                    country, province, city, address, service_tier,
                    industry_tags, credit_limit, dealer_code, dealer_level,
                    region, can_repair, repair_level, parent_dealer_id,
                    is_active, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            `).run(
                accountNumber,
                name,
                account_type,
                email || null,
                phone || null,
                country || null,
                province || null,
                city || null,
                address || null,
                service_tier,
                industry_tags ? JSON.stringify(industry_tags) : null,
                credit_limit,
                dealer_code || null,
                dealer_level || null,
                region || null,
                can_repair ? 1 : 0,
                repair_level || null,
                parent_dealer_id || null
            );

            const accountId = result.lastInsertRowid;

            // 如果有主要联系人信息，创建联系人
            let primaryContactId = null;
            if (primary_contact && primary_contact.name) {
                const contactResult = db.prepare(`
                    INSERT INTO contacts (
                        account_id, name, email, phone, wechat,
                        job_title, department, is_primary, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'PRIMARY', CURRENT_TIMESTAMP)
                `).run(
                    accountId,
                    primary_contact.name,
                    primary_contact.email || email || null,
                    primary_contact.phone || phone || null,
                    primary_contact.wechat || null,
                    primary_contact.job_title || null,
                    primary_contact.department || null
                );
                primaryContactId = contactResult.lastInsertRowid;
            }

            res.status(201).json({
                success: true,
                data: {
                    id: accountId,
                    account_number: accountNumber,
                    name,
                    account_type,
                    primary_contact_id: primaryContactId
                }
            });
        } catch (err) {
            console.error('[Accounts] Create error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/accounts/:id
     * 获取账户详情（包含联系人列表）
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const accountId = req.params.id;

            // 获取账户信息
            const account = db.prepare(`
                SELECT * FROM accounts WHERE id = ?
            `).get(accountId);

            if (!account) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Account not found' }
                });
            }

            // 获取联系人列表（排除已软删除的 INACTIVE 状态）
            const contacts = db.prepare(`
                SELECT 
                    id, name, email, phone, wechat,
                    job_title, department, status, is_primary,
                    language_preference, communication_preference,
                    notes, created_at
                FROM contacts
                WHERE account_id = ? AND status != 'INACTIVE'
                ORDER BY 
                    CASE status 
                        WHEN 'PRIMARY' THEN 1 
                        WHEN 'ACTIVE' THEN 2 
                        ELSE 3 
                    END,
                    created_at DESC
            `).all(accountId);

            // 获取设备列表
            const devices = db.prepare(`
                SELECT 
                    ad.*,
                    p.model_name as product_model,
                    p.product_family
                FROM account_devices ad
                LEFT JOIN products p ON ad.product_id = p.id
                WHERE ad.account_id = ?
                ORDER BY ad.created_at DESC
            `).all(accountId);

            // 获取统计信息 - 经销商用 dealer_id（自己提交的工单），客户用 account_id
            let stats;
            if (account.account_type === 'DEALER') {
                // 经销商：查询自己提交的工单（通过 dealer_id）
                stats = db.prepare(`
                    SELECT 
                        (SELECT COUNT(*) FROM inquiry_tickets WHERE dealer_id = ?) as inquiry_count,
                        (SELECT COUNT(*) FROM rma_tickets WHERE dealer_id = ?) as rma_count,
                        (SELECT COUNT(*) FROM dealer_repairs WHERE dealer_id = ?) as repair_count
                `).get(accountId, accountId, accountId);
            } else {
                // 客户：查询关联到自己的工单（通过 account_id）
                stats = db.prepare(`
                    SELECT 
                        (SELECT COUNT(*) FROM inquiry_tickets WHERE account_id = ?) as inquiry_count,
                        (SELECT COUNT(*) FROM rma_tickets WHERE account_id = ?) as rma_count,
                        (SELECT COUNT(*) FROM dealer_repairs WHERE account_id = ?) as repair_count
                `).get(accountId, accountId, accountId);
            }

            // 获取上级经销商信息（如果是企业客户）
            let parentDealer = null;
            if (account.parent_dealer_id) {
                parentDealer = db.prepare(`
                    SELECT id, name, dealer_code, region FROM accounts 
                    WHERE id = ? AND account_type = 'DEALER'
                `).get(account.parent_dealer_id);
            }

            res.json({
                success: true,
                data: {
                    ...account,
                    industry_tags: account.industry_tags ? JSON.parse(account.industry_tags) : [],
                    is_active: !!account.is_active,
                    can_repair: !!account.can_repair,
                    contacts,
                    devices,
                    statistics: stats,
                    parent_dealer: parentDealer
                }
            });
        } catch (err) {
            console.error('[Accounts] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/accounts/:id
     * 更新账户信息
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const accountId = req.params.id;
            const updates = req.body;

            // 构建更新字段
            const allowedFields = [
                'name', 'email', 'phone', 'country', 'province', 'city', 'address',
                'service_tier', 'industry_tags', 'credit_limit', 'dealer_code',
                'dealer_level', 'region', 'can_repair', 'repair_level',
                'parent_dealer_id', 'is_active', 'is_deleted', 'notes'
            ];

            const fields = [];
            const values = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = ?`);
                    if (key === 'industry_tags') {
                        values.push(JSON.stringify(value));
                    } else if (key === 'can_repair' || key === 'is_active' || key === 'is_deleted') {
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

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(accountId);

            db.prepare(`
                UPDATE accounts SET ${fields.join(', ')} WHERE id = ?
            `).run(...values);

            res.json({
                success: true,
                data: { id: accountId, updated: true }
            });
        } catch (err) {
            console.error('[Accounts] Update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/accounts/:id/contacts
     * 获取账户下的联系人列表
     * 默认只返回有效联系人（非 INACTIVE），传入 include_inactive=true 可获取全部
     */
    router.get('/:id/contacts', authenticate, (req, res) => {
        try {
            const accountId = req.params.id;
            const { status, include_inactive } = req.query;

            let whereClause = 'WHERE account_id = ?';
            const params = [accountId];

            if (status) {
                // 如果指定了 status，只返回该状态的联系人
                whereClause += ' AND status = ?';
                params.push(status);
            } else if (include_inactive !== 'true') {
                // 默认排除 INACTIVE 状态的联系人（已软删除的）
                whereClause += " AND status != 'INACTIVE'";
            }

            const contacts = db.prepare(`
                SELECT 
                    id, name, email, phone, wechat,
                    job_title, department, status, is_primary,
                    language_preference, communication_preference,
                    notes, created_at, updated_at
                FROM contacts
                ${whereClause}
                ORDER BY 
                    CASE status 
                        WHEN 'PRIMARY' THEN 1 
                        WHEN 'ACTIVE' THEN 2 
                        ELSE 3 
                    END,
                    created_at DESC
            `).all(...params);

            res.json({
                success: true,
                data: contacts
            });
        } catch (err) {
            console.error('[Accounts] Contacts list error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/accounts/:id/contacts
     * 为账户创建新联系人
     */
    router.post('/:id/contacts', authenticate, (req, res) => {
        try {
            const accountId = req.params.id;
            const {
                name,
                email,
                phone,
                wechat,
                job_title,
                department,
                language_preference = 'zh',
                communication_preference = 'EMAIL',
                is_primary = false,
                notes
            } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Name is required' }
                });
            }

            // 检查账户是否存在
            const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId);
            if (!account) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Account not found' }
                });
            }

            // 如果设为 PRIMARY，先将其他联系人状态改为 ACTIVE
            if (is_primary) {
                db.prepare(`
                    UPDATE contacts 
                    SET status = 'ACTIVE', is_primary = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE account_id = ? AND (status = 'PRIMARY' OR is_primary = 1)
                `).run(accountId);
            }

            const result = db.prepare(`
                INSERT INTO contacts (
                    account_id, name, email, phone, wechat,
                    job_title, department, language_preference,
                    communication_preference, status, is_primary, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
                accountId,
                name,
                email || null,
                phone || null,
                wechat || null,
                job_title || null,
                department || null,
                language_preference,
                communication_preference,
                is_primary ? 'PRIMARY' : 'ACTIVE',
                is_primary ? 1 : 0,
                notes || null
            );

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    account_id: accountId,
                    name,
                    status: is_primary ? 'PRIMARY' : 'ACTIVE'
                }
            });
        } catch (err) {
            console.error('[Accounts] Create contact error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/accounts/:id/tickets
     * 获取账户关联的所有工单
     */
    router.get('/:id/tickets', authenticate, (req, res) => {
        try {
            const accountId = req.params.id;
            const { type, status, page = 1, page_size = 20 } = req.query;

            const offset = (parseInt(page) - 1) * parseInt(page_size);

            // 查询咨询工单
            let inquiryQuery = `
                SELECT 
                    'inquiry' as ticket_type,
                    id, ticket_number, status, created_at, updated_at,
                    service_type as category, problem_summary as summary,
                    contact_id
                FROM inquiry_tickets
                WHERE account_id = ?
            `;
            if (status) {
                inquiryQuery += ` AND status = '${status}'`;
            }

            // 查询RMA工单
            let rmaQuery = `
                SELECT 
                    'rma' as ticket_type,
                    id, ticket_number, status, created_at, updated_at,
                    issue_category as category, problem_description as summary,
                    contact_id
                FROM rma_tickets
                WHERE account_id = ?
            `;
            if (status) {
                rmaQuery += ` AND status = '${status}'`;
            }

            // 查询经销商维修单
            let repairQuery = `
                SELECT 
                    'dealer_repair' as ticket_type,
                    id, ticket_number, status, created_at, updated_at,
                    issue_category as category, problem_description as summary,
                    contact_id
                FROM dealer_repairs
                WHERE account_id = ?
            `;
            if (status) {
                repairQuery += ` AND status = '${status}'`;
            }

            let unionQuery = '';
            const queries = [];
            if (!type || type === 'inquiry') queries.push(inquiryQuery);
            if (!type || type === 'rma') queries.push(rmaQuery);
            if (!type || type === 'dealer_repair') queries.push(repairQuery);

            unionQuery = queries.join(' UNION ALL ');
            unionQuery += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;

            const tickets = db.prepare(unionQuery).all(accountId, parseInt(page_size), offset);

            // 获取联系人信息
            const ticketsWithContacts = tickets.map(t => {
                if (t.contact_id) {
                    const contact = db.prepare('SELECT name, email FROM contacts WHERE id = ?').get(t.contact_id);
                    return { ...t, contact };
                }
                return t;
            });

            res.json({
                success: true,
                data: ticketsWithContacts,
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size)
                }
            });
        } catch (err) {
            console.error('[Accounts] Tickets list error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/accounts/:id/deactivate
     * 停用经销商
     * 权限: Admin 或市场部 Lead
     */
    router.post('/:id/deactivate', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { reason, transfer_type, successor_account_id, notes } = req.body;
            const user = req.user;

            // 权限检查：只有 Admin 或市场部 Lead 可以停用
            const canDeactivate = user.role === 'Admin' || user.role === 'Exec' ||
                (user.role === 'Lead' && user.department === '市场部');

            if (!canDeactivate) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Only Admin or Marketing Lead can deactivate dealers' }
                });
            }

            // 检查账户是否存在且是经销商
            const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND account_type = ?').get(id, 'DEALER');
            if (!account) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Dealer not found' }
                });
            }

            if (!account.is_active) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'ALREADY_INACTIVE', message: 'Dealer is already inactive' }
                });
            }

            // 验证必填字段
            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Deactivation reason is required' }
                });
            }

            // 开始事务
            const deactivateTransaction = db.transaction(() => {
                // 1. 停用经销商账户
                db.prepare(`
                    UPDATE accounts 
                    SET is_active = 0, 
                        deactivated_at = CURRENT_TIMESTAMP,
                        deactivated_reason = ?,
                        successor_account_id = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(reason, successor_account_id || null, id);

                // 2. 处理该经销商下的客户（parent_dealer_id = id 的账户）
                const childAccounts = db.prepare('SELECT id FROM accounts WHERE parent_dealer_id = ?').all(id);

                for (const child of childAccounts) {
                    // 转移客户
                    if (transfer_type === 'dealer_to_dealer' && successor_account_id) {
                        // 转移给其他经销商
                        db.prepare('UPDATE accounts SET parent_dealer_id = ? WHERE id = ?')
                            .run(successor_account_id, child.id);
                    } else {
                        // 转为直客（清除 parent_dealer_id）
                        db.prepare('UPDATE accounts SET parent_dealer_id = NULL WHERE id = ?')
                            .run(child.id);
                    }

                    // 记录转移历史
                    db.prepare(`
                        INSERT INTO account_transfers 
                        (account_id, from_dealer_id, to_dealer_id, transferred_by, reason, transfer_type)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).run(
                        child.id,
                        id,
                        transfer_type === 'dealer_to_dealer' ? successor_account_id : null,
                        user.id,
                        notes || reason,
                        transfer_type || 'dealer_to_direct'
                    );
                }

                // 3. 停用所有联系人
                db.prepare(`
                    UPDATE contacts 
                    SET status = 'INACTIVE', 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE account_id = ?
                `).run(id);

                return {
                    transferred_accounts: childAccounts.length,
                    inactive_contacts: db.prepare('SELECT COUNT(*) as count FROM contacts WHERE account_id = ?').get(id).count
                };
            });

            const result = deactivateTransaction();

            res.json({
                success: true,
                data: {
                    account_id: parseInt(id),
                    deactivated_at: new Date().toISOString(),
                    ...result
                }
            });

        } catch (err) {
            console.error('[Accounts] Deactivate error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/accounts/:id/reactivate
     * 重新激活经销商
     * 权限: Admin 或市场部 Lead
     */
    router.post('/:id/reactivate', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const user = req.user;

            // 权限检查：只有 Admin 或市场部 Lead 可以激活
            const canReactivate = user.role === 'Admin' || user.role === 'Exec' ||
                (user.role === 'Lead' && user.department === '市场部');

            if (!canReactivate) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Only Admin or Marketing Lead can reactivate dealers' }
                });
            }

            // 检查账户是否存在且是经销商
            const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND account_type = ?').get(id, 'DEALER');
            if (!account) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Dealer not found' }
                });
            }

            if (account.is_active) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'ALREADY_ACTIVE', message: 'Dealer is already active' }
                });
            }

            // 激活经销商
            db.prepare(`
                UPDATE accounts 
                SET is_active = 1, 
                    deactivated_at = NULL,
                    deactivated_reason = NULL,
                    successor_account_id = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(id);

            res.json({
                success: true,
                data: {
                    account_id: parseInt(id),
                    reactivated_at: new Date().toISOString()
                }
            });

        } catch (err) {
            console.error('[Accounts] Reactivate error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/accounts/:id/transfer-history
     * 获取客户转移历史
     */
    router.get('/:id/transfer-history', authenticate, (req, res) => {
        try {
            const { id } = req.params;

            const transfers = db.prepare(`
                SELECT 
                    at.*,
                    a.name as account_name,
                    from_acc.name as from_dealer_name,
                    to_acc.name as to_dealer_name,
                    u.username as transferred_by_name
                FROM account_transfers at
                LEFT JOIN accounts a ON at.account_id = a.id
                LEFT JOIN accounts from_acc ON at.from_dealer_id = from_acc.id
                LEFT JOIN accounts to_acc ON at.to_dealer_id = to_acc.id
                LEFT JOIN users u ON at.transferred_by = u.id
                WHERE at.from_dealer_id = ? OR at.to_dealer_id = ?
                ORDER BY at.transferred_at DESC
            `).all(id, id);

            res.json({
                success: true,
                data: transfers
            });

        } catch (err) {
            console.error('[Accounts] Transfer history error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/accounts/:id/convert-type
     * 客户类型转换（仅支持 INDIVIDUAL → ORGANIZATION）
     * 权限: Admin 或市场部
     */
    router.post('/:id/convert-type', authenticate, (req, res) => {
        try {
            const { id } = req.params;
            const { new_type, reason, new_fields = {} } = req.body;
            const user = req.user;

            // 权限检查：只有 Admin 或市场部可以转换客户类型
            const canConvert = user.role === 'Admin' || user.role === 'Exec' ||
                (user.role === 'Lead' && user.department === '市场部') ||
                user.department === '市场部';

            if (!canConvert) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Only Admin or Marketing can convert account type' }
                });
            }

            // 验证转换类型
            if (new_type !== 'ORGANIZATION') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Only conversion to ORGANIZATION is supported' }
                });
            }

            // 检查账户是否存在
            const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
            if (!account) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Account not found' }
                });
            }

            // 检查当前类型
            if (account.account_type !== 'INDIVIDUAL') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_TYPE', message: 'Only INDIVIDUAL accounts can be converted to ORGANIZATION' }
                });
            }

            // 执行转换事务
            const convertTransaction = db.transaction(() => {
                // 1. 记录类型转换历史
                db.prepare(`
                    INSERT INTO account_type_history 
                    (account_id, old_type, new_type, converted_by, reason)
                    VALUES (?, ?, ?, ?, ?)
                `).run(id, account.account_type, new_type, user.id, reason);

                // 2. 更新账户类型和新增字段
                const updateFields = [];
                const updateValues = [];

                updateFields.push('account_type = ?');
                updateValues.push(new_type);

                if (new_fields.industry_tags) {
                    updateFields.push('industry_tags = ?');
                    updateValues.push(JSON.stringify(new_fields.industry_tags));
                }

                if (new_fields.address) {
                    updateFields.push('address = ?');
                    updateValues.push(new_fields.address);
                }

                updateFields.push('updated_at = CURRENT_TIMESTAMP');
                updateValues.push(id);

                db.prepare(`
                    UPDATE accounts 
                    SET ${updateFields.join(', ')}
                    WHERE id = ?
                `).run(...updateValues);

                // 3. 获取更新后的账户信息
                const updatedAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);

                // 4. 获取联系人列表
                const contacts = db.prepare(`
                    SELECT id, name, email, status, is_primary 
                    FROM contacts 
                    WHERE account_id = ?
                `).all(id);

                return { updatedAccount, contacts };
            });

            const result = convertTransaction();

            res.json({
                success: true,
                data: {
                    id: result.updatedAccount.id,
                    name: result.updatedAccount.name,
                    account_type: result.updatedAccount.account_type,
                    previous_type: account.account_type,
                    converted_at: new Date().toISOString(),
                    converted_by: user.id,
                    contacts: result.contacts,
                    message: '客户类型转换成功，已解锁机构客户专属字段'
                }
            });

        } catch (err) {
            console.error('[Accounts] Convert type error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * DELETE /api/v1/accounts/:id
     * 删除账户
     * 
     * 删除前检查关联数据：
     * - 如果有关联的工单或设备，返回 409 错误，建议停用
     * - 如果没有关联数据，软删除（标记 is_deleted=1）
     * - 带 permanent=true 参数时，执行硬删除（仅在已删除列表中使用）
     */
    router.delete('/:id', authenticate, (req, res) => {
        try {
            const accountId = req.params.id;
            const permanent = req.query.permanent === 'true';

            // 检查账户是否存在
            const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
            if (!account) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Account not found' }
                });
            }

            // 如果是永久删除请求（仅在已删除列表中可用）
            if (permanent) {
                // 执行硬删除（事务）
                const deleteTransaction = db.transaction(() => {
                    db.prepare('DELETE FROM contacts WHERE account_id = ?').run(accountId);
                    db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
                });
                deleteTransaction();

                return res.json({
                    success: true,
                    message: '账户已永久删除',
                    deleted_account: {
                        id: account.id,
                        name: account.name
                    }
                });
            }

            // 检查关联的工单数量
            // account_id: 客户账户关联（适用于 ORGANIZATION/INDIVIDUAL）
            // dealer_id: 经销商账户关联（适用于 DEALER）
            // 根据账户类型选择正确的检查字段
            const isDealer = account.account_type === 'DEALER';

            let inquiryCount, rmaCount, repairCount;

            if (isDealer) {
                // 经销商账户：检查 dealer_id
                inquiryCount = db.prepare(
                    'SELECT COUNT(*) as count FROM inquiry_tickets WHERE dealer_id = ?'
                ).get(accountId).count;
                rmaCount = db.prepare(
                    'SELECT COUNT(*) as count FROM rma_tickets WHERE dealer_id = ?'
                ).get(accountId).count;
                repairCount = db.prepare(
                    'SELECT COUNT(*) as count FROM dealer_repairs WHERE dealer_id = ?'
                ).get(accountId).count;
            } else {
                // 客户账户：检查 account_id
                inquiryCount = db.prepare(
                    'SELECT COUNT(*) as count FROM inquiry_tickets WHERE account_id = ?'
                ).get(accountId).count;
                rmaCount = db.prepare(
                    'SELECT COUNT(*) as count FROM rma_tickets WHERE account_id = ?'
                ).get(accountId).count;
                repairCount = db.prepare(
                    'SELECT COUNT(*) as count FROM dealer_repairs WHERE account_id = ?'
                ).get(accountId).count;
            }

            const ticketCount = inquiryCount + rmaCount + repairCount;

            // 检查关联的设备数量
            const deviceCount = db.prepare(
                'SELECT COUNT(*) as count FROM account_devices WHERE account_id = ?'
            ).get(accountId).count;

            // 如果有关联数据，返回 409 错误，建议停用
            if (ticketCount > 0 || deviceCount > 0) {
                return res.status(409).json({
                    success: false,
                    error: {
                        code: 'CANNOT_DELETE_HAS_HISTORY',
                        message: '该账户有关联的工单或设备，无法删除',
                        suggestion: 'DEACTIVATE'
                    },
                    counts: {
                        tickets: ticketCount,
                        inquiry_tickets: inquiryCount,
                        rma_tickets: rmaCount,
                        dealer_repairs: repairCount,
                        devices: deviceCount
                    },
                    account: {
                        id: account.id,
                        name: account.name,
                        account_type: account.account_type
                    }
                });
            }

            // 无关联数据，执行软删除（标记 is_deleted=1）
            db.prepare(`
                UPDATE accounts 
                SET is_deleted = 1, 
                    is_active = 0,
                    deleted_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(accountId);

            res.json({
                success: true,
                message: '账户已移至已删除列表',
                deleted_account: {
                    id: account.id,
                    name: account.name
                }
            });

        } catch (err) {
            console.error('[Accounts] Delete error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    return router;
};
