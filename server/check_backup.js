const Database = require("better-sqlite3");
const db = new Database("longhorn.db", { readonly: true });
const row = db.prepare("SELECT backup_frequency, backup_retention_days, secondary_backup_frequency, secondary_backup_retention_days FROM system_settings LIMIT 1").get();
console.log(JSON.stringify(row, null, 2));
db.close();
