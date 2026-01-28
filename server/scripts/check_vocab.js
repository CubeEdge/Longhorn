const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../longhorn.db');
const db = new Database(DB_PATH);

const stats = db.prepare(`
    SELECT language, level, COUNT(*) as count 
    FROM vocabulary 
    GROUP BY language, level
    ORDER BY language, level
`).all();

console.table(stats);
