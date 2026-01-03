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
const RECYCLE_DIR = path.join(__dirname, 'data/.recycle');
const JWT_SECRET = process.env.JWT_SECRET || 'longhorn-secret-key-2026';

// Department code mapping for frontend shortcuts (MS -> 市场部 (MS))
const DEPT_CODE_MAP = {
    'MS': '市场部 (MS)',
    'OP': '运营部 (OP)',
    'RD': '研发中心 (RD)',
    'GE': '综合管理 (GE)'
};

// Resolve frontend paths like '/MS' or '/MS/ProjectA' to physical paths '/市场部 (MS)' or '/市场部 (MS)/ProjectA'
function resolvePath(requestPath) {
    if (!requestPath) return '';

    // Handle members personal space: members/pepper → Members/pepper
    if (requestPath.startsWith('members/')) {
        const username = requestPath.replace('members/', '');
        return `Members/${username}`;
    }

    // Handle department codes
    const segments = requestPath.split('/').filter(Boolean);
    if (segments.length > 0 && DEPT_CODE_MAP[segments[0]]) {
        segments[0] = DEPT_CODE_MAP[segments[0]];
    }
    return segments.join('/');
}

// Ensure base directories exist (Department folders are handled by defaultDepts loop below)
fs.ensureDirSync(DISK_A);
fs.ensureDirSync(RECYCLE_DIR);

// Multer Configuration for Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const requestedPath = req.query.path || '';
        const resolvedPath = resolvePath(requestedPath);  // Resolve department codes (e.g., OP -> 运营部 (OP))
        const targetDir = path.join(DISK_A, resolvedPath);
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

