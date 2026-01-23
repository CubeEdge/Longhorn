const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

try {
    console.log('--- Fixing Missing Uploader IDs ---');

    // 1. Check count of nulls
    const checkStmt = db.prepare("SELECT COUNT(*) as count FROM file_stats WHERE uploader_id IS NULL");
    const before = checkStmt.get();
    console.log(`Found ${before.count} records with NULL uploader_id.`);

    if (before.count > 0) {
        // 2. Update to admin (ID 1)
        const updateStmt = db.prepare("UPDATE file_stats SET uploader_id = 1 WHERE uploader_id IS NULL");
        const result = updateStmt.run();
        console.log(`Updated ${result.changes} records. All assigned to Admin (ID=1).`);
    } else {
        console.log('No records needed fixing.');
    }

    // 3. Verify
    const after = checkStmt.get();
    console.log(`Remaining NULL records: ${after.count}`);

} catch (err) {
    console.error('Error:', err);
}
