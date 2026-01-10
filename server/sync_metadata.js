const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 1. Try to find the correct DISK_A path
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
    console.error('[Error] Could not find DiskA directory. Please set DISK_A environment variable.');
    process.exit(1);
}

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

console.log(`Starting MASTER SYNC v5 (Surgical Fix)...`);
console.log(`Disk Path: ${DISK_A}`);
console.log(`DB Path: ${dbPath}`);

// 2. DIAGNOSTIC: Sample existing paths in DB
console.log('\n[Diagnostic] Sampling existing database paths:');
const samples = db.prepare('SELECT path, uploader_id FROM file_stats LIMIT 5').all();
samples.forEach(s => {
    console.log(`   - [UID:${s.uploader_id}] "${s.path}" (Len: ${s.path.length})`);
});

// 3. User Mapping
const folderMap = {
    '运营部': 37,
    'OP': 37,
    'Orange': 37,
    '市场部': 11,
    'MS': 11,
    'Pepper': 11
};

function getUploaderId(relativePath) {
    const normalized = relativePath.normalize('NFC').replace(/\\/g, '/');

    // Aggressive substring matching
    if (normalized.includes('运营部') || normalized.includes('(OP)') || normalized.includes('Members/Orange')) return 37;
    if (normalized.includes('市场部') || normalized.includes('(MS)') || normalized.includes('Members/Pepper')) return 11;

    return 1; // Default to admin
}

// 4. Recursive Sync
function syncDir(currentPath, depth = 0) {
    let itemNames = [];
    try {
        itemNames = fs.readdirSync(currentPath);
    } catch (e) {
        console.error(`[Warning] Cannot read directory: ${currentPath} (${e.message})`);
        return 0;
    }

    // Verbose logging for top levels
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
        // Skip hidden files and temporary chunks
        if (itemName.startsWith('.') || itemName === 'node_modules' || itemName === '.chunks') continue;

        const fullPath = path.join(currentPath, itemName);
        let stats;
        try {
            stats = fs.statSync(fullPath);
        } catch (e) {
            continue;
        }

        const relativePath = path.relative(DISK_A, fullPath).normalize('NFC').replace(/\\/g, '/');
        const uploaderId = getUploaderId(relativePath);
        const uploadDate = stats.mtime.toISOString().slice(0, 19).replace('T', ' ');

        try {
            upsertStmt.run(relativePath, uploaderId, uploadDate);
            count++;

            // Log deep files under mapping folders for verification
            if (uploaderId !== 1 && depth > 2) {
                console.log(`${"  ".repeat(depth)}  📄 ${itemName} -> UID:${uploaderId}`);
            }
        } catch (e) {
            console.error(`[Error] Failed to upsert "${relativePath}": ${e.message}`);
        }

        if (stats.isDirectory()) {
            count += syncDir(fullPath, depth + 1);
        }
    }
    return count;
}

try {
    db.pragma('journal_mode = WAL');
    const totalSynced = db.transaction(() => {
        return syncDir(DISK_A);
    })();

    console.log(`\nMASTER SYNC v5 COMPLETE!`);
    console.log(`Total files and folders processed: ${totalSynced}`);

    const remainingUnknown = db.prepare("SELECT COUNT(*) as count FROM file_stats WHERE uploader_id IS NULL").get().count;
    console.log(`Final Database Stats:`);
    console.log(`   - Records with NULL uploader: ${remainingUnknown}`);

    const adminCount = db.prepare("SELECT COUNT(*) as count FROM file_stats WHERE uploader_id = 1").get().count;
    console.log(`   - Records with admin uploader: ${adminCount}`);

} catch (err) {
    console.error('Sync Error:', err);
} finally {
    db.close();
}
