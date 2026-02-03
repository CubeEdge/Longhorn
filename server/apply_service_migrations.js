const path = require('path');
const fs = require('fs-extra');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'longhorn.db');
const db = new Database(DB_PATH, { verbose: console.log });

console.log('[Service] Manual Migration Runner');

function runMigrations(db) {
    const migrationsDir = path.join(__dirname, 'service/migrations');

    if (!fs.existsSync(migrationsDir)) {
        console.log('[Service] No migrations directory found');
        return;
    }

    // Create migrations tracking table if not exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const applied = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file);

        if (!applied) {
            console.log(`[Service] Running migration: ${file}`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

            // Split by lines and group into statements (naive split by semicolon at end of line might fail on comments, but let's try the simple approach from index.js)
            // The index.js used split(';'). Let's match that.
            const statements = sql.split(';').filter(s => s.trim());

            for (const stmt of statements) {
                try {
                    db.exec(stmt);
                } catch (err) {
                    if (!err.message.includes('duplicate column name')) {
                        console.error(`[Service] Migration error in ${file}:`, err.message);
                    } else {
                        console.log(`[Service] Skipped duplicate column in ${file}`);
                    }
                }
            }

            db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
            console.log(`[Service] Migration applied: ${file}`);
        } else {
            console.log(`[Service] Skipping already applied: ${file}`);
        }
    }
}

runMigrations(db);
console.log('[Service] Migration process finished.');
