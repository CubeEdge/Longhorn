/**
 * Products Route
 * Simple read-only API for product selection
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
                SELECT id, model_name as name, product_line as type 
                FROM products 
                ORDER BY type ASC, model_name ASC
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

    return router;
};
