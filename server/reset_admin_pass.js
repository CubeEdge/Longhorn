const bcrypt = require("bcryptjs");
const sqlite = require("better-sqlite3");
const db = new sqlite("longhorn.db");
const hash = bcrypt.hashSync("admin123", 10);
db.prepare("UPDATE users SET password = ? WHERE username = 'admin'").run(hash);
console.log("Admin password reset to admin123");
