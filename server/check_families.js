const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

try {
    const families = db.prepare('SELECT DISTINCT product_family FROM products').all();
    console.log('Distinct Product Families:', JSON.stringify(families, null, 2));

    // Also check a few rows to see the association
    const examples = db.prepare('SELECT model_name, product_family FROM products LIMIT 10').all();
    console.log('Examples:', JSON.stringify(examples, null, 2));
} catch (e) {
    console.error('Error querying products:', e.message);
}
