const Database = require('better-sqlite3');
const fs = require('fs-extra');
const path = require('path');

const DISK_A = path.join(__dirname, 'data/DiskA');
const db = new Database(path.join(__dirname, 'longhorn.db'));

console.log('🔧 Updating file sizes in database...\n');

// Get all files from file_stats
const files = db.prepare('SELECT path, size FROM file_stats').all();

let updated = 0;
let notFound = 0;
let errors = 0;

files.forEach(fileRecord => {
    try {
        const fullPath = path.join(DISK_A, fileRecord.path);

        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            const actualSize = fs.statSync(fullPath).size;

            // Update if size is different
            if (fileRecord.size !== actualSize) {
                db.prepare('UPDATE file_stats SET size = ? WHERE path = ?').run(actualSize, fileRecord.path);
                updated++;
                if (updated <= 10) {
                    console.log(`✅ Updated: ${fileRecord.path} (${actualSize} bytes)`);
                }
            }
        } else {
            notFound++;
            if (notFound <= 5) {
                console.log(`⚠️  Not found: ${fileRecord.path}`);
            }
        }
    } catch (err) {
        errors++;
        console.error(`❌ Error processing ${fileRecord.path}:`, err.message);
    }
});

console.log(`\n📊 Summary:`);
console.log(`   Updated: ${updated} files`);
console.log(`   Not found: ${notFound} files`);
console.log(`   Errors: ${errors} files`);
console.log(`\n✨ Done!`);

db.close();
