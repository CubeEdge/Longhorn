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

console.log(`Starting MASTER SYNC v4 (Aggressive Mode)...`);
console.log(`Disk Path: ${DISK_A}`);
console.log(`DB Path: ${dbPath}`);

// 2. Dynamically fetch department users
const users = db.prepare(`
    SELECT u.id, u.username, d.name as dept_name 
    FROM users u 
    LEFT JOIN departments d ON u.department_id = d.id
`).all();

console.log('Detected User/Dept mapping:');
users.forEach(u => console.log(`   - [${u.id}] ${u.username} (${u.dept_name || 'No Dept'})`));

const folderMap = {};
users.forEach(u => {
    if (u.dept_name) folderMap[u.dept_name.trim()] = u.id;
    folderMap[`Members/${u.username}`.trim()] = u.id;
    folderMap[`Members/${u.username.toLowerCase()}`.trim()] = u.id;
});

function getUploaderId(relativePath) {
    const normalized = relativePath.normalize('NFC').trim();
    for (const [folder, id] of Object.entries(folderMap)) {
        if (normalized === folder || normalized.startsWith(folder + '/')) {
            return id;
        }
    }
    return 1; // Default to admin
}

// 3. Fix all existing paths in DB to NFC
console.log('Cleaning up database path encoding...');
const allStats = db.prepare('SELECT path, uploader_id FROM file_stats').all();
const updatePathStmt = db.prepare('UPDATE file_stats SET path = ? WHERE path = ?');
let normalizedCount = 0;

db.transaction(() => {
    for (const row of allStats) {
        const nfcPath = row.path.normalize('NFC');
        if (nfcPath !== row.path) {
            try {
                updatePathStmt.run(nfcPath, row.path);
                normalizedCount++;
            } catch (e) {
                db.prepare('DELETE FROM file_stats WHERE path = ?').run(row.path);
            }
        }
    }
})();
console.log(`Success: Normalized ${normalizedCount} paths in database.`);

// 4. Recursive Sync (Aggressive Traversal)
function syncDir(currentPath, depth = 0) {
    let itemNames = [];
    try {
        itemNames = fs.readdirSync(currentPath);
    } catch (e) {
        console.error(`[Warning] Cannot read directory: ${currentPath} (${e.message})`);
        return 0;
    }

    if (depth < 3) {
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
        try {
            stats = fs.statSync(fullPath);
        } catch (e) {
            continue; // Skip items we can't stat
        }

        const relativePath = path.relative(DISK_A, fullPath).normalize('NFC').replace(/\\/g, '/');
        const uploaderId = getUploaderId(relativePath);
        const uploadDate = stats.mtime.toISOString().slice(0, 19).replace('T', ' ');

        try {
            upsertStmt.run(relativePath, uploaderId, uploadDate);
            count++;
        } catch (e) {
            console.error(`[Error] Failed to upsert ${relativePath}: ${e.message}`);
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

    console.log(`\nMASTER SYNC v4 Aggressive COMPLETE!`);
    console.log(`Total files and folders processed: ${totalSynced}`);

    const remainingUnknown = db.prepare("SELECT COUNT(*) as count FROM file_stats WHERE uploader_id IS NULL").get().count;
    if (remainingUnknown > 0) {
        console.log(`[Warning] ${remainingUnknown} records still have unknown uploader in DB.`);
    }

} catch (err) {
    console.error('Sync Error:', err);
} finally {
    db.close();
}