// Phase 2: Quick Access Features Tables
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS starred_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            starred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, file_path),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_starred_user ON starred_files(user_id);
        
        CREATE TABLE IF NOT EXISTS share_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            share_token TEXT UNIQUE NOT NULL,
            password TEXT,
            expires_at DATETIME,
            access_count INTEGER DEFAULT 0,
            last_accessed DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_share_token ON share_links(share_token);
        CREATE INDEX IF NOT EXISTS idx_share_user ON share_links(user_id);
    `);
    console.log('[Database] Phase 2 tables created successfully');
} catch (e) {
    console.log('[Database] Phase 2 tables might already exist:', e.message);
}

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
    const fullPath = path.join(DISK_A, subPath);

    if (!fs.existsSync(fullPath)) {
        console.error(`[Recycle] File not found: ${subPath}`);
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

// Get user's accessible departments
app.get('/api/user/accessible-departments', authenticate, (req, res) => {
    try {
        if (req.user.role === 'Admin') {
            const allDepts = db.prepare('SELECT * FROM departments').all();
            return res.json(allDepts);
        }

        const accessibleDepts = [];

        if (req.user.department_name) {
            const dept = db.prepare('SELECT * FROM departments WHERE name = ?').get(req.user.department_name);
            if (dept) {
                accessibleDepts.push(dept);
            }
        }

        const explicitPerms = db.prepare(`
            SELECT DISTINCT d.* 
            FROM permissions p
            JOIN departments d ON p.folder_path = d.name OR p.folder_path LIKE d.name || '/%'
            WHERE p.user_id = ? AND (p.expires_at IS NULL OR p.expires_at > datetime('now'))
        `).all(req.user.id);

        explicitPerms.forEach(dept => {
            if (!accessibleDepts.find(d => d.id === dept.id)) {
                accessibleDepts.push(dept);
            }
        });

        res.json(accessibleDepts);
    } catch (err) {
        console.error('Accessible depts error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Upload Route
app.post('/api/upload', authenticate, upload.array('files'), (req, res) => {
    const requestedPath = req.query.path || '';
    const subPath = resolvePath(requestedPath);

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

// System Stats API (for Dashboard)
app.get('/api/admin/stats', authenticate, isAdmin, async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Helper function to calculate directory size
        const getDirectorySize = (dirPath) => {
            let totalSize = 0;
            const getAllFiles = (dir) => {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        getAllFiles(fullPath);
                    } else {
                        totalSize += stat.size;
                    }
                }
            };
            if (fs.existsSync(dirPath)) {
                getAllFiles(dirPath);
            }
            return totalSize;
        };

        // Get upload stats by time period
        const getUploadStats = (startDate) => {
            const stats = db.prepare(`
                SELECT COUNT(*) as count, SUM(s.size) as total_size
                FROM file_stats s
                WHERE s.uploaded_at >= ?
            `).get(startDate.toISOString()) || { count: 0, total_size: 0 };

            return {
                count: stats.count || 0,
                size: stats.total_size || 0
            };
        };

        const todayStats = getUploadStats(todayStart);
        const weekStats = getUploadStats(weekStart);
        const monthStats = getUploadStats(monthStart);

        // Storage usage
        const totalUsed = getDirectorySize(DISK_A);
        const diskInfo = require('os').totalmem(); // Simplified, ideally use disk space check
        const totalAvailable = diskInfo;

        // Top uploaders
        const topUploaders = db.prepare(`
            SELECT 
                u.username,
                COUNT(DISTINCT s.path) as file_count,
                COALESCE(SUM(s.size), 0) as total_size
            FROM users u
            LEFT JOIN file_stats s ON u.id = s.uploader_id
            WHERE s.uploader_id IS NOT NULL
            GROUP BY u.id, u.username
            ORDER BY total_size DESC
            LIMIT 5
        `).all();

        // Total files count
        const totalFiles = db.prepare('SELECT COUNT(*) as count FROM file_stats').get().count || 0;

        res.json({
            todayStats,
            weekStats,
            monthStats,
            storage: {
                used: totalUsed,
                total: totalAvailable,
                percentage: totalAvailable > 0 ? Math.round((totalUsed / totalAvailable) * 100) : 0
            },
            topUploaders: topUploaders.map(u => ({
                username: u.username,
                fileCount: u.file_count,
                totalSize: u.total_size
            })),
            totalFiles
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: err.message });
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

// ==================== SEARCH API ====================
app.get('/api/search', authenticate, async (req, res) => {
    try {
        const { q, type, dept } = req.query;
        if (!q) return res.status(400).json({ error: 'Search query required' });

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        const results = [];

        // Get accessible departments
        let searchDepts = [];
        if (user.role === 'Admin') {
            searchDepts = db.prepare('SELECT * FROM departments').all();
        } else {
            const userDept = db.prepare('SELECT * FROM departments WHERE id = ?').get(user.department_id);
            if (userDept) searchDepts.push(userDept);

            // Add departments with permissions
            const permDepts = db.prepare(`
                SELECT DISTINCT d.* FROM departments d
                JOIN permissions p ON p.folder_path LIKE d.name || '%'
                WHERE p.user_id = ? AND (p.expires_at IS NULL OR p.expires_at > datetime('now'))
            `).all(user.id);
            searchDepts.push(...permDepts);
        }

        // Filter by dept if specified
        if (dept) {
            searchDepts = searchDepts.filter(d => {
                const code = deptCodeMap[d.name];
                return code === dept;
            });
        }

        // Search in each department
        for (const deptObj of searchDepts) {
            const code = deptCodeMap[deptObj.name];
            if (!code) continue;

            const deptPath = path.join(DISK_A, code);
            if (!fs.existsSync(deptPath)) continue;

            await searchInDirectory(deptPath, q, type, `${code}`, results, user);
        }

        // Search in personal space
        const personalPath = path.join(DISK_A, 'Members', user.username);
        if (fs.existsSync(personalPath)) {
            await searchInDirectory(personalPath, q, type, `Members/${user.username}`, results, user);
        }

        res.json({ results, total: results.length });
    } catch (err) {
        console.error('[Search] Error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

async function searchInDirectory(dirPath, query, typeFilter, pathPrefix, results, user) {
    try {
        const items = await fs.readdir(dirPath);
        const lowerQuery = query.toLowerCase();

        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stats = await fs.stat(fullPath);
            const relativePath = `${pathPrefix}/${item}`;

            // Check if name matches
            if (!item.toLowerCase().includes(lowerQuery)) {
                // If directory, search recursively
                if (stats.isDirectory() && results.length < 100) {
                    await searchInDirectory(fullPath, query, typeFilter, relativePath, results, user);
                }
                continue;
            }

            // Type filtering
            if (typeFilter) {
                const ext = path.extname(item).toLowerCase();
                if (typeFilter === 'image' && !['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) continue;
                if (typeFilter === 'video' && !['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) continue;
                if (typeFilter === 'document' && !['.pdf', '.doc', '.docx', '.txt', '.xlsx'].includes(ext)) continue;
            }

            results.push({
                name: item,
                path: relativePath,
                isDirectory: stats.isDirectory(),
                size: stats.size,
                modified: stats.mtime
            });

            if (results.length >= 100) break;
        }
    } catch (err) {
        // Skip inaccessible directories
    }
}

const deptCodeMap = {
    '市场部 (MS)': 'MS',
    '运营部 (OP)': 'OP',
    '研发中心 (RD)': 'RD',
    '综合管理 (GE)': 'GE'
};

// ==================== STARRED FILES API ====================
app.get('/api/starred', authenticate, (req, res) => {
    try {
        const starred = db.prepare(`
            SELECT id, file_path, starred_at FROM starred_files 
            WHERE user_id = ? ORDER BY starred_at DESC
        `).all(req.user.id);
        res.json(starred);
    } catch (err) {
        console.error('[Starred] Error:', err);
        res.status(500).json({ error: 'Failed to fetch starred files' });
    }
});

app.get('/api/starred/check', authenticate, (req, res) => {
    try {
        const { path } = req.query;
        if (!path) return res.status(400).json({ error: 'Path is required' });
        const starred = db.prepare(`
            SELECT id FROM starred_files WHERE user_id = ? AND file_path = ?
        `).get(req.user.id, path);
        res.json({ starred: !!starred, id: starred?.id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check starred status' });
    }
});

app.post('/api/starred', authenticate, (req, res) => {
    try {
        const { path } = req.body;
        if (!path) return res.status(400).json({ error: 'Path is required' });
        const result = db.prepare(`
            INSERT INTO starred_files (user_id, file_path) VALUES (?, ?)
        `).run(req.user.id, path);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'File already starred' });
        }
        res.status(500).json({ error: 'Failed to star file' });
    }
});

app.delete('/api/starred/:id', authenticate, (req, res) => {
    try {
        const result = db.prepare(`
            DELETE FROM starred_files WHERE id = ? AND user_id = ?
        `).run(req.params.id, req.user.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Starred file not found' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove starred' });
    }
});

app.get('/api/files/starred', authenticate, (req, res) => {
    // Legacy route - redirect to new API
    res.redirect(307, '/api/starred');
});

// ==================== USER STATS API ====================
app.get('/api/user/stats', authenticate, (req, res) => {
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

        // Count uploaded files in user's personal space
        let uploadCount = 0;
        let storageUsed = 0;
        const personalPath = path.join(DISK_A, 'Members', user.username);

        if (fs.existsSync(personalPath)) {
            const countFiles = (dir) => {
                try {
                    const items = fs.readdirSync(dir);
                    items.forEach(item => {
                        const fullPath = path.join(dir, item);
                        const stats = fs.statSync(fullPath);
                        if (stats.isDirectory()) {
                            countFiles(fullPath);
                        } else {
                            uploadCount++;
                            storageUsed += stats.size;
                        }
                    });
                } catch (err) {
                    // Skip inaccessible directories
                }
            };
            countFiles(personalPath);
        }

        // Count starred files
        const starredCount = db.prepare(
            'SELECT COUNT(*) as count FROM starred_files WHERE user_id = ?'
        ).get(user.id).count;

        // Count share links
        const shareCount = db.prepare(
            'SELECT COUNT(*) as count FROM share_links WHERE user_id = ?'
        ).get(user.id).count;

        res.json({
            uploadCount,
            storageUsed,
            starredCount,
            shareCount,
            lastLogin: user.last_login || user.created_at,
            accountCreated: user.created_at,
            username: user.username,
            role: user.role
        });
    } catch (err) {
        console.error('[User Stats] Error:', err);
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
});

// ==================== SHARE LINKS API ====================
const crypto = require('crypto');

function generateShareToken() {
    return crypto.randomBytes(16).toString('hex');
}

// Get user's share links
app.get('/api/shares', authenticate, (req, res) => {
    try {
        const shares = db.prepare(`
            SELECT id, file_path, share_token, expires_at, access_count, last_accessed, created_at,
                   (password IS NOT NULL) as has_password
            FROM share_links 
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).all(req.user.id);
        res.json(shares);
    } catch (err) {
        console.error('[Shares] Error fetching:', err);
        res.status(500).json({ error: 'Failed to fetch shares' });
    }
});

