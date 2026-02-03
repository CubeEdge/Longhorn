const express = require('express');
const router = express.Router();

module.exports = (db) => {

    /**
     * @route GET /api/v1/context/by-customer
     * @desc Get full context (profile, devices, history) by customer ID or Name
     */
    router.get('/by-customer', (req, res) => {
        try {
            const { customer_id, customer_name } = req.query;

            if (!customer_id && !customer_name) {
                return res.status(400).json({ success: false, error: "Missing customer_id or customer_name" });
            }

            let customer;

            // 1. Fetch Customer Profile
            if (customer_id) {
                customer = db.prepare(`
                    SELECT * FROM customers WHERE id = ?
                `).get(customer_id);
            } else if (customer_name) {
                // Fuzzy match for name search
                customer = db.prepare(`
                    SELECT * FROM customers 
                    WHERE customer_name LIKE ? OR contact_person LIKE ? OR email LIKE ?
                    LIMIT 1
                `).get(`%${customer_name}%`, `%${customer_name}%`, `%${customer_name}%`);
            }

            // Mock customer if not found (for dev/demo purposes if needed, strictly fallback)
            // But better to return 404 if not found in DB to avoid confusion
            if (!customer) {
                return res.status(404).json({ success: false, error: "Customer not found" });
            }

            const cId = customer.id;

            // 2. Fetch Owned Devices (based on service history interactions or explicit ownership table if it existed)
            // Since we don't have a strict 'ownership' table yet, we infer from tickets or just search products if there was a link.
            // For now, let's find products linked to this customer in tickets.
            const relatedProducts = db.prepare(`
                SELECT DISTINCT p.* 
                FROM products p
                JOIN inquiry_tickets it ON it.product_id = p.id
                WHERE it.customer_id = ?
                UNION
                SELECT DISTINCT p.* 
                FROM products p
                JOIN rma_tickets rt ON rt.product_id = p.id
                WHERE rt.customer_id = ?
            `).all(cId, cId);

            // 3. Fetch Service History (Inquiry, RMA, Dealer Repairs)
            // Inquiry Tickets
            const inquiries = db.prepare(`
                SELECT 
                    id, ticket_number, 'Inquiry' as type, 
                    service_type as category, problem_summary as summary, 
                    status, created_at as date
                FROM inquiry_tickets 
                WHERE customer_id = ?
                ORDER BY created_at DESC
            `).all(cId);

            // RMA Tickets
            const rmas = db.prepare(`
                SELECT 
                    id, ticket_number, 'RMA' as type, 
                    issue_category as category, problem_description as summary, 
                    status, created_at as date
                FROM rma_tickets 
                WHERE customer_id = ?
                ORDER BY created_at DESC
            `).all(cId);

            // Dealer Repairs
            const repairs = db.prepare(`
                SELECT 
                    id, ticket_number, 'DealerRepair' as type, 
                    issue_category as category, problem_description as summary, 
                    status, created_at as date
                FROM dealer_repairs 
                WHERE customer_id = ?
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
            if (customer.parent_dealer_id) {
                dealer = db.prepare('SELECT * FROM dealers WHERE id = ?').get(customer.parent_dealer_id);
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
     * @route GET /api/v1/context/by-serial-number
     * @desc Get device context (specs, history) by Serial Number
     */
    router.get('/by-serial-number', (req, res) => {
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

            // 2. Fetch Service History for this Device
            const inquiries = db.prepare(`
                SELECT 
                    it.id, it.ticket_number, 'Inquiry' as type, 
                    it.problem_summary as summary, it.status, it.created_at as date,
                    c.customer_name
                FROM inquiry_tickets it
                LEFT JOIN customers c ON it.customer_id = c.id
                WHERE it.product_id = ?
                ORDER BY it.created_at DESC
            `).all(pId);

            const rmas = db.prepare(`
                SELECT 
                    rt.id, rt.ticket_number, 'RMA' as type, 
                    rt.problem_description as summary, rt.status, rt.created_at as date,
                    c.customer_name
                FROM rma_tickets rt
                LEFT JOIN customers c ON rt.customer_id = c.id
                WHERE rt.product_id = ?
                ORDER BY rt.created_at DESC
            `).all(pId);

            const repairs = db.prepare(`
                SELECT 
                    dr.id, dr.ticket_number, 'DealerRepair' as type, 
                    dr.problem_description as summary, dr.status, dr.created_at as date,
                    c.customer_name
                FROM dealer_repairs dr
                LEFT JOIN customers c ON dr.customer_id = c.id
                WHERE dr.product_id = ?
                ORDER BY dr.created_at DESC
            `).all(pId);

            const history = [...inquiries, ...rmas, ...repairs].sort((a, b) =>
                new Date(b.date) - new Date(a.date)
            );

            // 3. Infer Ownership History (simplistic version)
            // Just listing unique customers associated with this device over time
            const owners = [...new Set(history.map(h => h.customer_name).filter(Boolean))];

            // 4. Fetch Parts Catalog based on product family
            // If family is A (Cameras), show modules/boards/fans
            // If family is C (EVF), show optical/cables, etc.
            let parts = [];
            if (device.product_family) {
                parts = db.prepare(`
                    SELECT * FROM parts_catalog 
                    WHERE category IN ('Module', 'PCB', 'Cooling', 'Mechanical')
                    LIMIT 5
                `).all();
            } else {
                parts = db.prepare('SELECT * FROM parts_catalog LIMIT 5').all();
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
