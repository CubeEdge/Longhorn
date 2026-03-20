/**
 * Warranty Calculation Engine
 * PRD §5.5 - Warranty calculation with waterfall logic + damage interception
 */

const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    /**
     * Calculate warranty status for a ticket
     * POST /api/v1/warranty/calculate
     * 
     * Request body:
     * {
     *   ticket_id: number,
     *   technical_damage_status: 'no_damage' | 'physical_damage' | 'uncertain'
     * }
     * 
     * Response:
     * {
     *   success: true,
     *   data: {
     *     start_date: string,
     *     end_date: string,
     *     calculation_basis: string,
     *     is_in_warranty: boolean,
     *     is_damage_void_warranty: boolean,
     *     final_warranty_status: 'warranty_valid' | 'warranty_void_damage' | 'warranty_expired'
     *   }
     * }
     */
    router.post('/calculate', authenticate, (req, res) => {
        try {
            const { ticket_id, technical_damage_status } = req.body;

            if (!ticket_id) {
                return res.status(400).json({ success: false, error: 'ticket_id is required' });
            }

            // Get ticket with product information
            const ticket = db.prepare(`
                SELECT t.*, p.warranty_months, p.model_name, p.activation_date, p.sales_invoice_date,
                       p.registration_date, p.sales_channel, p.ship_to_dealer_date
                FROM tickets t
                LEFT JOIN products p ON t.product_id = p.id
                WHERE t.id = ?
            `).get(ticket_id);

            if (!ticket) {
                return res.status(404).json({ success: false, error: 'Ticket not found' });
            }

            // Use product data as installed base data
            const installedBase = ticket.product_id ? {
                activation_date: ticket.activation_date,
                sales_invoice_date: ticket.sales_invoice_date,
                registration_date: ticket.registration_date,
                sales_channel: ticket.sales_channel,
                ship_to_dealer_date: ticket.ship_to_dealer_date
            } : null;

            // Calculate warranty using waterfall logic
            const result = calculateWarranty({
                ticket,
                installedBase,
                technical_damage_status,
                warranty_months: ticket.warranty_months || 24
            });

            res.json({
                success: true,
                data: result
            });

        } catch (err) {
            console.error('[Warranty] Calculation error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * Calculate intrinsic warranty status for a product (without a ticket)
     * GET /api/v1/warranty/product/:product_id
     */
    router.get('/product/:product_id', authenticate, (req, res) => {
        try {
            const product_id = req.params.product_id;

            if (!product_id) {
                return res.status(400).json({ success: false, error: 'product_id is required' });
            }

            // Get product information
            const product = db.prepare(`
                SELECT warranty_months, model_name, activation_date, sales_invoice_date,
                       registration_date, sales_channel, ship_to_dealer_date
                FROM products
                WHERE id = ?
            `).get(product_id);

            if (!product) {
                return res.status(404).json({ success: false, error: 'Product not found' });
            }

            // Create a mock ticket context with just the created_at as now, in case it falls back to ticket creation date
            const mockTicket = { created_at: new Date().toISOString() };

            const result = calculateWarranty({
                ticket: mockTicket,
                installedBase: product, // product data acts as installedBase here
                technical_damage_status: 'no_damage',
                warranty_months: product.warranty_months || 24 // Use product's warranty_months
            });

            return res.json({
                success: true,
                data: result
            });
        } catch (err) {
            console.error('[Warranty] Product Calculate error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * Get warranty calculation for a ticket
     * GET /api/v1/warranty/:ticketId
     */
    router.get('/:ticketId', authenticate, (req, res) => {
        try {
            const { ticketId } = req.params;

            const ticket = db.prepare(`
                SELECT technical_damage_status, technical_warranty_suggestion, warranty_calculation
                FROM tickets
                WHERE id = ?
            `).get(ticketId);

            if (!ticket) {
                return res.status(404).json({ success: false, error: 'Ticket not found' });
            }

            // Parse warranty_calculation JSON if exists
            let warrantyCalculation = null;
            if (ticket.warranty_calculation) {
                try {
                    warrantyCalculation = JSON.parse(ticket.warranty_calculation);
                } catch (e) {
                    console.error('[Warranty] Failed to parse warranty_calculation:', e);
                }
            }

            // 获取最新的诊断报告数据
            let diagnosticReport = null;
            try {
                const diagnosticActivity = db.prepare(`
                    SELECT metadata FROM ticket_activities
                    WHERE ticket_id = ? AND activity_type = 'diagnostic_report'
                    ORDER BY created_at DESC
                    LIMIT 1
                `).get(ticketId);
                
                if (diagnosticActivity && diagnosticActivity.metadata) {
                    const metadata = JSON.parse(diagnosticActivity.metadata);
                    if (metadata.estimated_parts || metadata.estimated_labor_hours) {
                        diagnosticReport = {
                            estimated_parts: metadata.estimated_parts || [],
                            estimated_labor_hours: metadata.estimated_labor_hours || 0
                        };
                    }
                }
            } catch (e) {
                console.error('[Warranty] Failed to fetch diagnostic report:', e);
            }

            res.json({
                success: true,
                data: {
                    technical_damage_status: ticket.technical_damage_status,
                    technical_warranty_suggestion: ticket.technical_warranty_suggestion,
                    warranty_calculation: warrantyCalculation,
                    diagnostic_report: diagnosticReport
                }
            });

        } catch (err) {
            console.error('[Warranty] Get error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /**
     * Save warranty calculation result to ticket
     * POST /api/v1/warranty/:ticketId/save
     */
    router.post('/:ticketId/save', authenticate, (req, res) => {
        try {
            const { ticketId } = req.params;
            const { warranty_calculation } = req.body;

            if (!warranty_calculation) {
                return res.status(400).json({ success: false, error: 'warranty_calculation is required' });
            }

            db.prepare(`
                UPDATE tickets 
                SET warranty_calculation = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(JSON.stringify(warranty_calculation), ticketId);

            res.json({ success: true, message: 'Warranty calculation saved' });

        } catch (err) {
            console.error('[Warranty] Save error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    return router;
};

/**
 * Calculate warranty using waterfall logic + damage interception
 * 
 * @param {Object} params
 * @param {Object} params.ticket - Ticket data
 * @param {Object} params.installedBase - Installed base data
 * @param {string} params.technical_damage_status - OP's damage assessment
 * @param {number} params.warranty_months - Default warranty period (24 months)
 * @returns {Object} Warranty calculation result
 */
function calculateWarranty({ ticket, installedBase, technical_damage_status, warranty_months }) {
    const now = new Date();
    const result = {
        start_date: null,
        end_date: null,
        calculation_basis: null,
        is_in_warranty: false,
        is_damage_void_warranty: false,
        final_warranty_status: null
    };

    // Step 1: Check for physical damage (interception)
    if (technical_damage_status === 'physical_damage') {
        result.is_damage_void_warranty = true;
        result.final_warranty_status = 'warranty_void_damage';
        result.calculation_basis = 'damage_void';
        return result;
    }

    // Step 2: Waterfall calculation for warranty start date
    let warrantyStart = null;
    let calculationBasis = null;

    // Priority 1: IoT activation date
    if (installedBase?.activation_date) {
        warrantyStart = new Date(installedBase.activation_date);
        calculationBasis = 'iot_activation';
    }
    // Priority 2: Sales invoice date
    else if (installedBase?.sales_invoice_date) {
        warrantyStart = new Date(installedBase.sales_invoice_date);
        calculationBasis = 'invoice';
    }
    // Priority 3: Registration date
    else if (installedBase?.registration_date) {
        warrantyStart = new Date(installedBase.registration_date);
        calculationBasis = 'registration';
    }
    // Priority 4: Direct shipment (use ship_to_dealer_date as fallback for direct sales)
    else if (installedBase?.sales_channel === 'DIRECT' && installedBase?.ship_to_dealer_date) {
        warrantyStart = new Date(installedBase.ship_to_dealer_date);
        warrantyStart.setDate(warrantyStart.getDate() + 7);
        calculationBasis = 'direct_ship';
    }
    // Priority 5: Dealer fallback (ship_to_dealer_date + 90 days)
    else if (installedBase?.ship_to_dealer_date) {
        warrantyStart = new Date(installedBase.ship_to_dealer_date);
        warrantyStart.setDate(warrantyStart.getDate() + 90);
        calculationBasis = 'dealer_fallback';
    }
    // No valid warranty basis found - warranty status is uncertain
    // Per PRD §5.5: If none of the 5 priority options have dates, product warranty is undetermined
    else {
        result.calculation_basis = 'unknown';
        result.final_warranty_status = 'warranty_unknown';
        return result;
    }

    // Step 3: Calculate warranty end date
    const warrantyEnd = new Date(warrantyStart);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + warranty_months);

    // Step 4: Check if currently in warranty
    const isInWarranty = now <= warrantyEnd;

    // Populate result
    result.start_date = warrantyStart.toISOString().split('T')[0];
    result.end_date = warrantyEnd.toISOString().split('T')[0];
    result.calculation_basis = calculationBasis;
    result.is_in_warranty = isInWarranty;
    result.is_damage_void_warranty = false;
    result.final_warranty_status = isInWarranty ? 'warranty_valid' : 'warranty_expired';

    return result;
}
