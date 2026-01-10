const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use current working directory or env
const DISK_A = process.env.DISK_A || path.join(__dirname, 'data/DiskA');
const db = new Database(path.join(__dirname, 'longhorn.db'));

console.log(`🚀 Starting Full Disk Metadata Sync...`);
console.log(`📂 Disk Path: ${DISK_A}`);

// Mapping from folder name to User ID
const folderMap = {
    '运营部 (OP)': 37,
    '市场部 (MS)': 11,
    'Members/Orange': 37,
    'Members/orange': 37,
    'Members/Pepper': 11,
    'Members/pepper': 11,
    'Members/admin': 1
};

function getUploaderId(relativePath) {
    const normalized = relativePath.normalize('NFC');

    // Check direct mappings
    for (const [folder, id] of Object.entries(folderMap)) {
        if (normalized.startsWith(folder + '/') || normalized === folder) {
            return id;
        }
    }

    // Default to admin
    return 1;
}

function syncDir(currentPath) {
    const items = fs.readdirSync(currentPath, { withFileTypes: true });
    let count = 0;

    const upsertStmt = db.prepare(`
        INSERT INTO file_stats (path, uploader_id, uploaded_at, access_count)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(path) DO UPDATE SET
            uploader_id = IFNULL(uploader_id, excluded.uploader_id)
    `);

    for (const item of items) {
        // Skip hidden files and temporary chunks
        if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '.chunks') continue;

        const fullPath = path.join(currentPath, item.name);
        // Normalize path to NFC for database consistency
        const relativePath = path.relative(DISK_A, fullPath).normalize('NFC').replace(/\\/g, '/');

        const uploaderId = getUploaderId(relativePath);
        const stats = fs.statSync(fullPath);
        const uploadDate = stats.birthtime.toISOString().slice(0, 19).replace('T', ' ');

        // Sync current item (file or folder)
        upsertStmt.run(relativePath, uploaderId, uploadDate);
        count++;

        if (item.isDirectory()) {
            count += syncDir(fullPath);
        }
    }
    return count;
}

try {
    db.pragma('journal_mode = WAL');
    const totalSynced = db.transaction(() => {
        return syncDir(DISK_A);
    })();

    console.log(`\n🎉 Sync Complete!`);
    console.log(`✅ Total files and folders synced: ${totalSynced}`);
} catch (err) {
    console.error('❌ Sync Error:', err);
} finally {
    db.close();
}
