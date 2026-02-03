const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../longhorn.db');
const db = new Database(dbPath, { verbose: console.log });

console.log('Running migration: fix_product_family_names...');

// Mapping requirements:
// A: Current Cine Cameras (MAVO Edge 8K, MAVO Edge 6K, MAVO mark2 LF)
// B: Archived Cine Cameras (MAVO LF, TERRA 4K)
// C: Eagle e-Viewfinder (Eagle SDI, Eagle HDMI)
// D: Universal Accessories (MC Board, KineBAT)

function getCorrectFamily(modelName) {
    if (!modelName) return 'Other';
    const upper = modelName.toUpperCase();

    // Group A: Current
    if (upper.includes('EDGE') || upper.includes('MARK2')) return 'Current Cine Cameras';

    // Group B: Archived
    if (upper.includes('MAVO LF') || upper.includes('TERRA')) return 'Archived Cine Cameras';

    // Group C: Eagle
    if (upper.includes('EAGLE') || upper.includes('EVF')) return 'Eagle e-Viewfinder';

    // Group D: Accessories
    if (upper.includes('BAT') || upper.includes('BOARD') || upper.includes('HANDLE') || upper.includes('MOUNT')) return 'Universal Accessories';

    // Fallback/Catch-all (e.g. just MAVO might be archived or current depending on specific model, assuming Archived if generic MAVO without Edge/Mark2?)
    // Actually MAVO LF is archived. MAVO Edge is Current.
    if (upper === 'MAVO') return 'Archived Cine Cameras';

    return 'Other';
}

const tables = ['inquiry_tickets', 'rma_tickets', 'dealer_repairs', 'products'];
const updateStats = {};

db.transaction(() => {
    tables.forEach(table => {
        updateStats[table] = 0;
        let rows;
        if (table === 'products') {
            rows = db.prepare('SELECT id, model_name FROM products').all();
        } else {
            // Join with products to get model name
            rows = db.prepare(`
                SELECT t.id, p.model_name 
                FROM ${table} t
                LEFT JOIN products p ON t.product_id = p.id
            `).all();
        }

        const stmt = db.prepare(`UPDATE ${table} SET product_family = ? WHERE id = ?`);

        for (const row of rows) {
            if (row.model_name) {
                const newFamily = getCorrectFamily(row.model_name);
                stmt.run(newFamily, row.id);
                updateStats[table]++;
            }
        }
    });
})();

console.log('Migration completed.');
console.log('Updated rows:', updateStats);