// Create share link
app.post('/api/shares', authenticate, (req, res) => {
    try {
        const { path, password, expiresIn } = req.body;
        if (!path) return res.status(400).json({ error: 'Path is required' });

        const token = generateShareToken();
        let expiresAt = null;

        if (expiresIn) {
            const days = parseInt(expiresIn);
            if (!isNaN(days) && days > 0) {
                expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
            }
        }

        const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;

        const result = db.prepare(`
            INSERT INTO share_links (user_id, file_path, share_token, password, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.id, path, token, hashedPassword, expiresAt);

        res.json({
            success: true,
            id: result.lastInsertRowid,
            token,
            shareUrl: `${req.protocol}://${req.get('host')}/s/${token}`
        });
    } catch (err) {
        console.error('[Shares] Error creating:', err);
        res.status(500).json({ error: 'Failed to create share link' });
    }
});

// Delete share link
app.delete('/api/shares/:id', authenticate, (req, res) => {
    try {
        const result = db.prepare(`
            DELETE FROM share_links WHERE id = ? AND user_id = ?
        `).run(req.params.id, req.user.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Share link not found' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[Shares] Error deleting:', err);
        res.status(500).json({ error: 'Failed to delete share link' });
    }
});

// Public share access (no auth required)
app.get('/share/:token', async (req, res) => {
    try {
        const share = db.prepare(`
            SELECT * FROM share_links WHERE share_token = ?
        `).get(req.params.token);

        if (!share) {
            return res.status(404).send('Share link not found or expired');
        }

        // Check expiration
        if (share.expires_at && new Date(share.expires_at) < new Date()) {
            return res.status(410).send('Share link has expired');
        }

        // If password protected, show password form
        if (share.password) {
            // Return HTML form for password
            return res.send(`
                <!DOCTYPE html>
                <html><head><title>访问共享文件</title></head>
                <body style="font-family: sans-serif; max-width: 400px; margin: 100px auto; padding: 20px;">
                    <h2>此链接受密码保护</h2>
                    <form method="POST" action="/share/${req.params.token}/verify">
                        <input type="password" name="password" placeholder="请输入密码" required 
                            style="width: 100%; padding: 10px; margin: 10px 0; font-size: 16px;">
                        <button type="submit" style="width: 100%; padding: 12px; background: #FFD200; 
                            border: none; font-size: 16px; font-weight: bold; cursor: pointer;">访问</button>
                    </form>
                </body></html>
            `);
        }

        // Update access count
        db.prepare(`
            UPDATE share_links 
            SET access_count = access_count + 1, last_accessed = datetime('now')
            WHERE id = ?
        `).run(share.id);

        // Serve file/directory
        const fullPath = path.join(DISK_A, share.file_path);
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                return res.send('<p>Directory sharing not yet implemented</p>');
            }
            return res.download(fullPath);
        } else {
            return res.status(404).send('File not found');
        }
    } catch (err) {
        console.error('[Share] Error accessing:', err);
        res.status(500).send('Error accessing share');
    }
});

