/**
 * Products Route
 * Product-related APIs including warranty check and registration
 */
const express = require('express');

module.exports = function (db, authenticate) {
    const router = express.Router();

    /**
     * GET /api/v1/products
     * List all active products for dropdowns
     */
    router.get('/', authenticate, (req, res) => {
        try {
            const products = db.prepare(`
                SELECT id, model_name as name, product_line as type, product_family
                FROM products 
                ORDER BY product_family ASC, type ASC, model_name ASC
            `).all();

            res.json({
                success: true,
                data: products
            });
        } catch (err) {
            console.error('Error listing products:', err);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    });

    /**
     * GET /api/v1/products/check-warranty
     * Check if a product has warranty basis (for RMA ticket creation)
     * Query params: serial_number
     */
    router.get('/check-warranty', authenticate, (req, res) => {
        try {
            const { serial_number } = req.query;

            if (!serial_number) {
                return res.status(400).json({
                    success: false,
                    error: 'Serial number is required'
                });
            }

            // Find product by serial number with dealer and owner info
            const product = db.prepare(`
                SELECT 
                    p.id, p.model_name, p.serial_number, p.warranty_months,
                    p.activation_date, p.sales_invoice_date, p.registration_date,
                    p.sales_channel, p.ship_to_dealer_date,
                    p.product_sku, p.product_type,
                    p.sold_to_dealer_id, p.current_owner_id,
                    d.name as dealer_name,
                    c.name as owner_name
                FROM products p
                LEFT JOIN accounts d ON p.sold_to_dealer_id = d.id
                LEFT JOIN accounts c ON p.current_owner_id = c.id
                WHERE p.serial_number = ?
            `).get(serial_number);

            if (!product) {
                return res.json({
                    success: true,
                    data: {
                        found: false,
                        has_warranty_basis: false,
                        message: 'Product not found in system'
                    }
                });
            }

            // Check warranty basis according to PRD 352-359 waterfall logic
            const hasWarrantyBasis = !!(
                product.activation_date ||      // Priority 1: IoT activation
                product.sales_invoice_date ||   // Priority 2: Sales invoice
                product.registration_date       // Priority 3: Registration
            );

            // If no priority 1-3, check if we can use fallback (priority 4-5)
            const canUseFallback = !!(
                (product.sales_channel === 'DIRECT' && product.ship_to_dealer_date) ||
                product.ship_to_dealer_date
            );

            res.json({
                success: true,
                data: {
                    found: true,
                    product: {
                        id: product.id,
                        model_name: product.model_name,
                        serial_number: product.serial_number,
                        product_sku: product.product_sku,
                        product_type: product.product_type
                    },
                    has_warranty_basis: hasWarrantyBasis,
                    can_use_fallback: canUseFallback,
                    warranty_info: {
                        activation_date: product.activation_date,
                        sales_invoice_date: product.sales_invoice_date,
                        registration_date: product.registration_date,
                        sales_channel: product.sales_channel,
                        ship_to_dealer_date: product.ship_to_dealer_date,
                        warranty_months: product.warranty_months,
                        sold_to_dealer_id: product.sold_to_dealer_id,
                        sold_to_dealer_name: product.dealer_name,
                        current_owner_id: product.current_owner_id,
                        current_owner_name: product.owner_name
                    },
                    needs_registration: !hasWarrantyBasis
                }
            });
        } catch (err) {
            console.error('Error checking warranty:', err);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    });

    /**
     * POST /api/v1/products/register-warranty
     * Register warranty info for a product (when no warranty basis exists)
     * Body: { 
     *   serial_number, 
     *   sale_source, 
     *   sale_date,
     *   warranty_months,
     *   sales_invoice_proof,
     *   remarks,
     *   sold_to_dealer_id,
     *   current_owner_id
     * }
     */
    router.post('/register-warranty', authenticate, (req, res) => {
        try {
            const { 
                serial_number, 
                sale_source, 
                sale_date,
                warranty_months = 24,
                sales_invoice_proof,
                remarks,
                sold_to_dealer_id,
                current_owner_id
            } = req.body;

            if (!serial_number || !sale_source || !sale_date) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: serial_number, sale_source, sale_date'
                });
            }

            // Validate sale_source
            if (!['invoice', 'customer_statement'].includes(sale_source)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid sale_source. Must be "invoice" or "customer_statement"'
                });
            }

            // Require invoice proof for invoice source
            if (sale_source === 'invoice' && !sales_invoice_proof) {
                return res.status(400).json({
                    success: false,
                    error: 'Invoice proof is required when sale_source is "invoice"'
                });
            }

            // Find product
            const product = db.prepare('SELECT id, model_name FROM products WHERE serial_number = ?').get(serial_number);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found'
                });
            }

            // Calculate warranty dates
            const warrantyStartDate = sale_date;
            const warrantyEndDate = calculateWarrantyEndDate(sale_date, warranty_months);
            const warrantySource = sale_source === 'invoice' ? 'INVOICE_PROOF' : 'REGISTRATION';

            // Update product with warranty registration info
            const updateField = sale_source === 'invoice' ? 'sales_invoice_date' : 'registration_date';

            // Build update query dynamically
            let updateFields = [`${updateField} = ?`];
            let updateValues = [sale_date];

            // Add optional fields
            if (sales_invoice_proof) {
                updateFields.push('sales_invoice_proof = ?');
                updateValues.push(sales_invoice_proof);
            }
            if (sold_to_dealer_id !== undefined) {
                updateFields.push('sold_to_dealer_id = ?');
                updateValues.push(sold_to_dealer_id || null);
            }
            if (current_owner_id !== undefined) {
                updateFields.push('current_owner_id = ?');
                updateValues.push(current_owner_id || null);
            }
            if (warranty_months) {
                updateFields.push('warranty_months = ?');
                updateValues.push(warranty_months);
            }

            // Add warranty calculation fields
            updateFields.push('warranty_start_date = ?');
            updateValues.push(warrantyStartDate);
            updateFields.push('warranty_end_date = ?');
            updateValues.push(warrantyEndDate);
            updateFields.push('warranty_source = ?');
            updateValues.push(warrantySource);
            updateFields.push('warranty_status = ?');
            updateValues.push('ACTIVE');
            updateFields.push('updated_at = datetime(\'now\')');

            // Add product id for WHERE clause
            updateValues.push(product.id);

            const updateQuery = `
                UPDATE products
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `;

            db.prepare(updateQuery).run(...updateValues);

            // Log the registration activity
            db.prepare(`
                INSERT INTO activities (user_id, action, target_type, target_id, details, created_at)
                VALUES (?, 'warranty_registered', 'product', ?, ?, datetime('now'))
            `).run(
                req.user.id,
                product.id,
                JSON.stringify({
                    serial_number,
                    model_name: product.model_name,
                    sale_source,
                    sale_date,
                    warranty_months,
                    warranty_start_date: warrantyStartDate,
                    warranty_end_date: warrantyEndDate,
                    warranty_source: warrantySource,
                    sold_to_dealer_id,
                    current_owner_id,
                    remarks,
                    registered_by: req.user.name || req.user.email
                })
            );

            res.json({
                success: true,
                data: {
                    message: 'Warranty registered successfully',
                    product_id: product.id,
                    registered_field: updateField,
                    sale_date: sale_date,
                    warranty_start_date: warrantyStartDate,
                    warranty_end_date: warrantyEndDate,
                    warranty_source: warrantySource
                }
            });
        } catch (err) {
            console.error('Error registering warranty:', err);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    });

    /**
     * Calculate warranty end date based on start date and months
     */
    function calculateWarrantyEndDate(startDateStr, months) {
        const startDate = new Date(startDateStr);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + months);
        // Subtract one day to get the last day of warranty
        endDate.setDate(endDate.getDate() - 1);
        return endDate.toISOString().split('T')[0];
    }

    return router;
};
