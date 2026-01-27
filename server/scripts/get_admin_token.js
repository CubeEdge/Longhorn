
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: dotenvPath, quiet: true }); // Silence logs

const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const dbPath = path.resolve(__dirname, '../longhorn.db');
const db = new Database(dbPath);

if (!process.env.JWT_SECRET) {
    console.error("Missing JWT_SECRET in " + dotenvPath);
    process.exit(1);
}

// Find an admin user
let admin = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();

if (!admin) {
    console.error("No admin user found! Creating temp admin...");
    try {
        db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run('temp_admin', 'temp_pass', 'admin');
        admin = db.prepare("SELECT * FROM users WHERE username = 'temp_admin'").get();
    } catch (e) {
        // If unique constraint fails, fetch it
        admin = db.prepare("SELECT * FROM users WHERE username = 'temp_admin'").get();
    }
}

if (admin) {
    const token = jwt.sign({ id: admin.id, role: admin.role, username: admin.username }, process.env.JWT_SECRET);
    console.log(token);
} else {
    console.error("Failed to get/create admin");
}
