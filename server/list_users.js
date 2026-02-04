const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

try {
    const users = db.prepare('SELECT * FROM users LIMIT 5').all();
    console.log(JSON.stringify(users, null, 2));
} catch (e) {
    console.error('Error querying users:', e.message);
}
