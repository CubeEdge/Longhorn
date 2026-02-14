const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'longhorn.db');
const db = new Database(DB_PATH);

console.log('[User Setup] Creating default users...');

// Check if admin exists
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'Admin');
    console.log('Admin user created: admin / admin123');
} else {
    console.log('Admin user already exists');
}

// Create some test users
const users = [
    { username: 'sherry', password: 'sherry123', role: 'Service' },
    { username: 'cathy', password: 'cathy123', role: 'Service' },
    { username: 'jihua', password: 'jihua123', role: 'Engineer' }
];

for (const u of users) {
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
    if (!exists) {
        const hash = bcrypt.hashSync(u.password, 10);
        db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(u.username, hash, u.role);
        console.log('User created:', u.username, '/', u.password);
    } else {
        console.log('User already exists:', u.username);
    }
}

db.close();
console.log('[User Setup] Done');
