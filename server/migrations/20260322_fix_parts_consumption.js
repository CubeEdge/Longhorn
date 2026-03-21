/**
 * 20260322_fix_parts_consumption.js
 * 为 parts_consumption 表添加软删除字段，修复 rma-documents.js 中的 SQL 错误。
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../longhorn.db');
console.log(`[Migration] Connecting to database at: ${dbPath}`);

const db = new Database(dbPath);

try {
    const migration = db.transaction(() => {
        const columns = db.prepare("PRAGMA table_info(parts_consumption)").all();
        const existingColumns = columns.map(c => c.name);

        if (!existingColumns.includes('is_deleted')) {
            console.log('Adding column: is_deleted');
            db.prepare('ALTER TABLE parts_consumption ADD COLUMN is_deleted BOOLEAN DEFAULT 0').run();
        }
        if (!existingColumns.includes('deleted_at')) {
            console.log('Adding column: deleted_at');
            db.prepare('ALTER TABLE parts_consumption ADD COLUMN deleted_at DATETIME').run();
        }
        if (!existingColumns.includes('deleted_by')) {
            console.log('Adding column: deleted_by');
            db.prepare('ALTER TABLE parts_consumption ADD COLUMN deleted_by INTEGER REFERENCES users(id)').run();
        }

        console.log('✅ Columns added for parts_consumption.');
    });

    migration();
    console.log('🎉 parts_consumption table fixed.');

} catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
} finally {
    db.close();
}
