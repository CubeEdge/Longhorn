const express = require('express');
const router = express.Router();

module.exports = (db, authenticate) => {

    /**
     * @route GET /api/v1/context/by-customer
     * @desc Get full context (profile, devices, history) by customer ID or Name
     * @note 兼容旧架构：优先查询 accounts 表，如未找到则返回 404
     */
    router.get('/by-customer', authenticate, (req, res) => {
        try {
            const { customer_id, customer_name } = req.query;

            if (!customer_id && !customer_name) {
                return res.status(400).json({ success: false, error: "Missing customer_id or customer_name" });
            }

            let customer;

            // 1. Fetch Customer Profile from accounts table (新架构)
            if (customer_id) {
                customer = db.prepare(`
                    SELECT 
                        id,
                        name as customer_name,
                        email,
                        phone,
                        country,
                        city,
                        address,
                        account_type as customer_type,
                        service_tier,
                        industry_tags,
                        parent_dealer_id,
                        created_at
                    FROM accounts 
                    WHERE id = ? AND account_type IN ('ORGANIZATION', 'INDIVIDUAL')
                `).get(customer_id);
            } else if (customer_name) {
                // Fuzzy match for name search
                customer = db.prepare(`
                    SELECT 
                        id,
                        name as customer_name,
                        email,
                        phone,
                        country,
                        city,
                        address,
                        account_type as customer_type,
                        service_tier,
                        industry_tags,
                        parent_dealer_id,
                        created_at
                    FROM accounts 
                    WHERE (name LIKE ? OR email LIKE ?)
                    AND account_type IN ('ORGANIZATION', 'INDIVIDUAL')
                    LIMIT 1
                `).get(`%${customer_name}%`, `%${customer_name}%`);
            }

            if (!customer) {
                return res.status(404).json({ success: false, error: "Customer not found" });
            }

            const cId = customer.id;

            // 2. Fetch Owned Devices from account_devices table
            const relatedProducts = db.prepare(`
                SELECT DISTINCT p.* 
                FROM products p
                JOIN account_devices ad ON ad.product_id = p.id
                WHERE ad.account_id = ?
            `).all(cId);

            // 3. Fetch Service History (Inquiry, RMA, Dealer Repairs) - 使用 account_id
            // Inquiry Tickets
            const inquiries = db.prepare(`
                SELECT 
                    id, ticket_number, 'Inquiry' as type, 
                    service_type as category, problem_summary as summary, 
                    status, created_at as date
                FROM inquiry_tickets 
                WHERE account_id = ?
                ORDER BY created_at DESC
            `).all(cId);

            // RMA Tickets
            const rmas = db.prepare(`
                SELECT 
                    id, ticket_number, 'RMA' as type, 
                    issue_category as category, problem_description as summary, 
                    status, created_at as date
                FROM rma_tickets 
                WHERE account_id = ?
                ORDER BY created_at DESC
            `).all(cId);

            // Dealer Repairs
            const repairs = db.prepare(`
                SELECT 
                    id, ticket_number, 'DealerRepair' as type, 
                    issue_category as category, problem_description as summary, 
                    status, created_at as date
                FROM dealer_repairs 
                WHERE account_id = ?
                ORDER BY created_at DESC
            `).all(cId);

            // Combine and sort history
            const history = [...inquiries, ...rmas, ...repairs].sort((a, b) =>
                new Date(b.date) - new Date(a.date)
            );

            // 4. Mock AI Profile (Placeholder for future AI analysis)
            let parsedTags = ["Verified Customer"];
            if (customer.industry_tags) {
                try {
                    const dbTags = JSON.parse(customer.industry_tags);
                    if (Array.isArray(dbTags)) parsedTags = [...parsedTags, ...dbTags];
                } catch (e) { console.warn('Failed to parse industry_tags', e); }
            }
            if (customer.service_tier) {
                parsedTags.push(customer.service_tier + ' Tier');
            }

            const aiProfile = {
                activity_level: history.length > 5 ? "High" : "Normal",
                tags: parsedTags,
                notes: "Auto-generated context from service history."
            };

            // 5. Fetch Associated Dealer
            let dealer = null;
            try {
                if (customer.parent_dealer_id) {
                    dealer = db.prepare('SELECT * FROM accounts WHERE id = ? AND account_type = ?').get(customer.parent_dealer_id, 'DEALER');
                }
            } catch (e) {
                // dealers table may not exist yet
            }

            res.json({
                success: true,
                data: {
                    customer,
                    dealer,
                    devices: relatedProducts,
                    service_history: history,
                    ai_profile: aiProfile
                }
            });

        } catch (err) {
            console.error('[Context] Error fetching by customer:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * @route GET /api/v1/context/by-account
     * @desc Get full context by Account ID (新架构)
     */
    router.get('/by-account', authenticate, (req, res) => {
        try {
            const { account_id } = req.query;

            if (!account_id) {
                return res.status(400).json({ 
                    success: false, 
                    error: { code: 'MISSING_PARAM', message: 'account_id is required' }
                });
            }

            // 1. 获取账户信息
            const account = db.prepare(`
                SELECT 
                    a.*,
                    pd.name as parent_dealer_name,
                    pd.dealer_code as parent_dealer_code
                FROM accounts a
                LEFT JOIN accounts pd ON a.parent_dealer_id = pd.id
                WHERE a.id = ?
            `).get(account_id);

            if (!account) {
                return res.status(404).json({ 
                    success: false, 
                    error: { code: 'NOT_FOUND', message: 'Account not found' }
                });
            }

            // 2. 获取联系人列表
            const contacts = db.prepare(`
                SELECT 
                    id, name, email, phone, wechat,
                    job_title, department, status, is_primary,
                    created_at
                FROM contacts
                WHERE account_id = ?
                ORDER BY 
                    CASE status 
                        WHEN 'PRIMARY' THEN 1 
                        WHEN 'ACTIVE' THEN 2 
                        ELSE 3 
                    END,
                    created_at DESC
            `).all(account_id);

            // 3. 获取设备资产
            const devices = db.prepare(`
                SELECT 
                    ad.*,
                    p.model_name as product_model,
                    p.product_family
                FROM account_devices ad
                LEFT JOIN products p ON ad.product_id = p.id
                WHERE ad.account_id = ?
                ORDER BY ad.created_at DESC
            `).all(account_id);

            // 4. 获取服务历史
            const inquiries = db.prepare(`
                SELECT 
                    it.id, it.ticket_number, 'Inquiry' as type,
                    it.service_type as category, it.problem_summary as summary,
                    it.status, it.created_at as date,
                    it.customer_name as contact_name
                FROM inquiry_tickets it
                WHERE it.account_id = ?
                ORDER BY it.created_at DESC
            `).all(account_id);

            const rmas = db.prepare(`
                SELECT 
                    rt.id, rt.ticket_number, 'RMA' as type,
                    rt.issue_category as category, rt.problem_description as summary,
                    rt.status, rt.created_at as date,
                    rt.reporter_name as contact_name
                FROM rma_tickets rt
                WHERE rt.account_id = ?
                ORDER BY rt.created_at DESC
            `).all(account_id);

            const repairs = db.prepare(`
                SELECT 
                    dr.id, dr.ticket_number, 'DealerRepair' as type,
                    dr.issue_category as category, dr.problem_description as summary,
                    dr.status, dr.created_at as date,
                    dr.customer_name as contact_name
                FROM dealer_repairs dr
                WHERE dr.account_id = ?
                ORDER BY dr.created_at DESC
            `).all(account_id);

            const history = [...inquiries, ...rmas, ...repairs]
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            // 5. 生成AI档案
            let parsedTags = [account.account_type];
            if (account.industry_tags) {
                try {
                    const dbTags = JSON.parse(account.industry_tags);
                    if (Array.isArray(dbTags)) parsedTags = [...parsedTags, ...dbTags];
                } catch (e) { }
            }
            if (account.service_tier) {
                parsedTags.push(account.service_tier + ' Tier');
            }

            const aiProfile = {
                activity_level: history.length > 5 ? "High" : history.length > 0 ? "Normal" : "Low",
                tags: parsedTags,
                primary_contact: contacts.find(c => c.status === 'PRIMARY' || c.is_primary)?.name || null,
                device_count: devices.length,
                ticket_count: history.length,
                inquiry_count: inquiries.length,
                rma_count: rmas.length,
                repair_count: repairs.length,
                notes: "Auto-generated context from service history."
            };

            res.json({
                success: true,
                data: {
                    account: {
                        ...account,
                        industry_tags: account.industry_tags ? JSON.parse(account.industry_tags) : []
                    },
                    contacts,
                    devices,
                    service_history: history,
                    ai_profile: aiProfile
                }
            });

        } catch (err) {
            console.error('[Context] Error fetching by account:', err);
            res.status(500).json({ 
                success: false, 
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * @route GET /api/v1/context/by-serial-number
     * @desc Get device context (specs, history) by Serial Number
     */
    router.get('/by-serial-number', authenticate, (req, res) => {
        try {
            const { serial_number } = req.query;

            if (!serial_number) {
                return res.status(400).json({ success: false, error: "Missing serial_number" });
            }

            // 1. Fetch Device Info
            const device = db.prepare(`
                SELECT * FROM products WHERE serial_number = ?
            `).get(serial_number);

            if (!device) {
                return res.status(404).json({ success: false, error: "Device not found" });
            }

            const pId = device.id;

            // 2. Fetch Service History for this Device (使用工单表自带的 customer_name)
            const inquiries = db.prepare(`
                SELECT 
                    it.id, it.ticket_number, 'Inquiry' as type, 
                    it.problem_summary as summary, it.status, it.created_at as date,
                    it.customer_name
                FROM inquiry_tickets it
                WHERE it.product_id = ?
                ORDER BY it.created_at DESC
            `).all(pId);

            const rmas = db.prepare(`
                SELECT 
                    rt.id, rt.ticket_number, 'RMA' as type, 
                    rt.problem_description as summary, rt.status, rt.created_at as date,
                    rt.reporter_name as customer_name
                FROM rma_tickets rt
                WHERE rt.product_id = ?
                ORDER BY rt.created_at DESC
            `).all(pId);

            const repairs = db.prepare(`
                SELECT 
                    dr.id, dr.ticket_number, 'DealerRepair' as type, 
                    dr.problem_description as summary, dr.status, dr.created_at as date,
                    dr.customer_name
                FROM dealer_repairs dr
                WHERE dr.product_id = ?
                ORDER BY dr.created_at DESC
            `).all(pId);

            const history = [...inquiries, ...rmas, ...repairs].sort((a, b) =>
                new Date(b.date) - new Date(a.date)
            );

            // 3. Infer Ownership History (simplistic version)
            // Just listing unique customers associated with this device over time
            const owners = [...new Set(history.map(h => h.customer_name).filter(Boolean))];

            // 4. Fetch Parts Catalog based on product family (resilient to missing table)
            let parts = [];
            try {
                if (device.product_family) {
                    parts = db.prepare(`
                        SELECT * FROM parts_catalog 
                        WHERE category IN ('Module', 'PCB', 'Cooling', 'Mechanical')
                        LIMIT 5
                    `).all();
                } else {
                    parts = db.prepare('SELECT * FROM parts_catalog LIMIT 5').all();
                }
            } catch (e) {
                // parts_catalog table may not exist yet
                console.log('[Context] parts_catalog not available:', e.message);
            }

            res.json({
                success: true,
                data: {
                    device,
                    service_history: history,
                    ownership_history: owners.map(name => ({ name, status: 'Associated' })),
                    parts_catalog: parts
                }
            });

        } catch (err) {
            console.error('[Context] Error fetching by SN:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    return router;
};
