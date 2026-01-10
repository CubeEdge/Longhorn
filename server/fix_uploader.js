const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'longhorn.db'));

console.log('🚀 Starting uploader metadata repair on server...');

// Mapping based on actual production users and folders
const users = [
    { id: 37, username: 'Orange', patterns: ['Members/Orange/', 'Members/orange/'] },
    { id: 11, username: 'Pepper', patterns: ['Members/Pepper/', 'Members/pepper/'] },
    { id: 1, username: 'admin', patterns: ['Members/admin/'] }
];

try {
    const transaction = db.transaction(() => {
        let totalFixed = 0;

        // 1. Fix specific user folders
        for (const user of users) {
            for (const pattern of user.patterns) {
                const info = db.prepare('UPDATE file_stats SET uploader_id = ? WHERE path LIKE ? AND uploader_id IS NULL')
                    .run(user.id, `${pattern}%`);
                if (info.changes > 0) {
                    console.log(`✅ Assigned ${info.changes} files to ${user.username} (Pattern: ${pattern})`);
                    totalFixed += info.changes;
                }
            }
        }

        // 2. Fallback for all other Unknown files (set to admin)
        const fallbackInfo = db.prepare('UPDATE file_stats SET uploader_id = 1 WHERE uploader_id IS NULL')
            .run();
        if (fallbackInfo.changes > 0) {
            console.log(`✅ Assigned ${fallbackInfo.changes} remaining legacy files to admin`);
            totalFixed += fallbackInfo.changes;
        }

        return totalFixed;
    });

    const fixedCount = transaction();
    console.log(`🎉 Success! Total records updated on server: ${fixedCount}`);

} catch (err) {
    console.error('❌ Error during repair:', err);
} finally {
    db.close();
}
