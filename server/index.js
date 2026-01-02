const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'longhorn.db');
const DISK_A = process.env.DISK_A || path.join(__dirname, 'data/DiskA');
const DISK_B = process.env.DISK_B || path.join(__dirname, 'data/DiskB');
const RECYCLE_DIR = path.join(__dirname, 'data/.recycle');
const JWT_SECRET = process.env.JWT_SECRET || 'longhorn-secret-key-2026';

// Ensure base directories exist (Department folders are handled by defaultDepts loop below)
fs.ensureDirSync(DISK_A);
fs.ensureDirSync(DISK_B);
fs.ensureDirSync(RECYCLE_DIR);

// Multer Configuration for Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetDir = req.query.path ? path.join(DISK_A, req.query.path) : DISK_A;
        fs.ensureDirSync(targetDir);
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const datePrefix = `${year}${month}${day}`;
        cb(null, `${datePrefix}_${file.originalname}`);
    }
});
const upload = multer({ storage });

// Database Setup
const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'Member', -- Admin, Lead, Member
    department_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(department_id) REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    path TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    folder_path TEXT,
    access_type TEXT DEFAULT 'Read', -- Full, Read
    expires_at DATETIME, -- NULL for permanent
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS file_stats (
    path TEXT PRIMARY KEY,
    uploader_id INTEGER,
    access_count INTEGER DEFAULT 0,
    last_access DATETIME,
    FOREIGN KEY(uploader_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT,
    user_id INTEGER,
    count INTEGER DEFAULT 0,
    last_access DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(path, user_id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS recycle_bin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    original_path TEXT,
    deleted_path TEXT,
    deletion_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    is_directory BOOLEAN,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration for existing tables
try { db.exec("ALTER TABLE users ADD COLUMN department_id INTEGER;"); } catch (e) { }
try { db.exec("UPDATE users SET role = 'Member' WHERE role = 'user';"); } catch (e) { }
try { db.exec("UPDATE users SET role = 'Admin' WHERE role = 'admin';"); } catch (e) { }
try { db.exec("ALTER TABLE permissions ADD COLUMN access_type TEXT DEFAULT 'Read';"); } catch (e) { }
try { db.exec("ALTER TABLE permissions ADD COLUMN expires_at DATETIME;"); } catch (e) { }
try { db.exec("ALTER TABLE permissions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;"); } catch (e) { }
try { db.exec("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;"); } catch (e) { }

// Add default admin if not exists
const adminPassword = bcrypt.hashSync('admin123', 10);
db.prepare('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', adminPassword, 'Admin');

// Pre-seed departments
const defaultDepts = [
    { name: '市场部 (MS)', code: 'MS' },
    { name: '运营部 (OP)', code: 'OP' },
    { name: '研发中心 (RD)', code: 'RD' },
    { name: '综合管理 (GE)', code: 'GE' }
];

defaultDepts.forEach(dept => {
    try {
        db.prepare('INSERT OR IGNORE INTO departments (name) VALUES (?)').run(dept.name);
        // Ensure Dept and Members folders exist
        const deptPath = path.join(DISK_A, dept.name);
        fs.ensureDirSync(deptPath);
        fs.ensureDirSync(path.join(deptPath, 'Members'));
    } catch (e) { }
});

const ensureUserFolders = (user) => {
    if (user.role === 'Admin' || !user.department_name) return;
    const personalPath = path.join(DISK_A, user.department_name, 'Members', user.username);
    fs.ensureDirSync(personalPath);
};

app.use(cors());
app.use(express.json());
app.use('/preview', express.static(DISK_A));

// Health Check Route (Moved down to avoid blocking UI)
app.get('/api/status', (req, res) => {
    res.json({ name: "Longhorn API", status: "Running", version: "1.0.0" });
});

// Middleware & Helpers
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Fetch full user info including department
        const user = db.prepare(`
            SELECT u.*, d.name as department_name 
            FROM users u 
            LEFT JOIN departments d ON u.department_id = d.id 
            WHERE u.id = ?
        `).get(decoded.id);

        if (!user) return res.status(401).json({ error: 'User no longer exists' });
        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const hasPermission = (user, folderPath, accessType = 'Read') => {
    if (user.role === 'Admin') return true;

    const normalizedPath = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const deptName = user.department_name;

    // 1. Check departmental logic
    if (deptName) {
        // Lead has full access to their department
        if (user.role === 'Lead' && (normalizedPath === deptName || normalizedPath.startsWith(deptName + '/'))) {
            return true;
        }
        // Member has read access to department
        if (user.role === 'Member' && (normalizedPath === deptName || normalizedPath.startsWith(deptName + '/'))) {
            // Check if it's their own member folder (Full access)
            const personalPath = `${deptName}/Members/${user.username}`;
            if (normalizedPath === personalPath || normalizedPath.startsWith(personalPath + '/')) {
                return true;
            }
            // Otherwise, only Read access for Member in department
            if (accessType === 'Read') return true;
        }
    }

    // 2. Check extended permissions table
    const permissions = db.prepare(`
        SELECT access_type, expires_at FROM permissions 
        WHERE user_id = ? AND (folder_path = ? OR ? LIKE folder_path || '/%')
    `).all(user.id, normalizedPath, normalizedPath);

    for (const p of permissions) {
        if (p.expires_at && new Date(p.expires_at) < new Date()) continue;
        if (p.access_type === 'Full') return true;
        if (p.access_type === 'Read' && accessType === 'Read') return true;
    }

    return false;
};

async function moveItemToRecycle(subPath, userId) {
    let fullPath = path.join(DISK_A, subPath);
    if (!fs.existsSync(fullPath)) {
        fullPath = path.join(DISK_B, subPath);
    }

    if (!fs.existsSync(fullPath)) {
        console.error(`[Recycle] File not found in DISK_A or DISK_B: ${subPath}`);
        return;
    }

    const stats = fs.statSync(fullPath);
    const isDirectory = stats.isDirectory();
    const fileName = path.basename(subPath);
    const deletedName = `${Date.now()}_${fileName}`;
    const deletedPath = path.join(RECYCLE_DIR, deletedName);

    // Ensure recycle dir exists
    await fs.ensureDir(RECYCLE_DIR);
    await fs.move(fullPath, deletedPath);

    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
    const deletedBy = user ? user.username : 'unknown';

    db.prepare(`
        INSERT INTO recycle_bin (name, original_path, deleted_path, user_id, is_directory)
        VALUES (?, ?, ?, ?, ?)
    `).run(fileName, subPath, deletedName, userId, isDirectory ? 1 : 0);

    // Clean up database records (stats and logs)
    db.prepare('DELETE FROM file_stats WHERE path = ? OR path LIKE ?').run(subPath, subPath + '/%');
    db.prepare('DELETE FROM access_logs WHERE path = ? OR path LIKE ?').run(subPath, subPath + '/%');
    console.log(`[Recycle] Item moved: ${subPath} by ${deletedBy}`);
}

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
    next();
};

// Auth Routes
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare(`
        SELECT u.*, d.name as department_name 
        FROM users u 
        LEFT JOIN departments d ON u.department_id = d.id 
        WHERE u.username = ?
    `).get(username);

    if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);

        const userInfo = {
            id: user.id,
            username: user.username,
            role: user.role,
            department_name: user.department_name
        };

        // Ensure personal member folder exists
        ensureUserFolders(userInfo);

        res.json({
            token,
            user: userInfo
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Upload Route
app.post('/api/upload', authenticate, upload.array('files'), (req, res) => {
    const subPath = req.query.path || '';

    if (!hasPermission(req.user, subPath, 'Full')) {
        return res.status(403).json({ error: 'No write permission for this folder' });
    }

    req.files.forEach(file => {
        const itemPath = path.join(subPath, file.filename);
        db.prepare('INSERT OR REPLACE INTO file_stats (path, uploader_id) VALUES (?, ?)').run(itemPath, req.user.id);
    });
    console.log(`Uploaded ${req.files.length} files to ${subPath} by user ${req.user.username}`);
    res.json({ success: true });
});

app.post('/api/admin/users', authenticate, isAdmin, (req, res) => {
    const { username, password, role, department_id } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    try {
        db.prepare('INSERT INTO users (username, password, role, department_id) VALUES (?, ?, ?, ?)').run(username, hash, role || 'Member', department_id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: 'User already exists' });
    }
});

app.get('/api/admin/users', authenticate, (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Lead') return res.status(403).json({ error: 'Forbidden' });

    let query = `
        SELECT u.id, u.username, u.role, u.department_id, u.created_at, d.name as department_name 
        FROM users u 
        LEFT JOIN departments d ON u.department_id = d.id
    `;
    let params = [];

    if (req.user.role === 'Lead') {
        query += " WHERE u.department_id = ?";
        params.push(req.user.department_id);
    }

    const users = db.prepare(query).all(...params);
    res.json(users);
});

app.put('/api/admin/users/:id', authenticate, (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Requires Admin role' });

    try {
        const { username, password, role, department_id } = req.body;
        const updates = [];
        const params = [];

        if (username) { updates.push("username = ?"); params.push(username); }
        if (role) { updates.push("role = ?"); params.push(role); }
        if (department_id !== undefined) { updates.push("department_id = ?"); params.push(department_id); }
        if (password) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            updates.push("password = ?");
            params.push(hashedPassword);
        }

        if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

        params.push(req.params.id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// User Permissions Management
app.get('/api/admin/users/:id/permissions', authenticate, (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Lead') return res.status(403).json({ error: 'Forbidden' });

    const targetUser = db.prepare('SELECT id, department_id FROM users WHERE id = ?').get(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Lead can only see permissions of their department members
    if (req.user.role === 'Lead' && targetUser.department_id !== req.user.department_id) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    const perms = db.prepare('SELECT * FROM permissions WHERE user_id = ?').all(req.params.id);
    res.json(perms);
});

app.post('/api/admin/users/:id/permissions', authenticate, (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Lead') return res.status(403).json({ error: 'Forbidden' });

    const { folder_path, access_type, expires_at } = req.body;
    const targetUser = db.prepare('SELECT id, department_id FROM users WHERE id = ?').get(req.params.id);

    if (req.user.role === 'Lead') {
        if (!targetUser || targetUser.department_id !== req.user.department_id) return res.status(403).json({ error: 'Permission denied' });
        // Lead can only grant access to their department folders
        if (!folder_path.startsWith(req.user.department_name)) {
            return res.status(403).json({ error: 'Can only grant access to department folders' });
        }
    }

    db.prepare(`
        INSERT INTO permissions (user_id, folder_path, access_type, expires_at)
        VALUES (?, ?, ?, ?)
    `).run(req.params.id, folder_path, access_type, expires_at || null);

    res.json({ success: true });
});

app.delete('/api/admin/permissions/:id', authenticate, (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Lead') return res.status(403).json({ error: 'Forbidden' });

    const perm = db.prepare('SELECT p.*, u.department_id FROM permissions p JOIN users u ON p.user_id = u.id WHERE p.id = ?').get(req.params.id);
    if (!perm) return res.status(404).json({ error: 'Permission not found' });
    if (req.user.role === 'Lead' && perm.department_id !== req.user.department_id) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    db.prepare('DELETE FROM permissions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// Department Routes
app.get('/api/admin/departments', authenticate, isAdmin, (req, res) => {
    res.json(db.prepare('SELECT * FROM departments').all());
});

app.post('/api/admin/departments', authenticate, isAdmin, (req, res) => {
    const { name } = req.body;
    try {
        db.prepare('INSERT INTO departments (name) VALUES (?)').run(name);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: 'Department already exists' });
    }
});

// Dynamic Permissions Management
app.post('/api/admin/permissions', authenticate, isAdmin, (req, res) => {
    const { user_id, folder_path, access_type, expiry_option } = req.body;
    let expiresAt = null;
    if (expiry_option === '7days') expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    if (expiry_option === '1month') expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    db.prepare(`
        INSERT INTO permissions (user_id, folder_path, access_type, expires_at)
        VALUES (?, ?, ?, ?)
    `).run(user_id, folder_path, access_type, expiresAt);
    res.json({ success: true });
});

app.get('/api/files/recent', authenticate, async (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT s.path, s.access_count, u.username as uploader, 
                   (SELECT last_access FROM access_logs WHERE path = s.path ORDER BY last_access DESC LIMIT 1) as last_time
            FROM file_stats s
            LEFT JOIN users u ON s.uploader_id = u.id
            ORDER BY last_time DESC NULLS LAST
            LIMIT 50
        `).all();

        const result = [];
        for (const row of rows) {
            const fullPath = path.join(DISK_A, row.path);
            if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                result.push({
                    name: path.basename(row.path),
                    isDirectory: stats.isDirectory(),
                    path: row.path,
                    size: stats.size,
                    mtime: stats.mtime,
                    accessCount: row.access_count,
                    uploader: row.uploader
                });
            }
        }
        res.json({ items: result, userCanWrite: false }); // Recent is usually read-only list
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/files/starred', authenticate, (req, res) => {
    res.json({ items: [], userCanWrite: false }); // Future feature
});

// File Routes
app.get('/api/files', authenticate, async (req, res) => {
    const subPath = req.query.path || '';
    const fullPath = path.join(DISK_A, subPath);

    // Check Read permissions for the subPath
    if (!hasPermission(req.user, subPath, 'Read')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const canWrite = hasPermission(req.user, subPath, 'Full');
        const items = await fs.readdir(fullPath, { withFileTypes: true });
        const result = items.map(item => {
            const itemPath = path.join(subPath, item.name);
            const stats = fs.statSync(path.join(fullPath, item.name));
            const dbStats = db.prepare(`
                SELECT s.access_count, u.username as uploader 
                FROM file_stats s 
                LEFT JOIN users u ON s.uploader_id = u.id 
                WHERE s.path = ?
            `).get(itemPath);

            return {
                name: item.name,
                isDirectory: item.isDirectory(),
                path: itemPath,
                size: item.isDirectory() ? 0 : stats.size,
                mtime: stats.mtime,
                accessCount: dbStats ? dbStats.access_count : 0,
                uploader: dbStats ? dbStats.uploader : 'unknown'
            };
        });
        res.json({ items: result, userCanWrite: canWrite });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/files/hit', authenticate, (req, res) => {
    const { path: itemPath } = req.body;
    try {
        // Global count
        db.prepare(`
            INSERT INTO file_stats (path, access_count, last_access) 
            VALUES (?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(path) DO UPDATE SET 
                access_count = access_count + 1,
                last_access = CURRENT_TIMESTAMP
        `).run(itemPath);

        // Per-user log
        db.prepare(`
            INSERT INTO access_logs (path, user_id, count, last_access)
            VALUES (?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(path, user_id) DO UPDATE SET
                count = count + 1,
                last_access = CURRENT_TIMESTAMP
        `).run(itemPath, req.user.id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/files/stats', authenticate, (req, res) => {
    const { path: itemPath } = req.query;
    const history = db.prepare(`
        SELECT u.username, l.count, l.last_access 
        FROM access_logs l
        JOIN users u ON l.user_id = u.id
        WHERE l.path = ?
        ORDER BY l.last_access DESC
    `).all(itemPath);
    res.json(history);
});

app.post('/api/folders', authenticate, async (req, res) => {
    const { path: subPath, name } = req.body;
    const targetPath = path.join(subPath || '', name);

    if (!hasPermission(req.user, targetPath, 'Full')) {
        return res.status(403).json({ error: 'No permission to create folder here' });
    }

    const fullPath = path.join(DISK_A, targetPath);
    try {
        await fs.ensureDir(fullPath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/files', authenticate, async (req, res) => {
    const { path: subPath } = req.query;
    if (!subPath) return res.status(400).json({ error: 'Path required' });

    if (!hasPermission(req.user, subPath, 'Full')) {
        return res.status(403).json({ error: 'No permission to delete this item' });
    }

    try {
        await moveItemToRecycle(subPath, req.user.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/files/bulk-delete', authenticate, async (req, res) => {
    const { paths } = req.body;
    if (!Array.isArray(paths)) return res.status(400).json({ error: 'Paths array required' });

    try {
        for (const subPath of paths) {
            if (hasPermission(req.user, subPath, 'Full')) {
                await moveItemToRecycle(subPath, req.user.id);
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/files/bulk-move', authenticate, async (req, res) => {
    const { paths, targetDir } = req.body;
    if (!Array.isArray(paths) || targetDir === undefined) return res.status(400).json({ error: 'Paths and targetDir required' });

    if (!hasPermission(req.user, targetDir, 'Full')) {
        return res.status(403).json({ error: 'No write permission for target directory' });
    }

    try {
        for (const subPath of paths) {
            if (hasPermission(req.user, subPath, 'Full')) {
                const fileName = path.basename(subPath);
                const oldFullPath = path.join(DISK_A, subPath);
                const newSubPath = path.join(targetDir, fileName);
                const newFullPath = path.join(DISK_A, newSubPath);

                await fs.move(oldFullPath, newFullPath, { overwrite: true });

                // Update database records
                db.prepare('UPDATE file_stats SET path = ? WHERE path = ?').run(newSubPath, subPath);
                db.prepare('UPDATE access_logs SET path = ? WHERE path = ?').run(newSubPath, subPath);
                // For directories, handle internal paths (simplified: just exact match here, complex recursion might be needed for stats)
                // In this system, we mostly move single files or shallow folders.
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sharing
app.post('/api/share', authenticate, (req, res) => {
    const { path: filePath, expiryDays } = req.body;
    const id = Math.random().toString(36).substring(2, 10);
    const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString() : null;
    db.prepare('INSERT INTO shares (id, path, expires_at) VALUES (?, ?, ?)').run(id, filePath, expiresAt);
    res.json({ shareId: id, url: `https://opware.kineraw.com/share/${id}` });
});

app.get('/api/public/share/:id', async (req, res) => {
    const share = db.prepare('SELECT * FROM shares WHERE id = ?').get(req.params.id);
    if (!share) return res.status(404).json({ error: 'Link not found' });
    if (share.expires_at && new Date(share.expires_at) < new Date()) return res.status(410).json({ error: 'Link expired' });

    const fullPath = path.join(DISK_A, share.path);
    if (fs.statSync(fullPath).isDirectory()) {
        const items = await fs.readdir(fullPath, { withFileTypes: true });
        const result = items.map(item => ({
            name: item.name,
            isDirectory: item.isDirectory(),
            path: path.join(share.path, item.name)
        }));
        res.json({ type: 'directory', items: result, path: share.path });
    } else {
        res.sendFile(fullPath);
    }
});

// Recycle Bin Routes
app.get('/api/recycle-bin', authenticate, (req, res) => {
    let query = "SELECT r.*, u.username as deleted_by FROM recycle_bin r JOIN users u ON r.user_id = u.id";
    let params = [];
    if (req.user.role !== 'Admin') {
        query += " WHERE r.user_id = ?";
        params.push(req.user.id);
    }
    const items = db.prepare(query).all(...params);
    res.json(items);
});

app.post('/api/recycle-bin/restore/:id', authenticate, async (req, res) => {
    const item = db.prepare('SELECT * FROM recycle_bin WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (req.user.role !== 'Admin' && item.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized to restore this item' });
    }

    const sourcePath = path.join(RECYCLE_DIR, item.deleted_path);
    const targetPath = path.join(DISK_A, item.original_path);

    try {
        // Ensure parent directory exists for restoration
        await fs.ensureDir(path.dirname(targetPath));
        await fs.move(sourcePath, targetPath);
        db.prepare('DELETE FROM recycle_bin WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/recycle-bin/:id', authenticate, async (req, res) => {
    const item = db.prepare('SELECT * FROM recycle_bin WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (req.user.role !== 'Admin' && item.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        await fs.remove(path.join(RECYCLE_DIR, item.deleted_path));
        db.prepare('DELETE FROM recycle_bin WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/recycle-bin-clear', authenticate, async (req, res) => {
    let query = "SELECT * FROM recycle_bin";
    let params = [];
    if (req.user.role !== 'Admin') {
        query += " WHERE user_id = ?";
        params.push(req.user.id);
    }
    const items = db.prepare(query).all(...params);

    try {
        for (const item of items) {
            await fs.remove(path.join(RECYCLE_DIR, item.deleted_path));
        }
        db.prepare(query.replace('SELECT *', 'DELETE')).run(...params);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Periodic Tasks
async function cleanupRecycleBin() {
    console.log('🧹 Running 30-day recycle bin cleanup...');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const items = db.prepare("SELECT * FROM recycle_bin WHERE deletion_date < ?").all(thirtyDaysAgo);

    for (const item of items) {
        try {
            await fs.remove(path.join(RECYCLE_DIR, item.deleted_path));
            db.prepare("DELETE FROM recycle_bin WHERE id = ?").run(item.id);
            console.log(`🗑️ Permanently deleted expired item: ${item.name}`);
        } catch (e) {
            console.error(`❌ Failed to cleanup item ${item.id}:`, e);
        }
    }
}

// Periodic Backup
const runBackup = () => {
    console.log('Starting backup to Disk B...');
    const { exec } = require('child_process');
    exec(`rsync -av --delete "${DISK_A}/" "${DISK_B}/"`, (error, stdout, stderr) => {
        if (error) console.error(`Backup error: ${error.message}`);
        else console.log('Backup completed successfully.');
    });
};

runBackup();
cleanupRecycleBin();
setInterval(runBackup, 3600 * 1000); // Hourly
setInterval(cleanupRecycleBin, 24 * 3600 * 1000); // Daily
app.post('/api/admin/backup', authenticate, isAdmin, (req, res) => {
    runBackup();
    res.json({ message: 'Backup started' });
});

// Serve Frontend Static Files (Production)
app.use(express.static(path.join(__dirname, '../client/dist')));

// Fallback to SPA for any non-API routes - Using a general middleware to bypass path-to-regexp version issues
app.use((req, res) => {
    // If it's an API route that reached here, it's a 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Otherwise serve the built index.html
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend not built. Run npm run build in client directory.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
