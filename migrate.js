const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'server', 'longhorn.db');

try {
    const db = new Database(dbPath);
    const runSql = (sql) => {
        try {
            console.log(`Running: ${sql}`);
            db.prepare(sql).run();
            console.log('  -> Success');
        } catch (err) {
            console.warn(`  -> FAILED: ${err.message}`);
        }
    };

    runSql('ALTER TABLE product_models RENAME COLUMN model_name TO name_zh');
    runSql('ALTER TABLE product_models RENAME COLUMN internal_name TO model_code');
    runSql('ALTER TABLE product_models RENAME COLUMN internal_prefix TO material_id_prefix');
    runSql('ALTER TABLE product_skus RENAME COLUMN erp_code TO material_id');

    console.log('Migration finished');
} catch (err) {
    console.error('Initializtion failed:', err.message);
}
