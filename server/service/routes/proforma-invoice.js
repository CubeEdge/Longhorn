/**
 * Proforma Invoice Routes
 * PI generation and management
 * Phase 5: Inventory management
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/proforma-invoices
     * List proforma invoices
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 20,
                dealer_id,
                status,
                payment_status,
                date_from,
                date_to
            } = req.query;

            let conditions = [];
            let params = [];

            if (req.user.user_type === 'Dealer') {
                conditions.push('pi.dealer_id = ?');
                params.push(req.user.dealer_id);
            } else if (dealer_id) {
                conditions.push('pi.dealer_id = ?');
                params.push(dealer_id);
            }

            if (status) {
                conditions.push('pi.status = ?');
                params.push(status);
            }
            if (payment_status) {
                conditions.push('pi.payment_status = ?');
                params.push(payment_status);
            }
            if (date_from) {
                conditions.push('pi.invoice_date >= ?');
                params.push(date_from);
            }
            if (date_to) {
                conditions.push('pi.invoice_date <= ?');
                params.push(date_to);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`SELECT COUNT(*) as total FROM proforma_invoices pi ${whereClause}`).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const invoices = db.prepare(`
                SELECT pi.*, d.name as dealer_name, d.dealer_code as dealer_code, u.username as created_by_name
                FROM proforma_invoices pi
                JOIN accounts d ON pi.dealer_id = d.id AND d.account_type = 'DEALER'
                LEFT JOIN users u ON pi.created_by = u.id
                ${whereClause}
                ORDER BY pi.created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: invoices.map(pi => ({
                    id: pi.id,
                    pi_number: pi.pi_number,
                    dealer: { id: pi.dealer_id, name: pi.dealer_name, code: pi.dealer_code },
                    invoice_date: pi.invoice_date,
                    due_date: pi.due_date,
                    total_amount: pi.total_amount,
                    currency: pi.currency,
                    status: pi.status,
                    payment_status: pi.payment_status,
                    paid_amount: pi.paid_amount,
                    created_by: pi.created_by_name,
                    created_at: pi.created_at
                })),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[PI] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/proforma-invoices/:id
     * Get PI detail
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const pi = db.prepare(`
                SELECT pi.*, d.name as dealer_name, d.dealer_code as dealer_code,
                       d.email as dealer_email, d.contact_name as contact_person,
                       u.username as created_by_name
                FROM proforma_invoices pi
                JOIN accounts d ON pi.dealer_id = d.id AND d.account_type = 'DEALER'
                LEFT JOIN users u ON pi.created_by = u.id
                WHERE pi.id = ?
            `).get(req.params.id);

            if (!pi) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '发票不存在' }
                });
            }

            // Permission check
            if (req.user.user_type === 'Dealer' && pi.dealer_id !== req.user.dealer_id) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看此发票' }
                });
            }

            const lineItems = db.prepare(`
                SELECT pli.*, pc.part_number, pc.part_name
                FROM pi_line_items pli
                LEFT JOIN parts_catalog pc ON pli.part_id = pc.id
                WHERE pli.pi_id = ?
            `).all(req.params.id);

            let bankDetails = null;
            try { bankDetails = JSON.parse(pi.bank_details || 'null'); } catch (e) {}

            res.json({
                success: true,
                data: {
                    id: pi.id,
                    pi_number: pi.pi_number,
                    dealer: {
                        id: pi.dealer_id,
                        name: pi.dealer_name,
                        code: pi.dealer_code,
                        email: pi.dealer_email,
                        contact_person: pi.contact_person
                    },
                    invoice_date: pi.invoice_date,
                    due_date: pi.due_date,
                    bill_to: {
                        name: pi.bill_to_name,
                        address: pi.bill_to_address,
                        country: pi.bill_to_country
                    },
                    line_items: lineItems.map(li => ({
                        id: li.id,
                        item_type: li.item_type,
                        part: li.part_id ? { id: li.part_id, number: li.part_number, name: li.part_name } : null,
                        description: li.description,
                        quantity: li.quantity,
                        unit_price: li.unit_price,
                        discount_percent: li.discount_percent,
                        total_price: li.total_price,
                        restock_order_id: li.restock_order_id
                    })),
                    pricing: {
                        subtotal: pi.subtotal,
                        shipping_cost: pi.shipping_cost,
                        tax_amount: pi.tax_amount,
                        discount_amount: pi.discount_amount,
                        total_amount: pi.total_amount
                    },
                    currency: pi.currency,
                    exchange_rate: pi.exchange_rate,
                    payment: {
                        terms: pi.payment_terms,
                        status: pi.payment_status,
                        paid_amount: pi.paid_amount,
                        paid_date: pi.paid_date
                    },
                    bank_details: bankDetails,
                    status: pi.status,
                    notes: pi.notes,
                    internal_notes: pi.internal_notes,
                    sent_at: pi.sent_at,
                    created_by: pi.created_by_name,
                    created_at: pi.created_at,
                    updated_at: pi.updated_at
                }
            });
        } catch (err) {
            console.error('[PI] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/proforma-invoices
     * Create proforma invoice
     */
    router.post('/', authenticate, (req, res) => {
        try {
            if (!['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '权限不足' }
                });
            }

            const {
                dealer_id,
                invoice_date,
                due_date,
                bill_to_name,
                bill_to_address,
                bill_to_country,
                line_items = [],
                shipping_cost = 0,
                tax_amount = 0,
                discount_amount = 0,
                currency = 'USD',
                exchange_rate = 1,
                payment_terms = 'Net30',
                bank_details,
                notes,
                restock_order_id // Optional: create PI from restock order
            } = req.body;

            if (!dealer_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少经销商ID' }
                });
            }

            // Generate PI number
            const piNumber = generatePINumber(db);

            // Calculate subtotal
            let subtotal = 0;
            for (const item of line_items) {
                const itemTotal = (item.unit_price || 0) * (item.quantity || 1) * (1 - (item.discount_percent || 0) / 100);
                subtotal += itemTotal;
            }

            const totalAmount = subtotal + shipping_cost + tax_amount - discount_amount;

            // Get dealer info for bill_to defaults
            const dealer = db.prepare('SELECT * FROM accounts WHERE id = ? AND account_type = ?').get(dealer_id, 'DEALER');

            const result = db.prepare(`
                INSERT INTO proforma_invoices (
                    pi_number, dealer_id,
                    invoice_date, due_date,
                    bill_to_name, bill_to_address, bill_to_country,
                    subtotal, shipping_cost, tax_amount, discount_amount, total_amount,
                    currency, exchange_rate,
                    payment_terms, payment_status,
                    bank_details, notes, status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, 'Draft', ?)
            `).run(
                piNumber, dealer_id,
                invoice_date || new Date().toISOString().slice(0, 10), due_date || null,
                bill_to_name || dealer?.name, bill_to_address || null, bill_to_country || dealer?.country,
                subtotal, shipping_cost, tax_amount, discount_amount, totalAmount,
                currency, exchange_rate,
                payment_terms,
                bank_details ? JSON.stringify(bank_details) : null, notes || null,
                req.user.id
            );

            const piId = result.lastInsertRowid;

            // Insert line items
            for (const item of line_items) {
                const itemTotal = (item.unit_price || 0) * (item.quantity || 1) * (1 - (item.discount_percent || 0) / 100);
                db.prepare(`
                    INSERT INTO pi_line_items (pi_id, item_type, part_id, description, quantity, unit_price, discount_percent, total_price, restock_order_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    piId,
                    item.item_type || 'Part',
                    item.part_id || null,
                    item.description,
                    item.quantity || 1,
                    item.unit_price || 0,
                    item.discount_percent || 0,
                    itemTotal,
                    restock_order_id || null
                );
            }

            // Link to restock order if applicable
            if (restock_order_id) {
                db.prepare('UPDATE restock_orders SET pi_id = ? WHERE id = ?').run(piId, restock_order_id);
            }

            res.status(201).json({
                success: true,
                data: {
                    id: piId,
                    pi_number: piNumber,
                    total_amount: totalAmount
                }
            });
        } catch (err) {
            console.error('[PI] Create error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/proforma-invoices/:id/status
     * Update PI status
     */
    router.patch('/:id/status', authenticate, (req, res) => {
        try {
            const { status } = req.body;

            const pi = db.prepare('SELECT * FROM proforma_invoices WHERE id = ?').get(req.params.id);
            if (!pi) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '发票不存在' }
                });
            }

            const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
            const params = [status];

            if (status === 'Sent') {
                updates.push('sent_at = CURRENT_TIMESTAMP');
            }

            params.push(req.params.id);
            db.prepare(`UPDATE proforma_invoices SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), status }
            });
        } catch (err) {
            console.error('[PI] Update status error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/proforma-invoices/:id/payment
     * Record payment
     */
    router.post('/:id/payment', authenticate, (req, res) => {
        try {
            if (!['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '权限不足' }
                });
            }

            const { amount, paid_date } = req.body;

            const pi = db.prepare('SELECT * FROM proforma_invoices WHERE id = ?').get(req.params.id);
            if (!pi) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '发票不存在' }
                });
            }

            const newPaidAmount = (pi.paid_amount || 0) + amount;
            let paymentStatus = 'PartialPaid';
            if (newPaidAmount >= pi.total_amount) {
                paymentStatus = 'Paid';
            }

            db.prepare(`
                UPDATE proforma_invoices 
                SET paid_amount = ?, payment_status = ?, paid_date = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(newPaidAmount, paymentStatus, paid_date || new Date().toISOString().slice(0, 10), req.params.id);

            res.json({
                success: true,
                data: {
                    id: parseInt(req.params.id),
                    paid_amount: newPaidAmount,
                    payment_status: paymentStatus
                }
            });
        } catch (err) {
            console.error('[PI] Record payment error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/proforma-invoices/from-restock-order/:orderId
     * Generate PI from restock order
     */
    router.post('/from-restock-order/:orderId', authenticate, (req, res) => {
        try {
            if (!['Admin', 'Lead'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '权限不足' }
                });
            }

            const order = db.prepare(`
                SELECT ro.*, d.name as dealer_name, d.country as dealer_country
                FROM restock_orders ro
                JOIN accounts d ON ro.dealer_id = d.id AND d.account_type = 'DEALER'
                WHERE ro.id = ?
            `).get(req.params.orderId);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '订单不存在' }
                });
            }

            if (order.pi_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'PI_EXISTS', message: '该订单已有关联PI' }
                });
            }

            // Get order items
            const orderItems = db.prepare(`
                SELECT roi.*, pc.part_number, pc.part_name
                FROM restock_order_items roi
                JOIN parts_catalog pc ON roi.part_id = pc.id
                WHERE roi.order_id = ?
            `).all(req.params.orderId);

            // Generate PI
            const piNumber = generatePINumber(db);
            const { payment_terms = 'Net30', notes, bank_details } = req.body;

            const dueDate = new Date();
            if (payment_terms === 'Net30') dueDate.setDate(dueDate.getDate() + 30);
            else if (payment_terms === 'Net60') dueDate.setDate(dueDate.getDate() + 60);
            else if (payment_terms === 'Net90') dueDate.setDate(dueDate.getDate() + 90);

            const result = db.prepare(`
                INSERT INTO proforma_invoices (
                    pi_number, dealer_id,
                    invoice_date, due_date,
                    bill_to_name, bill_to_country,
                    subtotal, shipping_cost, total_amount,
                    currency, payment_terms, payment_status,
                    bank_details, notes, status, created_by
                ) VALUES (?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, 'Draft', ?)
            `).run(
                piNumber, order.dealer_id,
                dueDate.toISOString().slice(0, 10),
                order.dealer_name, order.dealer_country,
                order.subtotal, order.shipping_cost, order.total_amount,
                order.currency, payment_terms,
                bank_details ? JSON.stringify(bank_details) : null, notes || null,
                req.user.id
            );

            const piId = result.lastInsertRowid;

            // Insert line items from order
            for (const item of orderItems) {
                db.prepare(`
                    INSERT INTO pi_line_items (pi_id, item_type, part_id, description, quantity, unit_price, total_price, restock_order_id)
                    VALUES (?, 'Part', ?, ?, ?, ?, ?, ?)
                `).run(
                    piId, item.part_id,
                    `${item.part_number} - ${item.part_name}`,
                    item.quantity_approved || item.quantity_requested,
                    item.unit_price, item.total_price,
                    order.id
                );
            }

            // Link order to PI
            db.prepare('UPDATE restock_orders SET pi_id = ? WHERE id = ?').run(piId, order.id);

            res.status(201).json({
                success: true,
                data: {
                    id: piId,
                    pi_number: piNumber,
                    total_amount: order.total_amount
                }
            });
        } catch (err) {
            console.error('[PI] Generate from order error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // Helper functions
    function generatePINumber(db) {
        const today = new Date();
        const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');
        
        const existing = db.prepare('SELECT last_sequence FROM pi_sequences WHERE date_key = ?').get(dateKey);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare('UPDATE pi_sequences SET last_sequence = ? WHERE date_key = ?').run(seq, dateKey);
        } else {
            seq = 1;
            db.prepare('INSERT INTO pi_sequences (date_key, last_sequence) VALUES (?, ?)').run(dateKey, seq);
        }

        return `PI-${dateKey}-${String(seq).padStart(3, '0')}`;
    }

    return router;
};
