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
                    p.*,
                    d.name as dealer_name,
                    c.name as owner_name,
                    ps.sku_code, ps.display_name as sku_name, ps.sku_image, ps.spec_label,
                    pm.name_zh as model_display_name, pm.name_en as model_name_en, pm.hero_image, pm.brand
                FROM products p
                LEFT JOIN accounts d ON p.sold_to_dealer_id = d.id
                LEFT JOIN accounts c ON p.current_owner_id = c.id
                LEFT JOIN product_skus ps ON p.sku_id = ps.id
                LEFT JOIN product_models pm ON ps.model_id = pm.id
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
                model_name,
                product_sku,
                sku_id,
                product_line,
                product_family,
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
            if (!['invoice', 'customer_statement', 'shipping_record'].includes(sale_source)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid sale_source. Must be "invoice", "customer_statement" or "shipping_record"'
                });
            }

            // Require invoice proof for invoice source
            if (sale_source === 'invoice' && !sales_invoice_proof) {
                return res.status(400).json({
                    success: false,
                    error: 'Invoice proof is required when sale_source is "invoice"'
                });
            }

            // Require shipping record info for shipping_record source
            if (sale_source === 'shipping_record' && !shipping_record_info) {
                return res.status(400).json({
                    success: false,
                    error: 'Shipping record info is required when sale_source is "shipping_record"'
                });
            }

            // Find product
            let product = db.prepare('SELECT id, model_name, activation_date, sales_invoice_date, registration_date, sales_channel, ship_to_dealer_date FROM products WHERE serial_number = ?').get(serial_number);
            if (!product) {
                // If product doesn't exist, create it if model_name is provided
                if (!model_name) {
                    return res.status(404).json({
                        success: false,
                        error: 'Product not found and model_name not provided for auto-creation'
                    });
                }

                // Validate product_line if provided
                const validProductLines = ['Camera', 'EVF', 'Accessory'];
                const finalProductLine = validProductLines.includes(product_line) ? product_line : 'Camera';

                // Validate product_family if provided
                const validProductFamilies = ['A', 'B', 'C', 'D'];
                const finalProductFamily = validProductFamilies.includes(product_family) ? product_family : 'A';

                // Create product with user-provided values
                const insertRes = db.prepare(`
                    INSERT INTO products (
                        model_name, serial_number, product_sku, sku_id, product_line, product_family, status,
                        sales_channel, sold_to_dealer_id, current_owner_id,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, datetime('now'), datetime('now'))
                `).run(
                    model_name || '未知型号',
                    serial_number,
                    product_sku || null,
                    sku_id || null,
                    finalProductLine,
                    finalProductFamily,
                    sold_to_dealer_id ? 'DEALER' : 'DIRECT',
                    sold_to_dealer_id || null,
                    current_owner_id || null
                );

                product = {
                    id: insertRes.lastInsertRowid,
                    model_name: model_name,
                    activation_date: null,
                    sales_invoice_date: null,
                    registration_date: null,
                    sales_channel: sold_to_dealer_id ? 'DEALER' : 'DIRECT',
                    ship_to_dealer_date: null
                };
            }

            // Update product with warranty registration info
            const updateField = sale_source === 'invoice' ? 'sales_invoice_date' : 'registration_date';

            // Build update query dynamically
            let updateFields = [`${updateField} = ?`];
            let updateValues = [sale_date];

            // Update basic info fields if provided (for existing products)
            if (model_name) {
                updateFields.push('model_name = ?');
                updateValues.push(model_name);
            }
            if (product_sku !== undefined) {
                updateFields.push('product_sku = ?');
                updateValues.push(product_sku || null);
            }
            if (sku_id !== undefined) {
                updateFields.push('sku_id = ?');
                updateValues.push(sku_id || null);
            }
            if (product_line) {
                const validProductLines = ['Camera', 'EVF', 'Accessory'];
                if (validProductLines.includes(product_line)) {
                    updateFields.push('product_line = ?');
                    updateValues.push(product_line);
                }
            }
            if (product_family) {
                const validProductFamilies = ['A', 'B', 'C', 'D'];
                if (validProductFamilies.includes(product_family)) {
                    updateFields.push('product_family = ?');
                    updateValues.push(product_family);
                }
            }

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

            // Use new Waterfall logic from §5.5
            const { startDate: warrantyStartDate, endDate: warrantyEndDate, source: warrantySource } = calculateWarrantyInfo({
                activation_date: product.activation_date, // Original might be null, it's fine
                sales_invoice_date: updateField === 'sales_invoice_date' ? sale_date : product.sales_invoice_date,
                registration_date: updateField === 'registration_date' ? sale_date : product.registration_date,
                sales_channel: product.sales_channel || (sold_to_dealer_id ? 'DEALER' : 'DIRECT'),
                ship_to_dealer_date: product.ship_to_dealer_date
            }, warranty_months);

            const now = new Date();
            const end = new Date(warrantyEndDate);
            const status = end > now ? 'ACTIVE' : 'EXPIRED';

            updateFields.push('warranty_start_date = ?');
            updateValues.push(warrantyStartDate);
            updateFields.push('warranty_end_date = ?');
            updateValues.push(warrantyEndDate);
            updateFields.push('warranty_source = ?');
            updateValues.push(warrantySource);
            updateFields.push('warranty_status = ?');
            updateValues.push(status);
            updateFields.push('updated_at = datetime(\'now\')');

            // Add product id for WHERE clause
            updateValues.push(product.id);

            const updateQuery = `
                UPDATE products
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `;

            db.prepare(updateQuery).run(...updateValues);

            // NOTE: The activities table does not exist.
            // Temporarily skipping logging since we use ticket_activities bounded to tickets.

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
     * Service PRD P2 §5.5 - Warranty Calculation Engine (Waterfall)
     */
    function calculateWarrantyInfo(data, months = 24) {
        let startDate = null;
        let source = 'DEALER_FALLBACK';

        // P1: IoT Activation
        if (data.activation_date) {
            startDate = data.activation_date;
            source = 'IOT_ACTIVATION';
        }
        // P2: Sales Invoice
        else if (data.sales_invoice_date) {
            startDate = data.sales_invoice_date;
            source = 'INVOICE_PROOF';
        }
        // P3: Manual Registration
        else if (data.registration_date) {
            startDate = data.registration_date;
            source = 'REGISTRATION';
        }
        // P4: Direct Sales (Ship + 7 days)
        else if (data.sales_channel === 'DIRECT' && data.ship_to_dealer_date) {
            const shipDate = new Date(data.ship_to_dealer_date);
            shipDate.setDate(shipDate.getDate() + 7);
            startDate = shipDate.toISOString().split('T')[0];
            source = 'DIRECT_SHIPMENT';
        }
        // P5: Dealer Fallback (Ship + 90 days)
        else if (data.ship_to_dealer_date) {
            const shipDate = new Date(data.ship_to_dealer_date);
            shipDate.setDate(shipDate.getDate() + 90);
            startDate = shipDate.toISOString().split('T')[0];
            source = 'DEALER_FALLBACK';
        }

        if (!startDate) return { startDate: null, endDate: null, source: 'NONE' };

        // Calculate End Date
        const start = new Date(startDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + months);
        end.setDate(end.getDate() - 1); // Last day of warranty

        return {
            startDate,
            endDate: end.toISOString().split('T')[0],
            source
        };
    }

    return router;
};