// Verify password for share
app.post('/share/:token/verify', async (req, res) => {
    try {
        const share = db.prepare(`
            SELECT * FROM share_links WHERE share_token = ?
        `).get(req.params.token);

        if (!share || !share.password) {
            return res.status(404).send('Invalid request');
        }

        const password = req.body.password;
        if (!bcrypt.compareSync(password, share.password)) {
            return res.status(401).send('Invalid password');
        }

        // Password correct, serve file
        db.prepare(`
            UPDATE share_links 
            SET access_count = access_count + 1, last_accessed = datetime('now')
            WHERE id = ?
        `).run(share.id);

        const fullPath = path.join(DISK_A, share.file_path);
        if (fs.existsSync(fullPath)) {
            return res.download(fullPath);
        }
        return res.status(404).send('File not found');
    } catch (err) {
        console.error('[Share] Error verifying:', err);
        res.status(500).send('Error verifying password');
    }
});

// File Routes
app.get('/api/files', authenticate, async (req, res) => {
    const requestedPath = req.query.path || '';
    const subPath = resolvePath(requestedPath);
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
    const { path: requestedSubPath, name } = req.body;
    const resolvedSubPath = resolvePath(requestedSubPath || '');
    const targetPath = path.join(resolvedSubPath, name);

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

// Get folder tree for file move dialog
app.get('/api/folders/tree', authenticate, async (req, res) => {
    try {
        const buildTree = (dirPath = '') => {
            const fullPath = path.join(DISK_A, dirPath);
            const nodes = [];

            if (!fs.existsSync(fullPath)) return nodes;
            if (!hasPermission(req.user, dirPath, 'Read')) return nodes;

            const items = fs.readdirSync(fullPath);

            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const itemFullPath = path.join(DISK_A, itemPath);

                try {
                    const stat = fs.statSync(itemFullPath);
                    if (stat.isDirectory()) {
                        // Only include if user has write permission (can move files here)
                        if (hasPermission(req.user, itemPath, 'Full')) {
                            const node = {
                                path: itemPath,
                                name: item,
                                children: buildTree(itemPath)
                            };
                            nodes.push(node);
                        }
                    }
                } catch (err) {
                    // Skip items that can't be accessed
                    continue;
                }
            }

            return nodes.sort((a, b) => a.name.localeCompare(b.name));
        };

        // Start from root and build the tree
        const tree = buildTree('');

        // Add root node
        const result = [{
            path: '',
            name: '根目录',
            children: tree
        }];

        res.json(result);
    } catch (err) {
        console.error('Folder tree error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/files', authenticate, async (req, res) => {
    const requestedPath = req.query.path || '';
    const subPath = resolvePath(requestedPath);
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
    const { paths, targetDir: requestedTargetDir } = req.body;
    if (!Array.isArray(paths) || requestedTargetDir === undefined) return res.status(400).json({ error: 'Paths and targetDir required' });

    const targetDir = resolvePath(requestedTargetDir);

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
    try {
        const items = db.prepare(`
            SELECT r.*, u.username as deleted_by 
            FROM recycle_bin r 
            LEFT JOIN users u ON r.user_id = u.id 
            ORDER BY r.deletion_date DESC
        `).all();

        // Filter items based on user permissions
        const filteredItems = items.filter(item => {
            // Admin sees everything
            if (req.user.role === 'Admin') return true;

            // Check if user has Read permission to the original path
            return hasPermission(req.user, item.original_path, 'Read');
        });

        res.json(filteredItems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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

// Automatic cleanup
cleanupRecycleBin();
setInterval(cleanupRecycleBin, 24 * 3600 * 1000); // Daily

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
