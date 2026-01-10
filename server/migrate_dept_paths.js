const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');

const dbPath = path.join(__dirname, 'longhorn.db');
const DISK_A = process.env.DISK_A || path.join(__dirname, 'data/DiskA');

console.log('Starting Department Path Migration...');
console.log(`DB Path: ${path.resolve(dbPath)}`);
console.log(`Disk Path: ${DISK_A}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Migration mapping: old Chinese paths -> new English paths
const MIGRATION_MAP = [
    { old: '运营部 (OP)', new: 'OP' },
    { old: '市场部 (MS)', new: 'MS' },
    { old: '研发部 (RD)', new: 'RD' },
    { old: '研发中心 (RD)', new: 'RD' },
    { old: '综合管理 (GE)', new: 'GE' },
    { old: '通用台面 (RE)', new: 'GE' }
];

// Step 1: Migrate database paths
console.log('\n[Step 1] Migrating database paths...');
db.transaction(() => {
    MIGRATION_MAP.forEach(m => {
        const oldPrefix = m.old + '/';
        const newPrefix = m.new + '/';

        // Update paths with prefix
        let info = db.prepare(`UPDATE file_stats SET path = REPLACE(path, ?, ?) WHERE path LIKE ?`).run(oldPrefix, newPrefix, oldPrefix + '%');
        if (info.changes > 0) console.log(`   ✅ Migrated ${info.changes} paths: "${m.old}/..." -> "${m.new}/..."`);

        // Update root folder itself
        info = db.prepare(`UPDATE file_stats SET path = ? WHERE path = ?`).run(m.new, m.old);
        if (info.changes > 0) console.log(`   ✅ Migrated root folder: "${m.old}" -> "${m.new}"`);
    });
})();

// Step 2: Rename physical folders
console.log('\n[Step 2] Renaming physical folders...');
MIGRATION_MAP.forEach(m => {
    const oldPath = path.join(DISK_A, m.old);
    const newPath = path.join(DISK_A, m.new);

    if (fs.existsSync(oldPath)) {
        if (fs.existsSync(newPath)) {
            // Merge: Move contents of old folder into new folder
            console.log(`   ⚠️ Both "${m.old}" and "${m.new}" exist. Merging...`);
            const items = fs.readdirSync(oldPath);
            items.forEach(item => {
                const src = path.join(oldPath, item);
                const dest = path.join(newPath, item);
                if (!fs.existsSync(dest)) {
                    fs.moveSync(src, dest);
                }
            });
            fs.removeSync(oldPath);
            console.log(`   ✅ Merged and removed: "${m.old}"`);
        } else {
            fs.renameSync(oldPath, newPath);
            console.log(`   ✅ Renamed: "${m.old}" -> "${m.new}"`);
        }
    }
});

// Ensure new folders exist
['OP', 'MS', 'RD', 'GE', 'Members'].forEach(code => {
    fs.ensureDirSync(path.join(DISK_A, code));
});

console.log('\n🎉 Migration Complete!');

// Show sample paths
const samples = db.prepare('SELECT path FROM file_stats LIMIT 10').all();
console.log('\nSample paths after migration:');
samples.forEach(s => console.log(`   - ${s.path}`));

db.close();
