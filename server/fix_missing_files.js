const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const dotenv = require('dotenv');

dotenv.config();

// Determine DISK_A (Copying logic from index.js)
let DISK_A = path.join(__dirname, 'data/DiskA');
if (process.platform === 'darwin' && fs.existsSync('/Volumes/fileserver')) {
    DISK_A = '/Volumes/fileserver';
} else if (process.env.DISK_A_PATH) {
    DISK_A = process.env.DISK_A_PATH;
}

console.log(`Using Storage Root: ${DISK_A}`);

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

const insertStmt = db.prepare(`
    INSERT INTO file_stats (path, uploader_id, uploaded_at, size, access_count)
    VALUES (?, 1, datetime('now'), ?, 0)
`);

let addedCount = 0;

function walk(dir, relativeRoot = '') {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        if (item.name.startsWith('.')) continue;

        const relPath = path.join(relativeRoot, item.name);
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
            // Recursively walk
            walk(fullPath, relPath);
        } else {
            // Check DB
            // Normalization: Check both exact and potential NFC/NFD issues, but simplified here
            const row = db.prepare("SELECT path FROM file_stats WHERE path = ?").get(relPath);
            if (!row) {
                // Insert
                try {
                    const stats = fs.statSync(fullPath);
                    insertStmt.run(relPath, stats.size);
                    process.stdout.write(`+ Added: ${relPath}\n`);
                    addedCount++;
                } catch (e) {
                    console.error(`Error adding ${relPath}:`, e.message);
                }
            }
        }
    }
}

try {
    console.log('--- Starting File Sync (Disk -> DB) ---');
    walk(DISK_A);
    console.log(`\nSync Complete. Added ${addedCount} missing files to DB (Assigned to Admin).`);
} catch (err) {
    console.error('Fatal Error:', err);
}
