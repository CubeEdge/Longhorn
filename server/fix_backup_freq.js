const Database = require("better-sqlite3");
const db = new Database("longhorn.db");

// Update to correct default values
const result = db.prepare(`
    UPDATE system_settings 
    SET backup_frequency = 180,
        secondary_backup_frequency = 1440
    WHERE id = 1
`).run();

console.log('Updated rows:', result.changes);

// Verify
const row = db.prepare("SELECT backup_frequency, secondary_backup_frequency FROM system_settings WHERE id = 1").get();
console.log('New settings:', JSON.stringify(row));

db.close();
