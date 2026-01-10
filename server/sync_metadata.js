const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 1. Setup DB
const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log(`Starting MASTER SYNC v6 (Nuclear Mode)...`);
console.log(`DB Path: ${dbPath}`);

// 2. NUCLEAR FIX: Direct Database Repair (Surgical Strike)
// This fixes records that are ALREADY in the DB but have uploader_id NULL/1
console.log('\n[Phase 1] NUCLEAR REPAIR: Fixing existing records in DB...');

const repairLogic = [
    { pattern: '%运营部%', id: 37, name: 'Orange (OP)' },
    { pattern: '%(OP)%', id: 37, name: 'Orange (OP)' },
    { pattern: '%Members/Orange%', id: 37, name: 'Orange (Members)' },
    { pattern: '%市场部%', id: 11, name: 'Pepper (MS)' },
    { pattern: '%(MS)%', id: 11, name: 'Pepper (MS)' },
    { pattern: '%Members/Pepper%', id: 11, name: 'Pepper (Members)' },
    { pattern: '%Members/admin%', id: 1, name: 'admin' }
];

db.transaction(() => {
    repairLogic.forEach(task => {
        const info = db.prepare(`
            UPDATE file_stats 
            SET uploader_id = ? 
            WHERE path LIKE ? AND (uploader_id IS NULL OR uploader_id = 1)
        `).run(task.id, task.pattern);

        if (info.changes > 0) {
            console.log(`   ✅ Repaired ${info.changes} records for: ${task.name}`);
        }
    });
})();

// 3. Setup Disk Scanning
let DISK_A = process.env.DISK_A;
if (!DISK_A) {
    const possiblePaths = [
        path.join(__dirname, 'data/DiskA'),
        path.join(__dirname, '../data/DiskA'),
        path.join(process.cwd(), 'server/data/DiskA'),
        path.join(process.cwd(), 'data/DiskA')
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            DISK_A = p;
            break;
        }
    }
}

if (!DISK_A) {
    console.error('[Error] Could not find DiskA directory.');
    process.exit(1);
}

console.log(`\n[Phase 2] DISK SCAN: Syncing physical files...`);
console.log(`Disk Path: ${DISK_A}`);

function getUploaderId(relativePath) {
    const normalized = relativePath.normalize('NFC').replace(/\\/g, '/');
    if (normalized.includes('运营部') || normalized.includes('(OP)') || normalized.includes('Members/Orange')) return 37;
    if (normalized.includes('市场部') || normalized.includes('(MS)') || normalized.includes('Members/Pepper')) return 11;
    return 1;
}

function syncDir(currentPath, depth = 0) {
    let itemNames = [];
    try {
        itemNames = fs.readdirSync(currentPath);
    } catch (e) { return 0; }

    if (depth < 4) {
        console.log(`${"  ".repeat(depth)}📂 ${path.basename(currentPath) || 'root'} (${itemNames.length} items)`);
    }

    let count = 0;
    const upsertStmt = db.prepare(`
        INSERT INTO file_stats (path, uploader_id, uploaded_at, access_count)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(path) DO UPDATE SET
            uploader_id = CASE 
                WHEN uploader_id IS NULL OR uploader_id = 1 THEN excluded.uploader_id
                ELSE uploader_id
            END
    `);

    for (const itemName of itemNames) {
        if (itemName.startsWith('.') || itemName === 'node_modules' || itemName === '.chunks') continue;
        const fullPath = path.join(currentPath, itemName);
        let stats;
        try { stats = fs.statSync(fullPath); } catch (e) { continue; }

        const relativePath = path.relative(DISK_A, fullPath).normalize('NFC').replace(/\\/g, '/');
        const uploaderId = getUploaderId(relativePath);
        const uploadDate = stats.mtime.toISOString().slice(0, 19).replace('T', ' ');

        upsertStmt.run(relativePath, uploaderId, uploadDate);
        count++;

        if (stats.isDirectory()) {
            count += syncDir(fullPath, depth + 1);
        }
    }
    return count;
}

db.transaction(() => {
    const totalSynced = syncDir(DISK_A);
    console.log(`\n🎉 MASTER SYNC v6 COMPLETE!`);
    console.log(`Total files processed from disk: ${totalSynced}`);
})();

const remainingUnknown = db.prepare("SELECT COUNT(*) as count FROM file_stats WHERE uploader_id IS NULL").get().count;
console.log(`Final Database Stats:`);
console.log(`   - Records with NULL uploader: ${remainingUnknown}`);
db.close();
