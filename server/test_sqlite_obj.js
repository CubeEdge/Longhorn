const Database = require('better-sqlite3');
const db = new Database(':memory:');

db.exec('CREATE TABLE test (id INTEGER, data TEXT)');
db.exec("INSERT INTO test (id, data) VALUES (1, 'old')");

try {
    const id = 1;
    const data = { foo: 'bar' };
    const stmt = db.prepare('UPDATE test SET data = ? WHERE id = ?');
    console.log('Parameters expected:', stmt.length);
    stmt.run(data, id);
    console.log('Success (unexpected)');
} catch (err) {
    console.log('Caught expected error:', err.message);
}
