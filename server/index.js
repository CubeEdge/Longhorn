const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const archiver = require('archiver');
const sharp = require('sharp');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'longhorn.db');
const DISK_A = process.env.DISK_A || path.join(__dirname, 'data/DiskA');
const RECYCLE_DIR = path.join(__dirname, 'data/.recycle');
const THUMB_DIR = path.join(__dirname, 'data/.thumbnails');
const JWT_SECRET = process.env.JWT_SECRET || 'longhorn-secret-key-2026';

// Department code mapping for frontend shortcuts (MS -> 市场部 (MS))
const DEPT_CODE_MAP = {
    'MS': '市场部 (MS)',
    'OP': '运营部 (OP)',
    'RD': '研发部 (RD)',
    'RE': '通用台面 (RE)',
    'GE': '通用台面 (RE)' // Alias for backward compatibility
};

// I18n for share pages
const SHARE_I18N = {
    zh: {
        linkNotFound: '链接不存在',
        shareLinkNotFound: '分享链接不存在',
        linkDeletedOrInvalid: '该链接可能已被删除或无效',
        linkExpired: '链接已过期',
        shareLinkExpired: '分享链接已过期',
        linkExpiredDesc: '该链接已超过有效期',
        needsPassword: '需要密码',
        fileNeedsPassword: '该文件需要密码访问',
        enterPassword: '请输入访问密码',
        access: '访问',
        wrongPassword: '密码错误',
        wrongPasswordRetry: '密码错误，请重试',
        fileNotFound: '文件不存在',
        fileMovedOrDeleted: '原文件可能已被移动或删除',
        viewCount: '访问次数',
        expiryTime: '过期时间',
        downloadFile: '下载文件',
        browserNoVideo: '您的浏览器不支持视频播放',
        serverError: '服务器错误',
        days: '天',
        forever: '永久'
    },
    en: {
        linkNotFound: 'Link Not Found',
        shareLinkNotFound: 'Share Link Not Found',
        linkDeletedOrInvalid: 'This link may have been deleted or is invalid',
        linkExpired: 'Link Expired',
        shareLinkExpired: 'Share Link Expired',
        linkExpiredDesc: 'This link has passed its expiration date',
        needsPassword: 'Password Required',
        fileNeedsPassword: 'This file requires a password',
        enterPassword: 'Enter access password',
        access: 'Access',
        wrongPassword: 'Wrong Password',
        wrongPasswordRetry: 'Wrong password, please try again',
        fileNotFound: 'File Not Found',
        fileMovedOrDeleted: 'The original file may have been moved or deleted',
        viewCount: 'Views',
        expiryTime: 'Expires',
        downloadFile: 'Download File',
        browserNoVideo: 'Your browser does not support video playback',
        serverError: 'Server Error',
        days: 'days',
        forever: 'Forever'
    },
    de: {
        linkNotFound: 'Link nicht gefunden',
        shareLinkNotFound: 'Freigabe-Link nicht gefunden',
        linkDeletedOrInvalid: 'Dieser Link wurde möglicherweise gelöscht oder ist ungültig',
        linkExpired: 'Link abgelaufen',
        shareLinkExpired: 'Freigabe-Link abgelaufen',
        linkExpiredDesc: 'Dieser Link ist abgelaufen',
        needsPassword: 'Passwort erforderlich',
        fileNeedsPassword: 'Für diese Datei ist ein Passwort erforderlich',
        enterPassword: 'Zugangskennwort eingeben',
        access: 'Zugriff',
        wrongPassword: 'Falsches Passwort',
        wrongPasswordRetry: 'Falsches Passwort, bitte erneut versuchen',
        fileNotFound: 'Datei nicht gefunden',
        fileMovedOrDeleted: 'Die Originaldatei wurde möglicherweise verschoben oder gelöscht',
        viewCount: 'Aufrufe',
        expiryTime: 'Läuft ab',
        downloadFile: 'Datei herunterladen',
        browserNoVideo: 'Ihr Browser unterstützt keine Videowiedergabe',
        serverError: 'Serverfehler',
        days: 'Tage',
        forever: 'Für immer'
    },
    ja: {
        linkNotFound: 'リンクが見つかりません',
        shareLinkNotFound: '共有リンクが見つかりません',
        linkDeletedOrInvalid: 'このリンクは削除されたか無効です',
        linkExpired: 'リンク期限切れ',
        shareLinkExpired: '共有リンクの有効期限が切れました',
        linkExpiredDesc: 'このリンクの有効期限が切れています',
        needsPassword: 'パスワードが必要',
        fileNeedsPassword: 'このファイルにはパスワードが必要です',
        enterPassword: 'アクセスパスワードを入力',
        access: 'アクセス',
        wrongPassword: 'パスワードが間違っています',
        wrongPasswordRetry: 'パスワードが間違っています。もう一度お試しください',
        fileNotFound: 'ファイルが見つかりません',
        fileMovedOrDeleted: '元のファイルが移動または削除された可能性があります',
        viewCount: '閲覧数',
        expiryTime: '有効期限',
        downloadFile: 'ファイルをダウンロード',
        browserNoVideo: 'お使いのブラウザは動画再生に対応していません',
        serverError: 'サーバーエラー',
        days: '日',
        forever: '永久'
    }
};

const getShareI18n = (lang = 'zh') => SHARE_I18N[lang] || SHARE_I18N.zh;

// Resolve frontend paths like '/MS' or '/MS/ProjectA' to physical paths '/市场部 (MS)' or '/市场部 (MS)/ProjectA'
function resolvePath(requestPath) {
    if (!requestPath) return '';

    // Handle members personal space: members/pepper or Members/pepper → Members/pepper
    const lowerPath = requestPath.toLowerCase();
    if (lowerPath.startsWith('members/')) {
        const username = requestPath.substring('members/'.length);
        return `Members/${username}`;
    }

    // Handle department codes (case-insensitive)
    const segments = requestPath.split('/').filter(Boolean);
    if (segments.length > 0) {
        const firstSegmentUpper = segments[0].toUpperCase();
        if (DEPT_CODE_MAP[firstSegmentUpper]) {
            segments[0] = DEPT_CODE_MAP[firstSegmentUpper];
        }
    }
    return segments.join('/');
}

// Ensure base directories exist (Department folders are handled by defaultDepts loop below)
fs.ensureDirSync(DISK_A);
fs.ensureDirSync(RECYCLE_DIR);
fs.ensureDirSync(THUMB_DIR);

