const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'server/data/longhorn.db');
const db = new Database(dbPath);

const users = db.prepare('SELECT id, username, role, user_type FROM users LIMIT 5').all();
console.log(users);
