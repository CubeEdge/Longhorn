const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log('Starting MASTER SYNC v10 (Forensic Repair)...');

// 1. Repair associations first (from v6 logic)
const repairLogic = [
    { pattern: '%运营部%', id: 37 }, { pattern: '%(OP)%', id: 37 },
    { pattern: '%市场部%', id: 11 }, { pattern: '%(MS)%', id: 11 }
];

db.transaction(() => {
    repairLogic.forEach(task => {
        db.prepare('UPDATE file_stats SET uploader_id = ? WHERE path LIKE ? AND (uploader_id IS NULL OR uploader_id = 1)').run(task.id, task.pattern);
    });
})();

// 2. Aggressive Disk Sync with per-file logging
const DISK_A = process.env.DISK_A || path.join(__dirname, 'data/DiskA');

function getUploaderId(relativePath) {
    const normalized = relativePath.normalize('NFC').replace(/\\/g, '/');
    if (normalized.includes('运营部') || normalized.includes('(OP)') || normalized.includes('Members/Orange')) return 37;
    if (normalized.includes('市场部') || normalized.includes('(MS)') || normalized.includes('Members/Pepper')) return 11;
    return 1;
}

const upsertStmt = db.prepare(`
    INSERT INTO file_stats (path, uploader_id, uploaded_at, access_count)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(path) DO UPDATE SET
        uploader_id = CASE 
            WHEN uploader_id IS NULL OR uploader_id = 1 THEN excluded.uploader_id
            ELSE uploader_id
        END
`);

function syncDir(currentPath) {
    let itemNames = fs.readdirSync(currentPath);
    let count = 0;

    for (const itemName of itemNames) {
        if (itemName.startsWith('.') || itemName === 'node_modules' || itemName === '.chunks') continue;
        const fullPath = path.join(currentPath, itemName);
        const stats = fs.statSync(fullPath);
        const relativePath = path.relative(DISK_A, fullPath).normalize('NFC').replace(/\\/g, '/').replace(/^\//, '');
        const uploaderId = getUploaderId(relativePath);
        const uploadDate = stats.mtime.toISOString().slice(0, 19).replace('T', ' ');

        try {
            const info = upsertStmt.run(relativePath, uploaderId, uploadDate);
            if (info.changes > 0) {
                console.log(`   [Saved] "${relativePath}" (UID:${uploaderId})`);
                count++;
            }
        } catch (e) {
            console.error(`   [Fail] "${relativePath}": ${e.message}`);
        }

        if (stats.isDirectory()) {
            count += syncDir(fullPath);
        }
    }
    return count;
}

const total = syncDir(DISK_A);
console.log(`\nDONE. Total items updated/inserted: ${total}`);
db.close();