// Multer Configuration for Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const requestedPath = req.query.path || '';
        let resolvedPath = resolvePath(requestedPath);

        // If path resolves to empty, default to user's personal space
        if (!resolvedPath || resolvedPath === '') {
            resolvedPath = `Members/${req.user.username}`;
        }

        // Auto-fix: If resolving to "Members" (root) and user is not Admin,
        // force it to their personal directory.
        if (resolvedPath.toLowerCase() === 'members' && req.user.role !== 'Admin') {
            resolvedPath = `Members/${req.user.username}`;
        }

        const targetDir = path.join(DISK_A, resolvedPath);
        console.log(`[Multer] Requested: "${requestedPath}" → Resolved: "${resolvedPath}" → Target: "${targetDir}"`);
        fs.ensureDirSync(targetDir);
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        // [User Request] Keep original filename, no date prefix
        // Handle filename encoding for Chinese characters manually if needed, 
        // but Multer typically handles originalname UTF8 correctly in modern Node.
        // We ensure it's decoded properly.
        const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, name || file.originalname);
    }
});
const upload = multer({ storage });

// Database Setup
const db = new Database(DB_PATH);
// Enable WAL mode for better concurrency during uploads
db.pragma('journal_mode = WAL');
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
    language TEXT DEFAULT 'zh',
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
            language TEXT DEFAULT 'zh',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_share_token ON share_links(share_token);
        CREATE INDEX IF NOT EXISTS idx_share_user ON share_links(user_id);
    `);

    // Migration for language column
    try { db.exec("ALTER TABLE share_links ADD COLUMN language TEXT DEFAULT 'zh';"); } catch (e) { }
    try { db.exec("ALTER TABLE shares ADD COLUMN language TEXT DEFAULT 'zh';"); } catch (e) { }
    try { db.exec("ALTER TABLE share_collections ADD COLUMN language TEXT DEFAULT 'zh';"); } catch (e) { }
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
    { name: '研发部 (RD)', code: 'RD' },
    { name: '通用台面 (RE)', code: 'RE' }
];

defaultDepts.forEach(dept => {
    try {
        db.prepare('INSERT OR IGNORE INTO departments (name) VALUES (?)').run(dept.name);
        // Ensure Department folders exist (but not Members subfolders)
        const deptPath = path.join(DISK_A, dept.name);
        fs.ensureDirSync(deptPath);
        // Members folders removed - only use top-level Members/ for personal spaces
    } catch (e) { }
});

const ensureUserFolders = (user) => {
    if (user.role === 'Admin') return;
    // Personal folders now under top-level Members/ directory only
    const personalPath = path.join(DISK_A, 'Members', user.username);
    fs.ensureDirSync(personalPath);
};


app.use(compression()); // Enable gzip compression
app.use(cors());
app.use(express.json());
app.use('/preview', express.static(DISK_A, {
    maxAge: '1d',  // Cache images for 1 day
    etag: true,
    lastModified: true
}));

// Health Check Route (Moved down to avoid blocking UI)
app.get('/api/status', (req, res) => {
    res.json({ name: "Longhorn API", status: "Running", version: "1.0.0" });
});

// Thumbnail API - generates and caches small WebP thumbnails for faster loading
// Uses query parameter instead of path parameter for Express 5 compatibility
app.get('/api/thumbnail', async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) {
            return res.status(400).json({ error: 'Missing path parameter' });
        }

        const decodedPath = decodeURIComponent(filePath);
        const size = parseInt(req.query.size) || 200; // Default 200px

        // Validate file extension
        const ext = path.extname(decodedPath).toLowerCase();
        const supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
        if (!supportedFormats.includes(ext)) {
            return res.status(400).json({ error: 'Unsupported format for thumbnails' });
        }

        const sourcePath = path.join(DISK_A, decodedPath);
        if (!fs.existsSync(sourcePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Generate cache key based on file path and size
        const cacheKey = `${decodedPath.replace(/[\/\\]/g, '_')}_${size}.webp`;
        const cachePath = path.join(THUMB_DIR, cacheKey);

        // Check if cached thumbnail exists and is newer than source
        if (fs.existsSync(cachePath)) {
            const sourceStat = fs.statSync(sourcePath);
            const cacheStat = fs.statSync(cachePath);
            if (cacheStat.mtime > sourceStat.mtime) {
                // Serve cached thumbnail
                res.set('Cache-Control', 'public, max-age=604800'); // 7 days
                res.set('Content-Type', 'image/webp');
                return res.sendFile(cachePath);
            }
        }

        // Generate thumbnail
        const thumbnail = await sharp(sourcePath)
            .resize(size, size, { fit: 'cover', position: 'center' })
            .webp({ quality: 75 })
            .toBuffer();

        // Save to cache (async, don't wait)
        fs.writeFile(cachePath, thumbnail, (err) => {
            if (err) console.error('[Thumbnail] Cache write error:', err.message);
        });

        // Respond with thumbnail
        res.set('Cache-Control', 'public, max-age=604800'); // 7 days
        res.set('Content-Type', 'image/webp');
        res.send(thumbnail);

    } catch (err) {
        console.error('[Thumbnail] Error:', err.message);
        res.status(500).json({ error: 'Thumbnail generation failed' });
    }
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
    try {
        fs.appendFileSync(path.join(__dirname, 'debug_perm.txt'), `User=${user.username} Path=${folderPath} Norm=${folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')} Access=${accessType}\n`);
    } catch (e) { }

    if (user.role === 'Admin') return true;

    const normalizedPath = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const deptName = user.department_name;

    // 1. Check personal space: Members/username (top-level)
    // Use case-insensitive comparison to handle potential casing mismatches (e.g. orange vs Orange)
    const personalPath = `members/${user.username.toLowerCase()}`;
    const normalizedLower = normalizedPath.toLowerCase();

    if (normalizedLower === personalPath || normalizedLower.startsWith(personalPath + '/')) {
        return true; // Full access to own personal space
    }

    // 2. Check departmental logic
    if (deptName) {
        const deptNameLower = deptName.toLowerCase();

        // Lead has full access to their department
        if (user.role === 'Lead' && (normalizedLower === deptNameLower || normalizedLower.startsWith(deptNameLower + '/'))) {
            return true;
        }
        // Member has read access to department
        if (user.role === 'Member' && (normalizedLower === deptNameLower || normalizedLower.startsWith(deptNameLower + '/'))) {
            // Check if it's their own member folder (Full access) - Legacy support
            const legacyPersonalPath = `${deptNameLower}/members/${user.username.toLowerCase()}`;
            if (normalizedLower === legacyPersonalPath || normalizedLower.startsWith(legacyPersonalPath + '/')) {
                return true;
            }
            // Otherwise, only Read access for Member in department
            if (accessType === 'Read' || accessType === 'Contributor') return true;
        }
    }

    // 3. Check extended permissions table
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
        // Admin can see all departments
        if (req.user.role === 'Admin') {
            const allDepts = db.prepare('SELECT * FROM departments').all();
            console.log('[API] Admin accessible-departments:', allDepts);
            return res.json(allDepts);
        }

        // For Lead/Member users
        const accessibleDepts = [];

        // Add user's own department
        if (req.user.department_id) {
            const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.user.department_id);
            if (dept) {
                accessibleDepts.push(dept);
            }
        }

        // Add departments from explicit permissions
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

        console.log('[API] Member/Lead accessible-departments:', accessibleDepts);
        res.json(accessibleDepts);
    } catch (err) {
        console.error('[API] Accessible depts error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Upload Route
app.post('/api/upload', authenticate, upload.array('files'), (req, res) => {
    const receiveTime = Date.now();
    const requestedPath = req.query.path || '';
    let subPath = resolvePath(requestedPath);

    // If path resolves to empty (root), default to user's personal space
    if (!subPath || subPath === '') {
        subPath = `Members/${req.user.username}`;
    }

    // Auto-fix: If resolving to "Members" (root) and user is not Admin,
    // force it to their personal directory.
    if (subPath.toLowerCase() === 'members' && req.user.role !== 'Admin') {
        subPath = `Members/${req.user.username}`;
    }

    // Ensure the target directory exists before upload
    const uploadTargetDir = path.join(DISK_A, subPath);
    fs.ensureDirSync(uploadTargetDir);

    if (!hasPermission(req.user, subPath, 'Full') && !hasPermission(req.user, subPath, 'Contributor')) {
        return res.status(403).json({ error: 'No write permission for this folder' });
    }

    try {
        const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO file_stats (path, uploaded_at, uploader_id, access_count, last_access)
            VALUES (?, ?, ?, COALESCE((SELECT access_count FROM file_stats WHERE path = ?), 0), COALESCE((SELECT last_access FROM file_stats WHERE path = ?), CURRENT_TIMESTAMP))
        `);

        // Use transaction for better performance
        const transaction = db.transaction((files) => {
            files.forEach(file => {
                const itemPath = path.join(subPath, file.filename);
                const normalizedPath = itemPath.replace(/\\/g, '/');
                insertStmt.run(normalizedPath, new Date().toISOString(), req.user.id, normalizedPath, normalizedPath);
            });
        });

        transaction(req.files);

        const uploadTime = Date.now() - receiveTime;
        console.log(`[Upload] Total processed ${req.files.length} files to ${subPath} by ${req.user.username} in ${uploadTime}ms`);
        res.json({ success: true });
    } catch (err) {
        console.error('[Upload] Database error:', err);
        res.status(500).json({ error: 'Failed to update file metadata' });
    }
});

// Chunked Upload - Receive individual chunks
const chunkUpload = multer({ dest: path.join(DISK_A, '.chunks') });
app.post('/api/upload/chunk', authenticate, chunkUpload.single('chunk'), async (req, res) => {
    try {
        const { uploadId, fileName, chunkIndex, totalChunks, path: uploadPath } = req.body;

        if (!uploadId || !fileName || chunkIndex === undefined || !totalChunks) {
            return res.status(400).json({ error: 'Missing required chunk metadata' });
        }

        // Create chunk directory for this upload
        const chunkDir = path.join(DISK_A, '.chunks', uploadId);
        fs.ensureDirSync(chunkDir);

        // Move uploaded chunk to its proper location
        const chunkPath = path.join(chunkDir, `${chunkIndex}`);
        fs.moveSync(req.file.path, chunkPath, { overwrite: true });

        console.log(`[Chunk] Received chunk ${parseInt(chunkIndex) + 1}/${totalChunks} for ${fileName} (upload: ${uploadId})`);
        res.json({ success: true, chunkIndex: parseInt(chunkIndex) });
    } catch (err) {
        console.error('[Chunk] Error:', err);
        res.status(500).json({ error: 'Failed to save chunk' });
    }
});

// Chunked Upload - Merge all chunks into final file
app.post('/api/upload/merge', authenticate, async (req, res) => {
    try {
        const { uploadId, fileName, totalChunks, path: uploadPath } = req.body;

        if (!uploadId || !fileName || !totalChunks) {
            return res.status(400).json({ error: 'Missing required merge metadata' });
        }

        let subPath = resolvePath(uploadPath || '');
        if (!subPath || subPath === '') {
            subPath = `Members/${req.user.username}`;
        }
        if (subPath.toLowerCase() === 'members' && req.user.role !== 'Admin') {
            subPath = `Members/${req.user.username}`;
        }

        if (!hasPermission(req.user, subPath, 'Full') && !hasPermission(req.user, subPath, 'Contributor')) {
            return res.status(403).json({ error: 'No write permission for this folder' });
        }

        const chunkDir = path.join(DISK_A, '.chunks', uploadId);
        const targetDir = path.join(DISK_A, subPath);
        fs.ensureDirSync(targetDir);

        const finalPath = path.join(targetDir, fileName);
        const writeStream = fs.createWriteStream(finalPath);

        // Merge chunks in order
        for (let i = 0; i < parseInt(totalChunks); i++) {
            const chunkPath = path.join(chunkDir, `${i}`);
            if (!fs.existsSync(chunkPath)) {
                writeStream.destroy();
                return res.status(400).json({ error: `Missing chunk ${i}` });
            }
            const chunkData = fs.readFileSync(chunkPath);
            writeStream.write(chunkData);
        }

        writeStream.end();

        // Wait for write to complete
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        // Clean up chunk directory
        fs.removeSync(chunkDir);

        // Update database
        const itemPath = path.join(subPath, fileName);
        const normalizedPath = itemPath.replace(/\\/g, '/');
        db.prepare(`
            INSERT OR REPLACE INTO file_stats (path, uploaded_at, uploader_id, access_count, last_access)
            VALUES (?, ?, ?, COALESCE((SELECT access_count FROM file_stats WHERE path = ?), 0), COALESCE((SELECT last_access FROM file_stats WHERE path = ?), CURRENT_TIMESTAMP))
        `).run(normalizedPath, new Date().toISOString(), req.user.id, normalizedPath, normalizedPath);

        console.log(`[Merge] Completed ${fileName} (${totalChunks} chunks) to ${subPath} by ${req.user.username}`);
        res.json({ success: true, path: normalizedPath });
    } catch (err) {
        console.error('[Merge] Error:', err);
        res.status(500).json({ error: 'Failed to merge chunks' });
    }
});

app.post('/api/admin/users', authenticate, isAdmin, (req, res) => {
    const { username, password, role, department_id } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    try {
        const result = db.prepare('INSERT INTO users (username, password, role, department_id) VALUES (?, ?, ?, ?)').run(username, hash, role || 'Member', department_id);

        // Create personal folder for new user
        const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        ensureUserFolders(newUser);

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

    // Append stats for each user
    const usersWithStats = users.map(user => {
        // Calculate stats from file_stats table for Members/<username> directory
        // We use LIKE 'Members/username/%' to count all files recursively
        // Note: This assumes file_stats path starts with Members/... 
        const stats = db.prepare(`
            SELECT COUNT(*) as count, SUM(size) as total_size 
            FROM file_stats 
            WHERE path LIKE ? OR path = ?
        `).get(`Members/${user.username}/%`, `Members/${user.username}`);

        return {
            ...user,
            file_count: stats.count || 0,
            total_size: stats.total_size || 0
        };
    });

    res.json(usersWithStats);
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

        const result = starred.map(item => {
            const fullPath = path.join(DISK_A, item.file_path);
            let stats = { size: 0, mtime: item.starred_at, isDirectory: false };

            try {
                if (fs.existsSync(fullPath)) {
                    const fsStats = fs.statSync(fullPath);
                    stats = {
                        size: fsStats.isDirectory() ? getFolderSize(fullPath) : fsStats.size,
                        mtime: fsStats.mtime,
                        isDirectory: fsStats.isDirectory()
                    };
                }
            } catch (e) { console.error('Stat error', e); }

            const dbStats = db.prepare(`
                SELECT s.access_count, u.username as uploader 
                FROM file_stats s 
                LEFT JOIN users u ON s.uploader_id = u.id 
                WHERE s.path = ?
            `).get(item.file_path);

            return {
                id: item.id,
                name: path.basename(item.file_path),
                path: item.file_path,
                file_path: item.file_path, // Maintain backward compatibility
                size: stats.size,
                mtime: stats.mtime,
                isDirectory: stats.isDirectory,
                starredAt: item.starred_at,
                accessCount: dbStats ? dbStats.access_count : 0,
                uploader: dbStats ? dbStats.uploader : 'unknown'
            };
        });

        res.json(result);
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

        // Count all files uploaded by this user across all directories
        let uploadCount = 0;
        let storageUsed = 0;

        const scanAllFiles = (dir) => {
            try {
                if (!fs.existsSync(dir)) return;
                const items = fs.readdirSync(dir);
                items.forEach(item => {
                    const fullPath = path.join(dir, item);
                    const stats = fs.statSync(fullPath);
                    if (stats.isDirectory()) {
                        scanAllFiles(fullPath);
                    } else {
                        // Get relative path from DISK_A
                        const relativePath = path.relative(DISK_A, fullPath);
                        // Check if this file was uploaded by current user
                        const fileInfo = db.prepare('SELECT uploader_id FROM file_stats WHERE path = ?').get(relativePath);
                        if (fileInfo && fileInfo.uploader_id === user.id) {
                            uploadCount++;
                            storageUsed += stats.size;
                        }
                    }
                });
            } catch (err) {
                // Skip inaccessible directories
            }
        };

        scanAllFiles(DISK_A);

        // Count starred files
        const starredCount = db.prepare(
            'SELECT COUNT(*) as count FROM starred_files WHERE user_id = ?'
        ).get(user.id).count;

        // Count share links (both single files and collections)
        const fileShareCount = db.prepare(
            'SELECT COUNT(*) as count FROM share_links WHERE user_id = ?'
        ).get(user.id).count;

        const collectionShareCount = db.prepare(
            'SELECT COUNT(*) as count FROM share_collections WHERE user_id = ?'
        ).get(user.id).count;

        const shareCount = fileShareCount + collectionShareCount;

        res.json({
            fileCount: uploadCount,  // Add this for Dashboard compatibility
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

// ==================== DEPARTMENT DASHBOARD API ====================

// Helper to get user's department info
// Helper to get user's department info
const getUserDepartment = (userId) => {
    const row = db.prepare(`
        SELECT d.id, d.name 
        FROM users u 
        JOIN departments d ON u.department_id = d.id 
        WHERE u.id = ?
    `).get(userId);

    if (row) {
        // Extract code from name "DeepartmentName (CODE)"
        const match = row.name.match(/\(([^)]+)\)$/);
        row.code = match ? match[1] : null;
    }
    return row;
};

// Get Department Overview Stats
app.get('/api/department/stats', authenticate, (req, res) => {
    if (req.user.role !== 'Lead' && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const dept = getUserDepartment(req.user.id);
        if (!dept) {
            return res.status(404).json({ error: 'Department not found' });
        }

        // 1. Member stats
        const members = db.prepare('SELECT id, username, last_login FROM users WHERE department_id = ?').all(dept.id);
        const totalMembers = members.length;

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const activeMembers = members.filter(m => m.last_login && new Date(m.last_login) > oneWeekAgo).length;

        // 2. File stats (using file_stats table is faster)
        // Match paths starting with DeptName/
        const deptPrefix = dept.name + '/%';
        const fileStats = db.prepare(`
            SELECT COUNT(*) as totalFiles, SUM(size) as totalSize 
            FROM file_stats 
            WHERE path LIKE ?
        `).get(deptPrefix);

        // 3. Storage by Member (Top 5)
        const storageByMember = db.prepare(`
            SELECT u.username, COUNT(f.path) as fileCount, SUM(f.size) as size
            FROM file_stats f
            JOIN users u ON f.uploader_id = u.id
            WHERE f.path LIKE ?
            GROUP BY u.username
            ORDER BY size DESC
            LIMIT 5
        `).all(deptPrefix);

        // 4. Recent Activity (Mockup or simple file uploads)
        const recentActivity = db.prepare(`
            SELECT u.username as user, 'uploaded' as action, f.path as file, f.uploaded_at as time
            FROM file_stats f
            JOIN users u ON f.uploader_id = u.id
            WHERE f.path LIKE ?
            ORDER BY f.uploaded_at DESC
            LIMIT 10
        `).all(deptPrefix);

        res.json({
            department: { name: dept.name, code: dept.code },
            totalMembers,
            activeMembers,
            totalFiles: fileStats.totalFiles || 0,
            totalSize: fileStats.totalSize || 0,
            storageByMember: storageByMember.map(s => ({ ...s, size: s.size || 0 })),
            recentActivity
        });
    } catch (err) {
        console.error('[Dept Stats] Error:', err);
        res.status(500).json({ error: 'Failed to fetch department stats' });
    }
});

// Get Department Members
app.get('/api/department/members', authenticate, (req, res) => {
    if (req.user.role !== 'Lead' && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const dept = getUserDepartment(req.user.id);
        if (!dept) return res.status(404).json({ error: 'Department not found' });

        const members = db.prepare(`
            SELECT id, username, role, last_login 
            FROM users 
            WHERE department_id = ?
        `).all(dept.id);

        const memberData = members.map(m => {
            const usage = db.prepare(`
                SELECT COUNT(*) as count, SUM(size) as size 
                FROM file_stats 
                WHERE uploader_id = ?
            `).get(m.id);
            return {
                ...m,
                fileCount: usage.count || 0,
                storageUsed: usage.size || 0
            };
        });

        res.json(memberData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Department Permissions
app.get('/api/department/permissions', authenticate, (req, res) => {
    if (req.user.role !== 'Lead' && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const dept = getUserDepartment(req.user.id);
        if (!dept) return res.status(404).json({ error: 'Department not found' });

        const perms = db.prepare(`
            SELECT p.*, u.username, g.username as granted_by_name
            FROM permissions p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN users g ON p.granted_by = g.id
            WHERE p.folder_path = ? OR p.folder_path LIKE ?
            ORDER BY p.created_at DESC
        `).all(dept.name, dept.name + '/%');

        res.json(perms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== SHARE LINKS API ====================
app.post('/api/shares', authenticate, (req, res) => {
    try {
        const { path, password, expiresIn, language } = req.body;
        if (!path) return res.status(400).json({ error: 'Path is required' });

        const token = generateShareToken();
        let expiresAt = null;
        const shareLang = language || 'zh'; // Default to Chinese

        if (expiresIn) {
            const days = parseInt(expiresIn);
            if (!isNaN(days) && days > 0) {
                expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
            }
        }

        const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;

        const result = db.prepare(`
            INSERT INTO share_links (user_id, file_path, share_token, password, expires_at, language)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(req.user.id, path, token, hashedPassword, expiresAt, shareLang);

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

// Cleaner share URL alias - server-rendered page
app.get('/s/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.query;
        const shareLink = db.prepare('SELECT * FROM share_links WHERE share_token = ?').get(token);

        // Get language from shareLink or default to 'zh'
        const lang = shareLink?.language || 'zh';
        const i18n = getShareI18n(lang);

        if (!shareLink) {
            return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${i18n.linkNotFound}</title><style>body{font-family:sans-serif;max-width:600px;margin:100px auto;text-align:center;padding:20px;}</style></head><body><h1>❌ ${i18n.shareLinkNotFound}</h1><p>${i18n.linkDeletedOrInvalid}</p></body></html>`);
        }
        if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
            return res.status(410).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${i18n.linkExpired}</title><style>body{font-family:sans-serif;max-width:600px;margin:100px auto;text-align:center;padding:20px;}</style></head><body><h1>⏰ ${i18n.shareLinkExpired}</h1><p>${i18n.linkExpiredDesc}</p></body></html>`);
        }
        if (shareLink.password) {
            if (!password) {
                return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${i18n.needsPassword}</title><style>body{font-family:sans-serif;max-width:500px;margin:100px auto;padding:20px;}input,button{padding:12px;font-size:16px;width:100%;margin:10px 0;border-radius:8px;box-sizing:border-box;}button{background:#FFD200;border:none;cursor:pointer;font-weight:bold;}</style></head><body><h2>🔒 ${i18n.fileNeedsPassword}</h2><form method="GET"><input type="password" name="password" placeholder="${i18n.enterPassword}" required><button type="submit">${i18n.access}</button></form></body></html>`);
            }
            if (!bcrypt.compareSync(password, shareLink.password)) {
                return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${i18n.wrongPassword}</title><style>body{font-family:sans-serif;max-width:500px;margin:100px auto;padding:20px;}input,button{padding:12px;font-size:16px;width:100%;margin:10px 0;border-radius:8px;box-sizing:border-box;}button{background:#FFD200;border:none;cursor:pointer;font-weight:bold;}.error{color:red;}</style></head><body><h2>🔒 ${i18n.fileNeedsPassword}</h2><p class="error">❌ ${i18n.wrongPasswordRetry}</p><form method="GET"><input type="password" name="password" placeholder="${i18n.enterPassword}" required><button type="submit">${i18n.access}</button></form></body></html>`);
            }
        }
        db.prepare('UPDATE share_links SET access_count = access_count + 1, last_accessed = datetime(\'now\') WHERE id = ?').run(shareLink.id);
        const fileName = path.basename(shareLink.file_path);
        const filePath = path.join(DISK_A, shareLink.file_path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${i18n.fileNotFound}</title><style>body{font-family:sans-serif;max-width:600px;margin:100px auto;text-align:center;padding:20px;}</style></head><body><h1>❌ ${i18n.fileNotFound}</h1><p>${i18n.fileMovedOrDeleted}</p></body></html>`);
        }

        // Determine file type
        const ext = path.extname(fileName).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic'].includes(ext);
        const isVideo = ['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext);

        let previewHTML = '';
        if (isImage) {
            previewHTML = `<div style="margin: 30px 0;"><img src="/api/download-share/${token}${password ? '?password=' + encodeURIComponent(password) : ''}" style="max-width: 100%; max-height: 500px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" alt="${fileName}"></div>`;
        } else if (isVideo) {
            previewHTML = `<div style="margin: 30px 0;"><video controls style="max-width: 100%; max-height: 500px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);"><source src="/api/download-share/${token}${password ? '?password=' + encodeURIComponent(password) : ''}" type="video/${ext.substring(1)}">${i18n.browserNoVideo}</video></div>`;
        }

        res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileName}</title><style>body{font-family:sans-serif;max-width:800px;margin:50px auto;padding:20px;text-align:center;background:#1a1a1a;color:#fff;}.file-icon{font-size:64px;margin:20px 0;}.filename{font-size:24px;font-weight:bold;margin:20px 0;word-break:break-all;}.info{color:#999;margin:10px 0;font-size:14px;}button{background:#FFD200;color:#000;border:none;padding:15px 30px;font-size:16px;font-weight:bold;cursor:pointer;border-radius:8px;margin:10px;transition:all 0.2s;}button:hover{background:#FFC100;transform:translateY(-2px);}button.secondary{background:#444;color:#fff;}button.secondary:hover{background:#555;}</style></head><body><div class="file-icon">📄</div><div class="filename">${fileName}</div><div class="info">${i18n.viewCount}: ${shareLink.access_count + 1}</div>${shareLink.expires_at ? `<div class="info">${i18n.expiryTime}: ${new Date(shareLink.expires_at).toLocaleString(lang === 'zh' ? 'zh-CN' : lang === 'de' ? 'de-DE' : lang === 'ja' ? 'ja-JP' : 'en-US')}</div>` : ''}${previewHTML}<div style="margin-top:30px;"><button onclick="window.location.href='/api/download-share/${token}${password ? '?password=' + encodeURIComponent(password) : ''}'">⬇️ ${i18n.downloadFile}</button></div></body></html>`);
    } catch (err) {
        console.error('[Share /s] Full error:', err);
        console.error('[Share /s] Error message:', err.message);
        console.error('[Share /s] Error stack:', err.stack);
        const i18n = getShareI18n('zh');  // Fallback to Chinese
        res.status(500).send(i18n.serverError + ': ' + err.message);
    }
});

app.get('/api/download-share/:token', (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.query;
        const shareLink = db.prepare('SELECT * FROM share_links WHERE share_token = ?').get(token);
        if (!shareLink || (shareLink.expires_at && new Date(shareLink.expires_at) < new Date())) {
            return res.status(404).json({ error: 'Link not found or expired' });
        }
        if (shareLink.password && (!password || !bcrypt.compareSync(password, shareLink.password))) {
            return res.status(403).json({ error: 'Invalid password' });
        }
        const filePath = path.join(DISK_A, shareLink.file_path);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
        res.download(filePath);
    } catch (err) {
        console.error('[Share Download] Error:', err);
        res.status(500).json({ error: 'Download failed' });
    }
});

// File Routes
// Helper to calculate folder size recursively
const getFolderSize = (dirPath) => {
    let size = 0;
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                size += getFolderSize(filePath);
            } else {
                size += stats.size;
            }
        }
    } catch (err) {
        // Ignore errors (e.g., permission denied)
    }
    return size;
};

