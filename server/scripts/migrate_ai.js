const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../longhorn.db');
const db = new Database(DB_PATH);

console.log('[Migration] Creating ai_usage_logs table...');
db.exec(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT,
        task_type TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);
console.log('[Migration] Done.');
