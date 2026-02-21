const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.argv[2] || path.join(__dirname, '../server/longhorn.db');

try {
    const db = new Database(DB_PATH, { readonly: true });
    const row = db.prepare('SELECT * FROM system_settings LIMIT 1').get();
    console.log('Backup Settings:');
    console.log('  backup_enabled:', row.backup_enabled);
    console.log('  backup_frequency:', row.backup_frequency, '(minutes)');
    console.log('  backup_retention_days:', row.backup_retention_days);
    console.log('  secondary_backup_enabled:', row.secondary_backup_enabled);
    console.log('  secondary_backup_frequency:', row.secondary_backup_frequency, '(minutes)');
    console.log('  secondary_backup_retention_days:', row.secondary_backup_retention_days);
    db.close();
} catch (e) {
    console.error('Error:', e.message);
}
