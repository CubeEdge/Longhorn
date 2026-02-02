/**
 * Logistics Routes
 * Shipment tracking and exceptions
 * Phase 4: Repair management
 */

const express = require('express');

module.exports = function(db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/logistics
     * List logistics records
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const {
                page = 1,
                page_size = 20,
                issue_id,
                shipment_type,
                status,
                carrier,
                tracking_number
            } = req.query;

            let conditions = [];
            let params = [];

            if (issue_id) {
                conditions.push('lt.issue_id = ?');
                params.push(issue_id);
            }
            if (shipment_type) {
                conditions.push('lt.shipment_type = ?');
                params.push(shipment_type);
            }
            if (status) {
                conditions.push('lt.status = ?');
                params.push(status);
            }
            if (carrier) {
                conditions.push('lt.carrier = ?');
                params.push(carrier);
            }
            if (tracking_number) {
                conditions.push('lt.tracking_number LIKE ?');
                params.push(`%${tracking_number}%`);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`SELECT COUNT(*) as total FROM logistics_tracking lt ${whereClause}`).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const logistics = db.prepare(`
                SELECT lt.*, i.issue_number, i.rma_number, u.username as created_by_name
                FROM logistics_tracking lt
                LEFT JOIN issues i ON lt.issue_id = i.id
                LEFT JOIN users u ON lt.created_by = u.id
                ${whereClause}
                ORDER BY lt.created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: logistics.map(l => ({
                    id: l.id,
                    issue_id: l.issue_id,
                    issue_number: l.issue_number,
                    rma_number: l.rma_number,
                    shipment_type: l.shipment_type,
                    carrier: l.carrier,
                    tracking_number: l.tracking_number,
                    status: l.status,
                    shipped_at: l.shipped_at,
                    estimated_delivery: l.estimated_delivery,
                    delivered_at: l.delivered_at,
                    created_by: l.created_by_name,
                    created_at: l.created_at
                })),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Logistics] List error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * GET /api/v1/logistics/:id
     * Get logistics detail with tracking events
     */
    router.get('/:id', authenticate, (req, res) => {
        try {
            const logistics = db.prepare(`
                SELECT lt.*, i.issue_number, i.rma_number, u.username as created_by_name
                FROM logistics_tracking lt
                LEFT JOIN issues i ON lt.issue_id = i.id
                LEFT JOIN users u ON lt.created_by = u.id
                WHERE lt.id = ?
            `).get(req.params.id);

            if (!logistics) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '物流记录不存在' }
                });
            }

            const events = db.prepare(`
                SELECT * FROM logistics_events
                WHERE logistics_id = ?
                ORDER BY event_time DESC
            `).all(req.params.id);

            let dimensions = null;
            try { dimensions = JSON.parse(logistics.dimensions || 'null'); } catch (e) {}

            res.json({
                success: true,
                data: {
                    id: logistics.id,
                    issue: {
                        id: logistics.issue_id,
                        issue_number: logistics.issue_number,
                        rma_number: logistics.rma_number
                    },
                    shipment_type: logistics.shipment_type,
                    carrier: logistics.carrier,
                    tracking_number: logistics.tracking_number,
                    from_address: logistics.from_address,
                    to_address: logistics.to_address,
                    status: logistics.status,
                    shipped_at: logistics.shipped_at,
                    estimated_delivery: logistics.estimated_delivery,
                    delivered_at: logistics.delivered_at,
                    package_info: {
                        count: logistics.package_count,
                        weight: logistics.total_weight,
                        dimensions
                    },
                    shipping_cost: logistics.shipping_cost,
                    currency: logistics.currency,
                    notes: logistics.notes,
                    exception_reason: logistics.exception_reason,
                    events: events.map(e => ({
                        id: e.id,
                        event_time: e.event_time,
                        location: e.location,
                        status: e.status,
                        description: e.description,
                        source: e.source
                    })),
                    created_by: { name: logistics.created_by_name },
                    created_at: logistics.created_at,
                    updated_at: logistics.updated_at
                }
            });
        } catch (err) {
            console.error('[Logistics] Detail error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/logistics
     * Create logistics record
     */
    router.post('/', authenticate, (req, res) => {
        try {
            const {
                issue_id,
                shipment_type,
                carrier,
                tracking_number,
                from_address,
                to_address,
                package_count = 1,
                total_weight,
                dimensions,
                shipping_cost = 0,
                currency = 'RMB',
                notes
            } = req.body;

            if (!issue_id || !shipment_type) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必填字段' }
                });
            }

            // Verify issue exists
            const issue = db.prepare('SELECT id FROM issues WHERE id = ?').get(issue_id);
            if (!issue) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '工单不存在' }
                });
            }

            const result = db.prepare(`
                INSERT INTO logistics_tracking (
                    issue_id, shipment_type, carrier, tracking_number,
                    from_address, to_address,
                    package_count, total_weight, dimensions,
                    shipping_cost, currency, notes,
                    status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
            `).run(
                issue_id, shipment_type, carrier || null, tracking_number || null,
                from_address || null, to_address || null,
                package_count, total_weight || null, dimensions ? JSON.stringify(dimensions) : null,
                shipping_cost, currency, notes || null,
                req.user.id
            );

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    status: 'Pending',
                    created_at: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error('[Logistics] Create error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/logistics/:id
     * Update logistics record
     */
    router.patch('/:id', authenticate, (req, res) => {
        try {
            const logistics = db.prepare('SELECT * FROM logistics_tracking WHERE id = ?').get(req.params.id);
            if (!logistics) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '物流记录不存在' }
                });
            }

            const allowedFields = [
                'carrier', 'tracking_number', 'from_address', 'to_address',
                'status', 'shipped_at', 'estimated_delivery', 'delivered_at',
                'package_count', 'total_weight', 'shipping_cost', 'notes', 'exception_reason'
            ];

            const updates = [];
            const params = [];

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(req.body[field]);
                }
            }

            if (req.body.dimensions !== undefined) {
                updates.push('dimensions = ?');
                params.push(JSON.stringify(req.body.dimensions));
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_CHANGES', message: '没有需要更新的字段' }
                });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(req.params.id);

            db.prepare(`UPDATE logistics_tracking SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            // Add event if status changed
            if (req.body.status && req.body.status !== logistics.status) {
                db.prepare(`
                    INSERT INTO logistics_events (logistics_id, event_time, status, description, source)
                    VALUES (?, CURRENT_TIMESTAMP, ?, ?, 'Manual')
                `).run(req.params.id, req.body.status, `状态更新为: ${req.body.status}`);
            }

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), updated_at: new Date().toISOString() }
            });
        } catch (err) {
            console.error('[Logistics] Update error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/logistics/:id/events
     * Add tracking event
     */
    router.post('/:id/events', authenticate, (req, res) => {
        try {
            const logistics = db.prepare('SELECT id FROM logistics_tracking WHERE id = ?').get(req.params.id);
            if (!logistics) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '物流记录不存在' }
                });
            }

            const { event_time, location, status, description } = req.body;

            if (!status || !description) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必填字段' }
                });
            }

            const result = db.prepare(`
                INSERT INTO logistics_events (logistics_id, event_time, location, status, description, source)
                VALUES (?, ?, ?, ?, ?, 'Manual')
            `).run(req.params.id, event_time || new Date().toISOString(), location || null, status, description);

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    event_time: event_time || new Date().toISOString()
                }
            });
        } catch (err) {
            console.error('[Logistics] Add event error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    // =====================
    // Exceptions
    // =====================

    /**
     * GET /api/v1/logistics/exceptions
     * List repair exceptions
     */
    router.get('/exceptions/list', authenticate, (req, res) => {
        try {
            const { page = 1, page_size = 20, issue_id, status, exception_type } = req.query;

            let conditions = [];
            let params = [];

            if (issue_id) {
                conditions.push('re.issue_id = ?');
                params.push(issue_id);
            }
            if (status) {
                conditions.push('re.status = ?');
                params.push(status);
            }
            if (exception_type) {
                conditions.push('re.exception_type = ?');
                params.push(exception_type);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`SELECT COUNT(*) as total FROM repair_exceptions re ${whereClause}`).get(...params).total;

            const offset = (parseInt(page) - 1) * parseInt(page_size);
            const exceptions = db.prepare(`
                SELECT re.*, i.issue_number, u.username as reported_by_name
                FROM repair_exceptions re
                LEFT JOIN issues i ON re.issue_id = i.id
                LEFT JOIN users u ON re.reported_by = u.id
                ${whereClause}
                ORDER BY re.created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, parseInt(page_size), offset);

            res.json({
                success: true,
                data: exceptions.map(e => ({
                    id: e.id,
                    issue_id: e.issue_id,
                    issue_number: e.issue_number,
                    exception_type: e.exception_type,
                    description: e.description,
                    impact: e.impact,
                    status: e.status,
                    reported_by: e.reported_by_name,
                    created_at: e.created_at
                })),
                meta: {
                    page: parseInt(page),
                    page_size: parseInt(page_size),
                    total,
                    total_pages: Math.ceil(total / parseInt(page_size))
                }
            });
        } catch (err) {
            console.error('[Logistics] Exceptions list error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * POST /api/v1/logistics/exceptions
     * Report repair exception
     */
    router.post('/exceptions', authenticate, (req, res) => {
        try {
            const { issue_id, exception_type, description, impact } = req.body;

            if (!issue_id || !exception_type || !description) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: '缺少必填字段' }
                });
            }

            const result = db.prepare(`
                INSERT INTO repair_exceptions (issue_id, exception_type, description, impact, status, reported_by)
                VALUES (?, ?, ?, ?, 'Open', ?)
            `).run(issue_id, exception_type, description, impact || null, req.user.id);

            res.status(201).json({
                success: true,
                data: {
                    id: result.lastInsertRowid,
                    status: 'Open',
                    created_at: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error('[Logistics] Create exception error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    /**
     * PATCH /api/v1/logistics/exceptions/:id
     * Update/resolve exception
     */
    router.patch('/exceptions/:id', authenticate, (req, res) => {
        try {
            const exception = db.prepare('SELECT * FROM repair_exceptions WHERE id = ?').get(req.params.id);
            if (!exception) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: '异常记录不存在' }
                });
            }

            const { status, resolution } = req.body;
            const updates = ['updated_at = CURRENT_TIMESTAMP'];
            const params = [];

            if (status) {
                updates.push('status = ?');
                params.push(status);

                if (status === 'Resolved' || status === 'Closed') {
                    updates.push('resolved_at = CURRENT_TIMESTAMP', 'resolved_by = ?');
                    params.push(req.user.id);
                }
            }
            if (resolution !== undefined) {
                updates.push('resolution = ?');
                params.push(resolution);
            }

            params.push(req.params.id);
            db.prepare(`UPDATE repair_exceptions SET ${updates.join(', ')} WHERE id = ?`).run(...params);

            res.json({
                success: true,
                data: { id: parseInt(req.params.id), updated_at: new Date().toISOString() }
            });
        } catch (err) {
            console.error('[Logistics] Update exception error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

    return router;
};
