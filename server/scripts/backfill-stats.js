const Database = require('better-sqlite3');
const fs = require('fs-extra');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/longhorn.db');
const DISK_A = path.join(__dirname, '../data/DiskA');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS file_stats (
    path TEXT PRIMARY KEY,
    uploader_id INTEGER,
    access_count INTEGER DEFAULT 0,
    last_access DATETIME,
    size INTEGER DEFAULT 0,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(uploader_id) REFERENCES users(id)
  );
`);

async function backfill() {
    console.log('🚀 Starting KineSphere backfill for file_stats...');
    const items = db.prepare('SELECT path FROM file_stats').all();
    console.log(`Found ${items.length} records in metadata to process.`);

    // If metadata is empty, we could scan Disk A, but for now we backfill only what is known to the DB.
    for (const item of items) {
        const fullPath = path.join(DISK_A, item.path);
        try {
            if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                if (stats.isFile()) {
                    db.prepare('UPDATE file_stats SET size = ?, upload_date = ? WHERE path = ?')
                        .run(stats.size, stats.mtime.toISOString(), item.path);
                }
            }
        } catch (e) {
            console.error(`❌ Failed to process ${item.path}:`, e.message);
        }
    }
    console.log('✅ Backfill completed.');
}

backfill();
