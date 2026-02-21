const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database('./longhorn.db');
const DISK_A = '/Volumes/fileserver/Files';

function walk(dir, base) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        if (item.name.startsWith('.')) continue;
        const fullPath = path.join(dir, item.name);
        const relPath = path.join(base, item.name).replace(/\\/g, '/');
        
        if (item.isDirectory()) {
            walk(fullPath, relPath);
        } else {
            const stat = fs.statSync(fullPath);
            try {
                db.prepare('INSERT OR IGNORE INTO file_stats(path, size, uploaded_at) VALUES (?, ?, ?)')
                  .run(relPath, stat.size, new Date(stat.mtime).toISOString());
                console.log('Synced:', relPath);
            } catch (e) {
                console.error('Error syncing', relPath, e.message);
            }
        }
    }
}

// Sync all department folders
const depts = ['MS', 'OP', 'RD', 'RE'];
for (const dept of depts) {
    const deptPath = path.join(DISK_A, dept);
    if (fs.existsSync(deptPath)) {
        console.log('Syncing department:', dept);
        walk(deptPath, dept);
    }
}

// Sync Members folder
const membersPath = path.join(DISK_A, 'MEMBERS');
if (fs.existsSync(membersPath)) {
    console.log('Syncing Members...');
    walk(membersPath, 'MEMBERS');
}

console.log('File stats sync complete!');
db.close();
