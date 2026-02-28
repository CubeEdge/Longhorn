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

    // Get all migration files (both .sql and .js)
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
        .sort();

    for (const file of files) {
        const applied = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file);

        if (!applied) {
            console.log(`[Service] Running migration: ${file}`);
            const filePath = path.join(migrationsDir, file);

            if (file.endsWith('.sql')) {
                // Handle SQL migrations
                const sql = fs.readFileSync(filePath, 'utf8');
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
            } else if (file.endsWith('.js')) {
                // Handle JavaScript migrations (data migrations)
                try {
                    const migration = require(filePath);
                    if (typeof migration.migrateData === 'function') {
                        migration.migrateData();
                    } else {
                        console.log(`[Service] JS migration ${file} has no migrateData function, skipping execution`);
                    }
                } catch (err) {
                    console.error(`[Service] JS Migration error in ${file}:`, err.message);
                    throw err; // Re-throw to stop migration process
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
