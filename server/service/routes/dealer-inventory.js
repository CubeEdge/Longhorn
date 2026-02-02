/**
 * Dealer Inventory Routes
 * Dealer parts inventory and restock orders
 * Phase 5: Inventory management
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/dealer-inventory
     * List dealer inventory (filtered by user's dealer if applicable)
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 50,
                dealer_id,
                part_id,
                low_stock = 'false', // Show only items below reorder point
                category
            } = req.query;

            let conditions = [];
            let params = [];

            // Filter by dealer based on user type
            if (req.user.user_type === 'Dealer') {
                conditions.push('di.dealer_id = ?');
                params.push(req.user.dealer_id);
            } else if (dealer_id) {
                conditions.push('di.dealer_id = ?');
                params.push(dealer_id);
            }

            if (part_id) {
                conditions.push('di.part_id = ?');
                params.push(part_id);
            }
            if (low_stock === 'true') {
                conditions.push('di.quantity <= di.reorder_point');
            }
            if (category) {
                conditions.push('pc.category = ?');
                params.push(category);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`
                SELECT COUNT(*) as total 
                FROM dealer_inventory di
                JOIN parts_catalog pc ON di.part_id = pc.id
                ${whereClause}
            `).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const inventory = db.prepare(`
                SELECT di.*, 
                       pc.part_number, pc.part_name, pc.category,
                       d.name as dealer_name, d.code as dealer_code
                FROM dealer_inventory di
                JOIN parts_catalog pc ON di.part_id = pc.id
                JOIN dealers d ON di.dealer_id = d.id
                ${whereClause}
                ORDER BY di.quantity <= di.reorder_point DESC, pc.category, pc.part_name
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: inventory.map(i => ({
                    id: i.id,
                    dealer: { id: i.dealer_id, name: i.dealer_name, code: i.dealer_code },
                    part: {
                        id: i.part_id,
                        number: i.part_number,
                        name: i.part_name,
                        category: i.category
                    },
                    quantity: i.quantity,
                    reserved_quantity: i.reserved_quantity,
                    available_quantity: i.available_quantity,
                    min_stock_level: i.min_stock_level,
                    reorder_point: i.reorder_point,
                    is_low_stock: i.quantity <= i.reorder_point,
                    last_inbound_date: i.last_inbound_date,
                    last_outbound_date: i.last_outbound_date,
                    updated_at: i.updated_at
                })),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[DealerInventory] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/dealer-inventory/transaction
     * Record inventory transaction (Admin/Lead only for manual adjustments)
     */
    router.post('/transaction', authenticate, (req, res) => {
        try {
            const {
                dealer_id,
                part_id,
                transaction_type, // Inbound/Outbound/Adjustment
                quantity,
                reference_type,
                reference_id,
                reason,
                notes
            } = req.body;

            // Validation
            if (!dealer_id || !part_id || !transaction_type || quantity === undefined) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必填字段' }
                });
            }

            // Permission check for manual transactions
            if (!['Admin', 'Lead'].includes(req.user.role) && req.user.user_type !== 'Dealer') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '权限不足' }
                });
            }

            // Get or create inventory record
            let inventory = db.prepare(`
                SELECT * FROM dealer_inventory WHERE dealer_id = ? AND part_id = ?
            `).get(dealer_id, part_id);

            if (!inventory) {
                db.prepare(`
                    INSERT INTO dealer_inventory (dealer_id, part_id, quantity) VALUES (?, ?, 0)
                `).run(dealer_id, part_id);
                inventory = { quantity: 0 };
            }

            // Calculate new quantity
            let adjustedQty = quantity;
            if (transaction_type === 'Outbound') {
                adjustedQty = -Math.abs(quantity);
            } else if (transaction_type === 'Inbound') {
                adjustedQty = Math.abs(quantity);
            }

            const newBalance = inventory.quantity + adjustedQty;

            if (newBalance < 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INSUFFICIENT_STOCK', message: '库存不足' }
                });
            }

            // Update inventory
            const dateField = transaction_type === 'Inbound' ? 'last_inbound_date' : 'last_outbound_date';
            db.prepare(`
                UPDATE dealer_inventory 
                SET quantity = ?, ${dateField} = date('now'), updated_at = CURRENT_TIMESTAMP
                WHERE dealer_id = ? AND part_id = ?
            `).run(newBalance, dealer_id, part_id);

            // Record transaction
            const result = db.prepare(`
                INSERT INTO inventory_transactions (
                    dealer_id, part_id, transaction_type, quantity,
                    reference_type, reference_id, balance_after,
                    reason, notes, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                dealer_id, part_id, transaction_type, adjustedQty,
                reference_type || null, reference_id || null, newBalance,
                reason || null, notes || null, req.user.id
            );

            res.status(201).json({
                success: true,
                data: {
                    transaction_id: result.lastInsertRowid,
                    new_balance: newBalance
                }
            });
        } catch (err) {
            console.error('[DealerInventory] Transaction error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/dealer-inventory/transactions
     * List inventory transactions
     */
    router.get('/transactions', authenticate, (req, res) => {
        try {
            const { page = 1, page_size = 50, dealer_id, part_id, transaction_type, date_from, date_to } = req.query;

            let conditions = [];
            let params = [];

            if (req.user.user_type === 'Dealer') {
                conditions.push('it.dealer_id = ?');
                params.push(req.user.dealer_id);
            } else if (dealer_id) {
                conditions.push('it.dealer_id = ?');
                params.push(dealer_id);
            }

            if (part_id) {
                conditions.push('it.part_id = ?');
                params.push(part_id);
            }
            if (transaction_type) {
                conditions.push('it.transaction_type = ?');
                params.push(transaction_type);
            }
            if (date_from) {
                conditions.push('date(it.created_at) >= ?');
                params.push(date_from);
            }
            if (date_to) {
                conditions.push('date(it.created_at) <= ?');
                params.push(date_to);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`SELECT COUNT(*) as total FROM inventory_transactions it ${whereClause}`).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const transactions = db.prepare(`
                SELECT it.*, pc.part_number, pc.part_name, d.name as dealer_name, u.username as created_by_name
                FROM inventory_transactions it
                JOIN parts_catalog pc ON it.part_id = pc.id
                JOIN dealers d ON it.dealer_id = d.id
                LEFT JOIN users u ON it.created_by = u.id
                ${whereClause}
                ORDER BY it.created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: transactions.map(t => ({
                    id: t.id,
                    dealer: { id: t.dealer_id, name: t.dealer_name },
                    part: { id: t.part_id, number: t.part_number, name: t.part_name },
                    transaction_type: t.transaction_type,
                    quantity: t.quantity,
                    balance_after: t.balance_after,
                    reference: t.reference_type ? { type: t.reference_type, id: t.reference_id } : null,
                    reason: t.reason,
                    notes: t.notes,
                    created_by: t.created_by_name,
                    created_at: t.created_at
                })),
                meta: { page: parseInt(page), page_size: parseInt(page_size), total, total_pages: Math.ceil(total / parseInt(page_size)) }
            });
        } catch (err) {
            console.error('[DealerInventory] Transactions list error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/dealer-inventory/low-stock
     * Get low stock alerts
     */
    router.get('/low-stock', authenticate, (req, res) => {
        try {
            let conditions = ['di.quantity <= di.reorder_point'];
            let params = [];

            if (req.user.user_type === 'Dealer') {
                conditions.push('di.dealer_id = ?');
                params.push(req.user.dealer_id);
            }

            const alerts = db.prepare(`
                SELECT di.*, pc.part_number, pc.part_name, pc.category, d.name as dealer_name
                FROM dealer_inventory di
                JOIN parts_catalog pc ON di.part_id = pc.id
                JOIN dealers d ON di.dealer_id = d.id
                WHERE ${conditions.join(' AND ')}
                ORDER BY (di.reorder_point - di.quantity) DESC
            `).all(...params);

            res.json({
                success: true,
                data: alerts.map(a => ({
                    dealer: { id: a.dealer_id, name: a.dealer_name },
                    part: { id: a.part_id, number: a.part_number, name: a.part_name, category: a.category },
                    current_quantity: a.quantity,
                    reorder_point: a.reorder_point,
                    shortage: a.reorder_point - a.quantity
                })),
                meta: { total: alerts.length }
            });
        } catch (err) {
            console.error('[DealerInventory] Low stock error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // =====================
    // Restock Orders
    // =====================

    /**
     * GET /api/v1/dealer-inventory/restock-orders
     * List restock orders
     */
    router.get('/restock-orders', authenticate, (req, res) => {
        try {
            const { page = 1, page_size = 20, status, dealer_id } = req.query;

            let conditions = [];
            let params = [];

            if (req.user.user_type === 'Dealer') {
                conditions.push('ro.dealer_id = ?');
                params.push(req.user.dealer_id);
            } else if (dealer_id) {
                conditions.push('ro.dealer_id = ?');
                params.push(dealer_id);
            }

            if (status) {
                conditions.push('ro.status = ?');
                params.push(status);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`SELECT COUNT(*) as total FROM restock_orders ro ${whereClause}`).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const orders = db.prepare(`
                SELECT ro.*, d.name as dealer_name, u.username as created_by_name
                FROM restock_orders ro
                JOIN dealers d ON ro.dealer_id = d.id
                LEFT JOIN users u ON ro.created_by = u.id
                ${whereClause}
                ORDER BY ro.created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: orders.map(o => ({
                    id: o.id,
                    order_number: o.order_number,
                    dealer: { id: o.dealer_id, name: o.dealer_name },
                    status: o.status,
                    total_amount: o.total_amount,
                    currency: o.currency,
                    submitted_at: o.submitted_at,
                    shipped_at: o.shipped_at,
                    created_by: o.created_by_name,
                    created_at: o.created_at
                })),
                meta: { page: parseInt(page), page_size: parseInt(page_size), total, total_pages: Math.ceil(total / parseInt(page_size)) }
            });
        } catch (err) {
            console.error('[DealerInventory] Restock orders list error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/dealer-inventory/restock-orders
     * Create restock order
     */
    router.post('/restock-orders', authenticate, (req, res) => {
        try {
            const {
                dealer_id,
                items = [], // [{part_id, quantity}]
                shipping_address,
                shipping_method,
                dealer_notes
            } = req.body;

            // Determine dealer_id
            const finalDealerId = req.user.user_type === 'Dealer' ? req.user.dealer_id : dealer_id;

            if (!finalDealerId || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必填字段' }
                });
            }

            // Generate order number
            const orderNumber = generateRestockOrderNumber(db);

            // Calculate totals
            let subtotal = 0;
            const itemsWithPrice = [];
            for (const item of items) {
                const part = db.prepare('SELECT * FROM parts_catalog WHERE id = ?').get(item.part_id);
                if (part) {
                    const totalPrice = part.dealer_price * item.quantity;
                    subtotal += totalPrice;
                    itemsWithPrice.push({
                        ...item,
                        unit_price: part.dealer_price,
                        total_price: totalPrice
                    });
                }
            }

            // Create order
            const result = db.prepare(`
                INSERT INTO restock_orders (
                    order_number, dealer_id, status,
                    shipping_address, shipping_method,
                    subtotal, total_amount, currency,
                    dealer_notes, created_by
                ) VALUES (?, ?, 'Draft', ?, ?, ?, ?, 'USD', ?, ?)
            `).run(
                orderNumber, finalDealerId,
                shipping_address || null, shipping_method || null,
                subtotal, subtotal,
                dealer_notes || null, req.user.id
            );

            const orderId = result.lastInsertRowid;

            // Insert line items
            for (const item of itemsWithPrice) {
                db.prepare(`
                    INSERT INTO restock_order_items (order_id, part_id, quantity_requested, unit_price, total_price)
                    VALUES (?, ?, ?, ?, ?)
                `).run(orderId, item.part_id, item.quantity, item.unit_price, item.total_price);
            }

            res.status(201).json({
                success: true,
                data: {
                    id: orderId,
                    order_number: orderNumber,
                    total_amount: subtotal
                }
            });
        } catch (err) {
            console.error('[DealerInventory] Create restock order error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/dealer-inventory/restock-orders/:id
     * Get restock order detail
     */
    router.get('/restock-orders/:id', authenticate, (req, res) => {
        try {
            const order = db.prepare(`
                SELECT ro.*, d.name as dealer_name, d.code as dealer_code,
                       u.username as created_by_name, approver.username as approved_by_name
                FROM restock_orders ro
                JOIN dealers d ON ro.dealer_id = d.id
                LEFT JOIN users u ON ro.created_by = u.id
                LEFT JOIN users approver ON ro.approved_by = approver.id
                WHERE ro.id = ?
            `).get(req.params.id);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '订单不存在' }
                });
            }

            // Permission check
            if (req.user.user_type === 'Dealer' && order.dealer_id !== req.user.dealer_id) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看此订单' }
                });
            }

            const items = db.prepare(`
                SELECT roi.*, pc.part_number, pc.part_name
                FROM restock_order_items roi
                JOIN parts_catalog pc ON roi.part_id = pc.id
                WHERE roi.order_id = ?
            `).all(req.params.id);

            res.json({
                success: true,
                data: {
                    id: order.id,
                    order_number: order.order_number,
                    dealer: { id: order.dealer_id, name: order.dealer_name, code: order.dealer_code },
                    status: order.status,
                    shipping_address: order.shipping_address,
                    shipping_method: order.shipping_method,
                    tracking_number: order.tracking_number,
                    items: items.map(i => ({
                        id: i.id,
                        part: { id: i.part_id, number: i.part_number, name: i.part_name },
                        quantity_requested: i.quantity_requested,
                        quantity_approved: i.quantity_approved,
                        quantity_shipped: i.quantity_shipped,
                        unit_price: i.unit_price,
                        total_price: i.total_price
                    })),
                    pricing: {
                        subtotal: order.subtotal,
                        shipping_cost: order.shipping_cost,
                        total_amount: order.total_amount
                    },
                    currency: order.currency,
                    pi_id: order.pi_id,
                    dealer_notes: order.dealer_notes,
                    internal_notes: order.internal_notes,
                    submitted_at: order.submitted_at,
                    approved_at: order.approved_at,
                    shipped_at: order.shipped_at,
                    delivered_at: order.delivered_at,
                    created_by: order.created_by_name,
                    approved_by: order.approved_by_name,
                    created_at: order.created_at
                }
            });
        } catch (err) {
            console.error('[DealerInventory] Restock order detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/dealer-inventory/restock-orders/:id/status
     * Update restock order status
     */
    router.patch('/restock-orders/:id/status', authenticate, (req, res) => {
        try {
            const { status, tracking_number, internal_notes } = req.body;

            const order = db.prepare('SELECT * FROM restock_orders WHERE id = ?').get(req.params.id);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '订单不存在' }
                });
            }

            const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
            const params = [status];

            if (status === 'Submitted') {
                updates.push('submitted_at = CURRENT_TIMESTAMP');
            } else if (status === 'Approved') {
                updates.push('approved_at = CURRENT_TIMESTAMP', 'approved_by = ?');
                params.push(req.user.id);
            } else if (status === 'Shipped') {
                updates.push('shipped_at = CURRENT_TIMESTAMP');
                if (tracking_number) {
                    updates.push('tracking_number = ?');
                    params.push(tracking_number);
                }
            } else if (status === 'Delivered') {
                updates.push('delivered_at = CURRENT_TIMESTAMP');
            }

            if (internal_notes) {
                updates.push('internal_notes = ?');
                params.push(internal_notes);
            }

            params.push(req.params.id);
            db.prepare(`UPDATE restock_orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), status }
            });
        } catch (err) {
            console.error('[DealerInventory] Update restock status error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // Helper functions
    function generateRestockOrderNumber(db) {
        const today = new Date();
        const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');
        
        const existing = db.prepare('SELECT last_sequence FROM restock_order_sequences WHERE date_key = ?').get(dateKey);

        let seq;
        if (existing) {
            seq = existing.last_sequence + 1;
            db.prepare('UPDATE restock_order_sequences SET last_sequence = ? WHERE date_key = ?').run(seq, dateKey);
        } else {
            seq = 1;
            db.prepare('INSERT INTO restock_order_sequences (date_key, last_sequence) VALUES (?, ?)').run(dateKey, seq);
        }

        return `RO-${dateKey}-${String(seq).padStart(3, '0')}`;
    }

    return router;
};
