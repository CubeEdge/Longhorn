const Database = require('better-sqlite3');
const db = new Database('./longhorn.db');
try {
    db.prepare('SELECT 1 WHERE 1 = ?').get(undefined);
    console.log('SUCCESS');
} catch (e) {
    console.log('ERROR:', e.message, 'CODE:', e.code);
}
