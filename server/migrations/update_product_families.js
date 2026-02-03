const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../longhorn.db');
const db = new Database(dbPath, { verbose: console.log });

console.log('Running migration: update_product_families...');

// 1. Add columns if not exist
const tables = ['inquiry_tickets', 'rma_tickets', 'dealer_repairs'];

tables.forEach(table => {
    try {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN product_family TEXT`).run();
        console.log(`Added product_family to ${table}`);
    } catch (e) {
        if (!e.message.includes('duplicate column name')) {
            throw e;
        }
        console.log(`product_family already exists in ${table}`);
    }
});

// 2. Helper to determine family from product
// A -> MAVO
// B -> TERRA (Adjusted: Since B contains MAVO LF in seed, let's handle by Model Name priority)
// C -> Monitoring
// D -> Accessories
function determineFamily(product) {
    if (!product) return 'Other';
    const model = (product.model_name || '').toUpperCase();

    if (model.includes('MAVO')) return 'MAVO';
    if (model.includes('TERRA')) return 'TERRA';
    if (model.includes('EAGLE') || model.includes('EVF')) return 'Monitoring';
    if (product.product_line === 'Accessory' || model.includes('BATTERY') || model.includes('BOARD')) return 'Accessories';

    // Fallback based on existing family code if available
    if (product.product_family === 'A') return 'MAVO';
    if (product.product_family === 'B') return 'TERRA'; // Rough approx
    if (product.product_family === 'C') return 'Monitoring';
    if (product.product_family === 'D') return 'Accessories';

    return 'Other';
}

// 3. Update existing tickets
const updateStats = {
    inquiry_tickets: 0,
    rma_tickets: 0,
    dealer_repairs: 0
};

db.transaction(() => {
    // A. Update Inquiry Tickets
    const inquiries = db.prepare(`
        SELECT t.id, t.product_id, t.serial_number, p.model_name, p.product_family, p.product_line 
        FROM inquiry_tickets t
        LEFT JOIN products p ON t.product_id = p.id
    `).all();

    const updateInq = db.prepare('UPDATE inquiry_tickets SET product_family = ? WHERE id = ?');
    for (const row of inquiries) {
        if (row.product_id) {
            const family = determineFamily(row);
            updateInq.run(family, row.id);
            updateStats.inquiry_tickets++;
        }
    }

    // B. Update RMA Tickets
    const rmas = db.prepare(`
        SELECT t.id, t.product_id, t.serial_number, p.model_name, p.product_family, p.product_line 
        FROM rma_tickets t
        LEFT JOIN products p ON t.product_id = p.id
    `).all();

    const updateRma = db.prepare('UPDATE rma_tickets SET product_family = ? WHERE id = ?');
    for (const row of rmas) {
        if (row.product_id) {
            const family = determineFamily(row);
            updateRma.run(family, row.id);
            updateStats.rma_tickets++;
        }
    }

    // C. Update Dealer Repairs
    // note: dealer_repairs might not have product_id in seed script, checking seed...
    // Seed script uses product_id.
    const repairs = db.prepare(`
        SELECT t.id, t.product_id, t.serial_number, p.model_name, p.product_family, p.product_line 
        FROM dealer_repairs t
        LEFT JOIN products p ON t.product_id = p.id
    `).all();

    const updateRepair = db.prepare('UPDATE dealer_repairs SET product_family = ? WHERE id = ?');
    for (const row of repairs) {
        if (row.product_id) {
            const family = determineFamily(row);
            updateRepair.run(family, row.id);
            updateStats.dealer_repairs++;
        }
    }

    // D. Also update Products table families to match readable names?
    // User asked "Database now have these 4 product families?"
    // Let's update products table too for consistency
    const allProducts = db.prepare('SELECT * FROM products').all();
    const updateProd = db.prepare('UPDATE products SET product_family = ? WHERE id = ?');
    for (const p of allProducts) {
        const newFamily = determineFamily(p);
        if (newFamily !== p.product_family) { // Only update if changing from code to name or different
            updateProd.run(newFamily, p.id);
        }
    }

})();

console.log('Migration completed.');
console.log('Updated rows:', updateStats);