// File Routes
// File Routes
app.get('/api/files', authenticate, async (req, res) => {
    const requestedPath = req.query.path || '';
    let subPath = resolvePath(requestedPath);

    // Auto-fix: If resolving to "Members" (root) and user is not Admin,
    // force it to their personal directory.
    if (subPath.toLowerCase() === 'members' && req.user.role !== 'Admin') {
        subPath = `Members / ${req.user.username}`;
    }

    const fullPath = path.join(DISK_A, subPath);

    console.log(`[/api/files] Requested: "${requestedPath}" → Resolved: "${subPath}" → Full: "${fullPath}"`);

    // Check Read permissions for the subPath
    if (!hasPermission(req.user, subPath, 'Read')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        // Check write permissions - both Full and Contributor can write
        const canWrite = hasPermission(req.user, subPath, 'Full') || hasPermission(req.user, subPath, 'Contributor');
        const items = await fs.readdir(fullPath, { withFileTypes: true });

        // Generate ETag source data (names + mtime + size)
        // Note: For deep folders, getFolderSize is expensive, so we exclude folder sizes from ETag calculation for speed
        const etagData = items.map(item => {
            const fullItemPath = path.join(fullPath, item.name);
            const stats = fs.statSync(fullItemPath);
            return `${item.name}-${stats.mtime.getTime()}-${item.isDirectory() ? 'dir' : stats.size}`;
        }).join('|');

        // Simple hash for ETag
        const etag = 'W/"' + require('crypto').createHash('md5').update(etagData).digest('hex') + '"';

        // Check If-None-Match
        if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
        }

        res.setHeader('ETag', etag);

        const result = items.map(item => {
            const itemPath = path.join(subPath, item.name).normalize('NFC');
            const fullItemPath = path.join(fullPath, item.name);
            const stats = fs.statSync(fullItemPath);
            const dbStats = db.prepare(`
                SELECT s.access_count, u.username as uploader 
                FROM file_stats s 
                LEFT JOIN users u ON s.uploader_id = u.id 
                WHERE s.path = ?
                    `).get(itemPath);

            // Calculate folder size if directory
            const size = item.isDirectory() ? getFolderSize(fullItemPath) : stats.size;

            return {
                name: item.name,
                isDirectory: item.isDirectory(),
                path: itemPath,
                size: size,
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
            INSERT INTO file_stats(path, access_count, last_access)
    VALUES(?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(path) DO UPDATE SET
    access_count = access_count + 1,
                    last_access = CURRENT_TIMESTAMP
                        `).run(itemPath);

        // Per-user log
        db.prepare(`
            INSERT INTO access_logs(path, user_id, count, last_access)
    VALUES(?, ?, 1, CURRENT_TIMESTAMP)
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

    if (!hasPermission(req.user, targetPath, 'Full') && !hasPermission(req.user, targetPath, 'Contributor')) {
        return res.status(403).json({ error: 'No permission to create folder here' });
    }

    const fullPath = path.join(DISK_A, targetPath);
    try {
        await fs.ensureDir(fullPath);
        // Track folder creator
        db.prepare('INSERT OR REPLACE INTO file_stats (path, uploader_id) VALUES (?, ?)').run(targetPath, req.user.id);
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
            // Allow recursion into 'Members' folder specifically to find personal space
            // Also allow Root ('') to list initial folders
            if (dirPath !== '' && dirPath.toLowerCase() !== 'members' && !hasPermission(req.user, dirPath, 'Read')) return nodes;

            const items = fs.readdirSync(fullPath);

            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const itemFullPath = path.join(DISK_A, itemPath);

                try {
                    const stat = fs.statSync(itemFullPath);
                    if (stat.isDirectory()) {
                        // Only include if user has write permission (can move files here)
                        // OR if it is 'Members' folder (to allow navigation to personal space)
                        const isMembers = itemPath.toLowerCase() === 'members';
                        if (hasPermission(req.user, itemPath, 'Full') || hasPermission(req.user, itemPath, 'Contributor') || isMembers) {
                            const node = {
                                path: itemPath,
                                name: item,
                                children: buildTree(itemPath)
                            };
                            // If it's Members folder, only add if it has children (user's folder)
                            if (!isMembers || node.children.length > 0) {
                                nodes.push(node);
                            }
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

    const failedItems = [];
    let deletedCount = 0;

    try {
        for (const subPath of paths) {
            if (hasPermission(req.user, subPath, 'Full')) {
                await moveItemToRecycle(subPath, req.user.id);
                deletedCount++;
            } else {
                failedItems.push(path.basename(subPath));
            }
        }
        res.json({ success: true, deletedCount, failedItems });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/download-batch', authenticate, (req, res) => {
    const { paths } = req.body;
    if (!Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array required' });
    }

    // Filter valid paths and check permissions
    const validFiles = [];
    for (const subPath of paths) {
        if (!hasPermission(req.user, subPath, 'Read')) continue;
        const fullPath = path.join(DISK_A, subPath);
        if (fs.existsSync(fullPath)) {
            validFiles.push({
                fullPath,
                name: path.basename(subPath)
            });
        }
    }

    if (validFiles.length === 0) {
        return res.status(404).json({ error: 'No valid files found to download' });
    }

    res.attachment('batch_download.zip');
    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    archive.on('warning', function (err) {
        if (err.code === 'ENOENT') {
            console.warn('[Zip Warning]', err);
        } else {
            console.error('[Zip Error]', err);
        }
    });

    archive.on('error', function (err) {
        console.error('[Zip Error]', err);
        if (!res.headersSent) res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    validFiles.forEach(file => {
        const stats = fs.statSync(file.fullPath);
        if (stats.isDirectory()) {
            archive.directory(file.fullPath, file.name);
        } else {
            archive.file(file.fullPath, { name: file.name });
        }
    });

    archive.finalize();
});

app.post('/api/files/bulk-move', authenticate, async (req, res) => {
    const { paths, targetDir: requestedTargetDir } = req.body;
    if (!Array.isArray(paths) || requestedTargetDir === undefined) return res.status(400).json({ error: 'Paths and targetDir required' });

    const targetDir = resolvePath(requestedTargetDir);

    if (!hasPermission(req.user, targetDir, 'Full') && !hasPermission(req.user, targetDir, 'Contributor')) {
        return res.status(403).json({ error: 'No write permission for target directory' });
    }

    try {
        const failedItems = [];
        let movedCount = 0;

        for (const subPath of paths) {
            let canMove = false;
            // 1. Admin/Full permission always allows move
            if (hasPermission(req.user, subPath, 'Full')) {
                canMove = true;
            }
            // 2. Contributor permission + Ownership check
            else if (hasPermission(req.user, subPath, 'Contributor')) {
                const fileStat = db.prepare('SELECT uploader_id FROM file_stats WHERE path = ?').get(subPath);
                if (fileStat && fileStat.uploader_id === req.user.id) {
                    canMove = true;
                }
            }

            if (canMove) {
                const fileName = path.basename(subPath);
                const oldFullPath = path.join(DISK_A, subPath);
                const newSubPath = path.join(targetDir, fileName);
                const newFullPath = path.join(DISK_A, newSubPath);

                await fs.move(oldFullPath, newFullPath, { overwrite: true });

                // Update database records
                db.prepare('UPDATE file_stats SET path = ? WHERE path = ?').run(newSubPath, subPath);
                db.prepare('UPDATE access_logs SET path = ? WHERE path = ?').run(newSubPath, subPath);
                movedCount++;
            } else {
                failedItems.push(path.basename(subPath));
            }
        }
        res.json({ success: true, movedCount, failedItems });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sharing
app.post('/api/share', authenticate, (req, res) => {
    const { path: filePath, expiryDays, language = 'zh' } = req.body;
    const id = Math.random().toString(36).substring(2, 10);
    const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString() : null;
    db.prepare('INSERT INTO shares (id, path, expires_at, language) VALUES (?, ?, ?, ?)').run(id, filePath, expiresAt, language);
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

// Serve share collection view page
app.get('/share-collection/:token', (req, res) => {
    const viewPath = path.join(__dirname, 'public/share-view.html');
    if (fs.existsSync(viewPath)) {
        res.sendFile(viewPath);
    } else {
        res.status(404).send('Share view page not found');
    }
});

// Database Restore Endpoint
app.post('/api/admin/restore-db', authenticate, upload.single('database'), async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admins only' });
    if (!req.file) return res.status(400).json({ error: 'No database file uploaded' });

    console.log('[Admin] Database restore requested from:', req.ip);

    try {
        // 1. Close current connection
        db.close();
        console.log('[Admin] Database connection closed.');

        // 2. Backup existing
        const backupPath = `${DB_PATH}.bak-${Date.now()}`;
        if (await fs.pathExists(DB_PATH)) {
            await fs.move(DB_PATH, backupPath);
            console.log(`[Admin] Backup created at: ${backupPath}`);
        }

        // 3. Move new DB into place
        await fs.move(req.file.path, DB_PATH, { overwrite: true });
        console.log('[Admin] New database installed.');

        res.json({ success: true, message: 'Database restored. Server restarting...' });

        // 4. Restart Process (PM2 will handle this)
        setTimeout(() => {
            console.log('[Admin] Exiting process to trigger restart...');
            process.exit(0);
        }, 1000);

    } catch (err) {
        console.error('[Admin] Restore failed:', err);
        res.status(500).json({ error: err.message });
        setTimeout(() => process.exit(1), 2000); // Fail safe restart
    }
});

// Serve Frontend Static Files (Production)
app.use(express.static(path.join(__dirname, '../client/dist'), {
    maxAge: '1h',  // Cache static assets for 1 hour
    etag: true,
    lastModified: true
}));

// Fallback to SPA for any non-API routes - Using a general middleware to bypass path-to-regexp version issues
// ====== Share Collections APIs (Batch Share) ======

// Create Share Collection
app.post('/api/share-collection', authenticate, async (req, res) => {
    try {
        const { items, paths, name, password, expiresIn, language } = req.body;
        // Support both old 'paths' format and new 'items' format
        const itemsList = items || (paths ? paths.map(p => ({ path: p, isDirectory: false })) : []);
        if (!itemsList || !Array.isArray(itemsList) || itemsList.length === 0) {
            return res.status(400).json({ error: 'No paths provided' });
        }
        const token = crypto.randomBytes(16).toString('hex');
        let expiresAt = null;
        if (expiresIn) {
            const days = parseInt(expiresIn);
            if (!isNaN(days) && days > 0) {
                expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
            }
        }
        const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;
        const result = db.prepare(`INSERT INTO share_collections (user_id, token, name, password, expires_at, language) VALUES (?, ?, ?, ?, ?, ?)`).run(req.user.id, token, name || '分享集合', hashedPassword, expiresAt, language || 'zh');
        const collectionId = result.lastInsertRowid;
        const insertItem = db.prepare(`INSERT INTO share_collection_items (collection_id, file_path, is_directory) VALUES (?, ?, ?)`);
        for (const item of itemsList) {
            const resolvedPath = resolvePath(item.path);
            const fullPath = path.join(DISK_A, resolvedPath);
            if (!fs.existsSync(fullPath)) continue;
            const isDir = item.isDirectory !== undefined ? item.isDirectory : fs.statSync(fullPath).isDirectory();
            insertItem.run(collectionId, resolvedPath, isDir ? 1 : 0);
        }
        const shareUrl = `${req.protocol}://${req.get('host')}/share-collection/${token}`;
        console.log(`[Share Collection] Created by ${req.user.username}: ${paths.length} items`);
        res.json({ success: true, shareUrl, token });
    } catch (err) {
        console.error('[Share Collection] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Access Share Collection (Public)
app.get('/api/share-collection/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.query;
        const collection = db.prepare(`SELECT * FROM share_collections WHERE token = ?`).get(token);
        if (!collection) return res.status(404).json({ error: 'Share not found' });
        if (collection.expires_at && new Date(collection.expires_at) < new Date()) {
            return res.status(410).json({ error: 'Share expired' });
        }
        if (collection.password) {
            if (!password) return res.status(401).json({ error: 'Password required', needsPassword: true });
            if (!bcrypt.compareSync(password, collection.password)) {
                return res.status(401).json({ error: 'Invalid password', needsPassword: true });
            }
        }
        const items = db.prepare(`SELECT file_path, is_directory FROM share_collection_items WHERE collection_id = ?`).all(collection.id);
        const fileInfo = items.map(item => {
            const fullPath = path.join(DISK_A, item.file_path);
            let size = 0;
            if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                size = item.is_directory ? 0 : stats.size;
            }
            return {
                path: item.file_path,
                name: path.basename(item.file_path),
                isDirectory: item.is_directory === 1,
                size: size
            };
        });
        db.prepare(`UPDATE share_collections SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?`).run(collection.id);
        res.json({ name: collection.name, items: fileInfo, createdAt: collection.created_at, accessCount: collection.access_count + 1, language: collection.language || 'zh' });
    } catch (err) {
        console.error('[Share Collection] Error accessing:', err);
        res.status(500).json({ error: err.message });
    }
});

// Download Share Collection as Zip (Public)
app.get('/api/share-collection/:token/download', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.query;
        const collection = db.prepare(`SELECT * FROM share_collections WHERE token = ?`).get(token);
        if (!collection) return res.status(404).json({ error: 'Share not found' });
        if (collection.expires_at && new Date(collection.expires_at) < new Date()) {
            return res.status(410).json({ error: 'Share expired' });
        }
        if (collection.password && (!password || !bcrypt.compareSync(password, collection.password))) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        const items = db.prepare(`SELECT file_path FROM share_collection_items WHERE collection_id = ?`).all(collection.id);
        const archive = archiver('zip', { zlib: { level: 9 } });
        res.attachment(`${collection.name || 'share'}.zip`);
        archive.pipe(res);
        for (const item of items) {
            const fullPath = path.join(DISK_A, item.file_path);
            if (!fs.existsSync(fullPath)) continue;
            const stats = fs.statSync(fullPath);
            const basename = path.basename(item.file_path);
            if (stats.isDirectory()) {
                archive.directory(fullPath, basename);
            } else {
                archive.file(fullPath, { name: basename });
            }
        }
        await archive.finalize();
        console.log(`[Share Collection] Downloaded: ${token}`);
    } catch (err) {
        console.error('[Share Collection] Download error:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

// Get My Share Collections
app.get('/api/my-share-collections', authenticate, (req, res) => {
    try {
        const collections = db.prepare(`
            SELECT c.id, c.token, c.name, c.expires_at, c.access_count, c.created_at, COUNT(i.id) as item_count 
            FROM share_collections c 
            LEFT JOIN share_collection_items i ON c.id = i.collection_id 
            WHERE c.user_id = ? 
            GROUP BY c.id 
            ORDER BY c.created_at DESC
        `).all(req.user.id);
        res.json(collections);
    } catch (err) {
        console.error('[Share Collection] Error listing:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Share Collection
app.delete('/api/share-collection/:id', authenticate, (req, res) => {
    try {
        const result = db.prepare(`DELETE FROM share_collections WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Share collection not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('[Share Collection] Error deleting:', err);
        res.status(500).json({ error: err.message });
    }
});
// (Moved to bottom)


// ====== Share Collections APIs (Batch Share) ======

// Create Share Collection
app.post('/api/share-collection', authenticate, async (req, res) => {
    try {
        const { paths, name, password, expiresIn } = req.body;
        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            return res.status(400).json({ error: 'No paths provided' });
        }
        const token = crypto.randomBytes(16).toString('hex');
        let expiresAt = null;
        if (expiresIn) {
            const days = parseInt(expiresIn);
            if (!isNaN(days) && days > 0) {
                expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
            }
        }
        const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;
        const result = db.prepare(`INSERT INTO share_collections (user_id, token, name, password, expires_at) VALUES (?, ?, ?, ?, ?)`).run(req.user.id, token, name || '分享集合', hashedPassword, expiresAt);
        const collectionId = result.lastInsertRowid;
        const insertItem = db.prepare(`INSERT INTO share_collection_items (collection_id, file_path, is_directory) VALUES (?, ?, ?)`);
        for (const p of paths) {
            const resolvedPath = resolvePath(p);
            const fullPath = path.join(DISK_A, resolvedPath);
            if (!fs.existsSync(fullPath)) continue;
            const isDir = fs.statSync(fullPath).isDirectory();
            insertItem.run(collectionId, resolvedPath, isDir ? 1 : 0);
        }
        const shareUrl = `${req.protocol}://${req.get('host')}/share-collection/${token}`;
        console.log(`[Share Collection] Created by ${req.user.username}: ${paths.length} items`);
        res.json({ success: true, shareUrl, token });
    } catch (err) {
        console.error('[Share Collection] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Access Share Collection (Public)
app.get('/api/share-collection/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.query;
        const collection = db.prepare(`SELECT * FROM share_collections WHERE token = ?`).get(token);
        if (!collection) return res.status(404).json({ error: 'Share not found' });
        if (collection.expires_at && new Date(collection.expires_at) < new Date()) {
            return res.status(410).json({ error: 'Share expired' });
        }
        if (collection.password) {
            if (!password) return res.status(401).json({ error: 'Password required', needsPassword: true });
            if (!bcrypt.compareSync(password, collection.password)) {
                return res.status(401).json({ error: 'Invalid password', needsPassword: true });
            }
        }
        const items = db.prepare(`SELECT file_path, is_directory FROM share_collection_items WHERE collection_id = ?`).all(collection.id);
        const fileInfo = items.map(item => {
            const fullPath = path.join(DISK_A, item.file_path);
            let size = 0;
            if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                size = item.is_directory ? 0 : stats.size;
            }
            return {
                path: item.file_path,
                name: path.basename(item.file_path),
                isDirectory: item.is_directory === 1,
                size: size
            };
        });
        db.prepare(`UPDATE share_collections SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?`).run(collection.id);
        res.json({ name: collection.name, items: fileInfo, createdAt: collection.created_at, accessCount: collection.access_count + 1 });
    } catch (err) {
        console.error('[Share Collection] Error accessing:', err);
        res.status(500).json({ error: err.message });
    }
});

// Download Share Collection as Zip (Public)
app.get('/api/share-collection/:token/download', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.query;
        const collection = db.prepare(`SELECT * FROM share_collections WHERE token = ?`).get(token);
        if (!collection) return res.status(404).json({ error: 'Share not found' });
        if (collection.expires_at && new Date(collection.expires_at) < new Date()) {
            return res.status(410).json({ error: 'Share expired' });
        }
        if (collection.password && (!password || !bcrypt.compareSync(password, collection.password))) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        const items = db.prepare(`SELECT file_path FROM share_collection_items WHERE collection_id = ?`).all(collection.id);
        const archive = archiver('zip', { zlib: { level: 9 } });
        res.attachment(`${collection.name || 'share'}.zip`);
        archive.pipe(res);
        for (const item of items) {
            const fullPath = path.join(DISK_A, item.file_path);
            if (!fs.existsSync(fullPath)) continue;
            const stats = fs.statSync(fullPath);
            const basename = path.basename(item.file_path);
            if (stats.isDirectory()) {
                archive.directory(fullPath, basename);
            } else {
                archive.file(fullPath, { name: basename });
            }
        }
        await archive.finalize();
        console.log(`[Share Collection] Downloaded: ${token}`);
    } catch (err) {
        console.error('[Share Collection] Download error:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

// Get My Share Collections
app.get('/api/my-share-collections', authenticate, (req, res) => {
    try {
        const collections = db.prepare(`
            SELECT c.id, c.token, c.name, c.expires_at, c.access_count, c.created_at, COUNT(i.id) as item_count 
            FROM share_collections c 
            LEFT JOIN share_collection_items i ON c.id = i.collection_id 
            WHERE c.user_id = ? 
            GROUP BY c.id 
            ORDER BY c.created_at DESC
        `).all(req.user.id);
        res.json(collections);
    } catch (err) {
        console.error('[Share Collection] Error listing:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Share Collection
app.delete('/api/share-collection/:id', authenticate, (req, res) => {
    try {
        const result = db.prepare(`DELETE FROM share_collections WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Share collection not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('[Share Collection] Error deleting:', err);
        res.status(500).json({ error: err.message });
    }
});
// Fallback to SPA for any non-API routes
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
    console.log(`Open http://localhost:${PORT} in your browser`);
    // Signal PM2 that the process is ready
    if (process.send) {
        process.send('ready');
    }
});
