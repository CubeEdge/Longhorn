const Database = require('better-sqlite3');
const db = new Database('longhorn.db', { verbose: console.log });

try {
    const query = `
        SELECT u.id, u.username, u.role, u.department_id, d.name as department_name 
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = ? OR u.id = CAST(? AS REAL)
    `;

    console.log('Preparing statement...');
    const stmt = db.prepare(query);
    console.log('Statement prepared.');

    console.log('Executing with (1, 1)...');
    const user = stmt.get(1, 1);
    console.log('Result:', user);

} catch (e) {
    console.error('Caught Exception:');
    console.error(e);
    if (e.code) console.error('Error Code:', e.code);
}
