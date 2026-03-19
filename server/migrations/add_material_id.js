const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../longhorn.db');
const db = new Database(dbPath);

try {
    const columns = db.prepare("PRAGMA table_info(parts_master)").all();
    const existingColumns = columns.map(c => c.name);

    if (!existingColumns.includes('material_id')) {
        db.prepare('ALTER TABLE parts_master ADD COLUMN material_id TEXT').run();
        console.log('✅ Added `material_id` column to parts_master.');
    } else {
        console.log('ℹ️ `material_id` already exists.');
    }
} catch (err) {
    console.error('Migration failed:', err);
} finally {
    db.close();
}
