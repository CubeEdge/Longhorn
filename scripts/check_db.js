const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../server/longhorn.db');
console.log('DB Path:', dbPath);

try {
    const db = new Database(dbPath, { fileMustExist: true });

    console.log('\n--- Departments ---');
    const depts = db.prepare('SELECT * FROM departments').all();
    console.log(JSON.stringify(depts, null, 2));

    console.log('\n--- Admin User ---');
    const admin = db.prepare("SELECT id, username, role, department_id FROM users WHERE username='admin'").get();
    console.log(JSON.stringify(admin, null, 2));

} catch (err) {
    console.error('Error opening DB:', err);
}
