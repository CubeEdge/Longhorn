/**
 * Context Query Routes
 * Dual-dimensional context query: by Customer or by Serial Number
 * Phase 1: Service context for customer support
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/context/customer/:identifier
     * Query service history by customer ID, name, or contact info
     * Returns: service records, work orders, and product ownership
     */
    router.get('/customer/:identifier', authenticate, (req, res) => {
        try {
            const { identifier } = req.params;
            const { 
                include_issues = 'true',
                include_service_records = 'true',
                include_products = 'true',
                limit = 50
            } = req.query;

            const results = {
                customer: null,
                service_records: [],
                issues: [],
                products: []
            };

            // Try to find customer by ID, name, or contact
            let customer = null;
            
            // First try as numeric ID
            if (!isNaN(identifier)) {
                customer = db.prepare(`
                    SELECT * FROM customers WHERE id = ?
                `).get(parseInt(identifier));
            }
            
            // Then try by name or contact
            if (!customer) {
                customer = db.prepare(`
                    SELECT * FROM customers 
                    WHERE customer_name LIKE ? OR phone LIKE ? OR email LIKE ?
                    LIMIT 1
                `).get(`%${identifier}%`, `%${identifier}%`, `%${identifier}%`);
            }

            if (customer) {
                results.customer = formatCustomer(customer);
                
                // Get service records for this customer
                if (include_service_records === 'true') {
                    results.service_records = db.prepare(`
                        SELECT sr.*, h.username as handler_name
                        FROM service_records sr
                        LEFT JOIN users h ON sr.handler_id = h.id
                        WHERE sr.customer_id = ? OR sr.customer_name LIKE ?
                        ORDER BY sr.created_at DESC
                        LIMIT ?
                    `).all(customer.id, `%${customer.customer_name}%`, parseInt(limit))
                        .map(formatServiceRecordBrief);
                }

                // Get work orders (issues) for this customer
                if (include_issues === 'true') {
                    results.issues = db.prepare(`
                        SELECT i.*, p.model_name as product_name
                        FROM issues i
                        LEFT JOIN products p ON i.product_id = p.id
                        WHERE i.customer_id = ? OR i.reporter_name LIKE ?
                        ORDER BY i.created_at DESC
                        LIMIT ?
                    `).all(customer.id, `%${customer.customer_name}%`, parseInt(limit))
                        .map(formatIssueBrief);
                }

                // Get products owned by this customer (via device_owners or issues)
                if (include_products === 'true') {
                    results.products = db.prepare(`
                        SELECT DISTINCT 
                            i.serial_number,
                            i.firmware_version,
                            p.id as product_id,
                            p.model_name as product_name,
                            p.product_line,
                            MAX(i.created_at) as last_service_date
                        FROM issues i
                        LEFT JOIN products p ON i.product_id = p.id
                        WHERE (i.customer_id = ? OR i.reporter_name LIKE ?)
                            AND i.serial_number IS NOT NULL
                        GROUP BY i.serial_number
                        ORDER BY last_service_date DESC
                        LIMIT ?
                    `).all(customer.id, `%${customer.customer_name}%`, parseInt(limit))
                        .map(p => ({
                            serial_number: p.serial_number,
                            product_id: p.product_id,
                            product_name: p.product_name,
                            product_line: p.product_line,
                            firmware_version: p.firmware_version,
                            last_service_date: p.last_service_date
                        }));
                }
            } else {
                // No customer found, but still try to find records by name/contact
                if (include_service_records === 'true') {
                    results.service_records = db.prepare(`
                        SELECT sr.*, h.username as handler_name
                        FROM service_records sr
                        LEFT JOIN users h ON sr.handler_id = h.id
                        WHERE sr.customer_name LIKE ? OR sr.customer_contact LIKE ?
                        ORDER BY sr.created_at DESC
                        LIMIT ?
                    `).all(`%${identifier}%`, `%${identifier}%`, parseInt(limit))
                        .map(formatServiceRecordBrief);
                }

                if (include_issues === 'true') {
                    results.issues = db.prepare(`
                        SELECT i.*, p.model_name as product_name
                        FROM issues i
                        LEFT JOIN products p ON i.product_id = p.id
                        WHERE i.reporter_name LIKE ?
                        ORDER BY i.created_at DESC
                        LIMIT ?
                    `).all(`%${identifier}%`, parseInt(limit))
                        .map(formatIssueBrief);
                }
            }

            // Calculate summary stats
            const summary = {
                total_service_records: results.service_records.length,
                total_issues: results.issues.length,
                total_products: results.products.length,
                open_issues: results.issues.filter(i => !['Closed', 'Resolved'].includes(i.status)).length,
                pending_service_records: results.service_records.filter(sr => !['Resolved', 'AutoClosed', 'UpgradedToTicket'].includes(sr.status)).length
            };

            res.json({
                success: true,
                data: {
                    ...results,
                    summary
                }
            });
        } catch (err) {
            console.error('[Context] Customer query error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/context/serial/:serialNumber
     * Query service history by product serial number
     * Useful for transferred devices or when customer is unknown
     */
    router.get('/serial/:serialNumber', authenticate, (req, res) => {
        try {
            const { serialNumber } = req.params;
            const { 
                include_issues = 'true',
                include_service_records = 'true',
                limit = 50
            } = req.query;

            const results = {
                product: null,
                current_owner: null,
                service_records: [],
                issues: [],
                ownership_history: []
            };

            // Find product info from issues or service records
            const productInfo = db.prepare(`
                SELECT 
                    i.serial_number,
                    i.firmware_version,
                    i.hardware_version,
                    p.id as product_id,
                    p.model_name,
                    p.product_line
                FROM issues i
                LEFT JOIN products p ON i.product_id = p.id
                WHERE i.serial_number = ?
                ORDER BY i.created_at DESC
                LIMIT 1
            `).get(serialNumber);

            if (productInfo) {
                results.product = {
                    serial_number: productInfo.serial_number,
                    product_id: productInfo.product_id,
                    model_name: productInfo.model_name,
                    product_line: productInfo.product_line,
                    firmware_version: productInfo.firmware_version,
                    hardware_version: productInfo.hardware_version
                };
            }

            // Get service records for this serial number
            if (include_service_records === 'true') {
                results.service_records = db.prepare(`
                    SELECT sr.*, h.username as handler_name
                    FROM service_records sr
                    LEFT JOIN users h ON sr.handler_id = h.id
                    WHERE sr.serial_number = ?
                    ORDER BY sr.created_at DESC
                    LIMIT ?
                `).all(serialNumber, parseInt(limit))
                    .map(formatServiceRecordBrief);
            }

            // Get work orders (issues) for this serial number
            if (include_issues === 'true') {
                results.issues = db.prepare(`
                    SELECT i.*, p.model_name as product_name, c.customer_name
                    FROM issues i
                    LEFT JOIN products p ON i.product_id = p.id
                    LEFT JOIN customers c ON i.customer_id = c.id
                    WHERE i.serial_number = ?
                    ORDER BY i.created_at DESC
                    LIMIT ?
                `).all(serialNumber, parseInt(limit))
                    .map(formatIssueBrief);
            }

            // Build ownership history from issues (showing different customers over time)
            const ownershipData = db.prepare(`
                SELECT DISTINCT
                    COALESCE(c.customer_name, i.reporter_name) as owner_name,
                    c.id as customer_id,
                    MIN(i.created_at) as first_seen,
                    MAX(i.created_at) as last_seen,
                    COUNT(*) as service_count
                FROM issues i
                LEFT JOIN customers c ON i.customer_id = c.id
                WHERE i.serial_number = ? AND (c.customer_name IS NOT NULL OR i.reporter_name IS NOT NULL)
                GROUP BY COALESCE(c.customer_name, i.reporter_name)
                ORDER BY last_seen DESC
            `).all(serialNumber);

            results.ownership_history = ownershipData.map(o => ({
                owner_name: o.owner_name,
                customer_id: o.customer_id,
                first_seen: o.first_seen,
                last_seen: o.last_seen,
                service_count: o.service_count
            }));

            // Current owner is the most recent
            if (results.ownership_history.length > 0) {
                results.current_owner = results.ownership_history[0];
            }

            // Calculate summary stats
            const summary = {
                total_service_records: results.service_records.length,
                total_issues: results.issues.length,
                total_owners: results.ownership_history.length,
                warranty_repairs: results.issues.filter(i => i.is_warranty).length,
                non_warranty_repairs: results.issues.filter(i => !i.is_warranty).length
            };

            res.json({
                success: true,
                data: {
                    ...results,
                    summary
                }
            });
        } catch (err) {
            console.error('[Context] Serial query error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/context/search
     * Unified search across customers and serial numbers
     */
    router.get('/search', authenticate, (req, res) => {
        try {
            const { q, type = 'all', limit = 20 } = req.query;

            if (!q || q.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '搜索关键词至少需要2个字符' }
                });
            }

            const results = {
                customers: [],
                serial_numbers: []
            };

            // Search customers
            if (type === 'all' || type === 'customer') {
                results.customers = db.prepare(`
                    SELECT DISTINCT
                        c.id,
                        c.customer_name,
                        c.contact_person,
                        c.phone,
                        c.email,
                        c.company_name,
                        COUNT(DISTINCT i.id) as issue_count
                    FROM customers c
                    LEFT JOIN issues i ON i.customer_id = c.id
                    WHERE c.customer_name LIKE ? 
                        OR c.contact_person LIKE ? 
                        OR c.phone LIKE ? 
                        OR c.email LIKE ?
                        OR c.company_name LIKE ?
                    GROUP BY c.id
                    ORDER BY issue_count DESC
                    LIMIT ?
                `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, parseInt(limit))
                    .map(c => ({
                        id: c.id,
                        name: c.customer_name,
                        contact_person: c.contact_person,
                        phone: c.phone,
                        email: c.email,
                        company: c.company_name,
                        issue_count: c.issue_count
                    }));
            }

            // Search serial numbers
            if (type === 'all' || type === 'serial') {
                results.serial_numbers = db.prepare(`
                    SELECT DISTINCT
                        i.serial_number,
                        p.model_name as product_name,
                        p.product_line,
                        COALESCE(c.customer_name, i.reporter_name) as current_owner,
                        COUNT(*) as service_count,
                        MAX(i.created_at) as last_service
                    FROM issues i
                    LEFT JOIN products p ON i.product_id = p.id
                    LEFT JOIN customers c ON i.customer_id = c.id
                    WHERE i.serial_number LIKE ?
                    GROUP BY i.serial_number
                    ORDER BY last_service DESC
                    LIMIT ?
                `).all(`%${q}%`, parseInt(limit))
                    .map(s => ({
                        serial_number: s.serial_number,
                        product_name: s.product_name,
                        product_line: s.product_line,
                        current_owner: s.current_owner,
                        service_count: s.service_count,
                        last_service: s.last_service
                    }));
            }

            res.json({
                success: true,
                data: results,
                meta: {
                    query: q,
                    type,
                    customer_count: results.customers.length,
                    serial_count: results.serial_numbers.length
                }
            });
        } catch (err) {
            console.error('[Context] Search error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // Helper functions
    function formatCustomer(customer) {
        return {
            id: customer.id,
            name: customer.customer_name,
            type: customer.customer_type,
            contact_person: customer.contact_person,
            phone: customer.phone,
            email: customer.email,
            company: customer.company_name,
            country: customer.country,
            province: customer.province,
            city: customer.city
        };
    }

    function formatServiceRecordBrief(sr) {
        return {
            id: sr.id,
            record_number: sr.record_number,
            service_type: sr.service_type,
            channel: sr.channel,
            problem_summary: sr.problem_summary?.substring(0, 100),
            status: sr.status,
            handler_name: sr.handler_name,
            created_at: sr.created_at
        };
    }

    function formatIssueBrief(issue) {
        return {
            id: issue.id,
            issue_number: issue.issue_number,
            rma_number: issue.rma_number,
            ticket_type: issue.ticket_type,
            issue_type: issue.issue_type,
            issue_category: issue.issue_category,
            severity: issue.severity,
            status: issue.status,
            title: issue.title || issue.problem_description?.substring(0, 100),
            product_name: issue.product_name,
            serial_number: issue.serial_number,
            is_warranty: !!issue.is_warranty,
            customer_name: issue.customer_name,
            created_at: issue.created_at
        };
    }

    return router;
};
