const Database = require("better-sqlite3");
const db = new Database("longhorn.db");

console.log('=== Departments ===');
const depts = db.prepare("SELECT * FROM departments").all();
console.log(depts);

console.log('\n=== Admin User ===');
const admin = db.prepare("SELECT id, username, role, department_id, department_name FROM users WHERE username = 'admin'").get();
console.log(admin);

console.log('\n=== Folders (first 10) ===');
const folders = db.prepare("SELECT * FROM folders LIMIT 10").all();
console.log(folders);

db.close();
