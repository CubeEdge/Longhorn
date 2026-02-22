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
const AIService = require('./service/ai_service');
const BackupService = require('./service/backup_service');

// Service Ticket Routes (products and settings loaded here; others via service/index.js)
const products = require('./service/routes/products');
const productsAdmin = require('./service/routes/products-admin');
const settings = require('./service/routes/settings');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'longhorn.db');
const DISK_A = process.env.STORAGE_PATH || (process.platform === 'darwin' && !__dirname.includes('KineCore') ? '/Volumes/fileserver/Files' : path.join(__dirname, 'data/DiskA'));
const RECYCLE_DIR = path.join(__dirname, 'data/.recycle');
const THUMB_DIR = path.join(__dirname, 'data/.thumbnails');
const SERVICE_UPLOADS_DIR = path.join(DISK_A, 'Service_Uploads');
const BACKUP_DIR = process.env.BACKUP_PATH || './data/Backups';
const JWT_SECRET = process.env.JWT_SECRET || 'longhorn-secret-key-2026';

const upload = multer({ dest: path.join(DISK_A, '.uploads') });
const chunkUpload = multer({
    dest: path.join(DISK_A, '.chunks'),
    limits: {
        fileSize: 6 * 1024 * 1024 // 6MB per chunk (5MB + buffer)
    }
});
const filesRoutes = require('./files/routes');
const serviceUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            fs.mkdirSync(SERVICE_UPLOADS_DIR, { recursive: true });
            cb(null, SERVICE_UPLOADS_DIR);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    })
});

// Database Initialization
const db = new Database(DB_PATH, { verbose: console.log });
db.pragma('journal_mode = WAL');
const aiService = new AIService(db);
const backupService = new BackupService(db, DISK_A);
backupService.init();

// Database Backup Scheduler (Legacy removed, using service)
db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        system_name TEXT DEFAULT 'Longhorn System',
        ai_enabled BOOLEAN DEFAULT 1,
        ai_work_mode BOOLEAN DEFAULT 0,
        ai_allow_search BOOLEAN DEFAULT 0,
        ai_provider TEXT DEFAULT 'DeepSeek',
        ai_data_sources TEXT DEFAULT '["tickets","knowledge"]',  -- JSON array: ["tickets", "knowledge", "web_search"]
        ai_system_prompt TEXT,  -- 自定义 Bokeh 系统提示词
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,      -- 'DeepSeek', 'Gemini', 'Custom'
        api_key TEXT,
        base_url TEXT,
        chat_model TEXT,
        reasoner_model TEXT,
        vision_model TEXT,
        allow_search BOOLEAN DEFAULT 0,
        temperature REAL DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 4096,
        top_p REAL DEFAULT 1.0,
        is_active BOOLEAN DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Seed default providers if table is empty
    INSERT OR IGNORE INTO ai_providers (name, base_url, chat_model, reasoner_model, vision_model, is_active, temperature)
    VALUES ('DeepSeek', 'https://api.deepseek.com', 'deepseek-chat', 'deepseek-reasoner', 'deepseek-chat', 1, 0.7);
    
    INSERT OR IGNORE INTO ai_providers (name, base_url, chat_model, reasoner_model, vision_model, is_active, temperature)
    VALUES ('Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 0, 0.7);

    -- Ensure one system settings row exists
    INSERT OR IGNORE INTO system_settings (id, system_name) VALUES (1, 'Longhorn System');


    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        user_type TEXT DEFAULT 'Internal', -- 'Internal', 'Dealer', 'Customer'
        department_id INTEGER,
        department_name TEXT,
        dealer_id INTEGER, -- Link to dealers table when user_type is 'Dealer'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        folder_path TEXT,
        access_type TEXT,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS stars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        file_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, file_path)
    );
    CREATE TABLE IF NOT EXISTS vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language TEXT NOT NULL,
        level TEXT DEFAULT 'General',
        word TEXT NOT NULL,
        phonetic TEXT,
        meaning TEXT,
        meaning_zh TEXT,
        part_of_speech TEXT,
        examples TEXT, -- JSON string
        image TEXT,
        topic TEXT, -- Phase 8: Contextual Topic
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ==================== Product Issue Tracking System ====================
    
    -- Products Master Data
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_line TEXT NOT NULL CHECK(product_line IN ('Camera', 'EVF', 'Accessory')),
        model_name TEXT NOT NULL,
        serial_number TEXT,
        firmware_version TEXT,
        production_batch TEXT,
        production_date DATE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_products_model ON products(model_name);
    CREATE INDEX IF NOT EXISTS idx_products_serial ON products(serial_number);
    CREATE INDEX IF NOT EXISTS idx_products_batch ON products(production_batch);

    -- [DEPRECATED] Customer Records - 已迁移到 accounts 表
    -- customers 表已废弃，所有客户数据现通过 accounts + contacts 表管理

    -- Issue Tickets (旧版issues表，仅用于兼容性)
    CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_number TEXT UNIQUE NOT NULL,
        product_id INTEGER,
        dealer_id INTEGER,
        contact_id INTEGER,
        issue_category TEXT NOT NULL CHECK(issue_category IN ('Hardware', 'Software', 'Consultation', 'Return', 'Complaint')),
        issue_source TEXT NOT NULL CHECK(issue_source IN ('OnlineFeedback', 'OfflineReturn', 'DealerFeedback', 'InternalTest')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT CHECK(severity IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
        status TEXT NOT NULL CHECK(status IN ('Pending', 'Assigned', 'InProgress', 'AwaitingVerification', 'Closed', 'Rejected')) DEFAULT 'Pending',
        assigned_to INTEGER,
        assigned_at DATETIME,
        resolution TEXT,
        resolved_at DATETIME,
        closed_at DATETIME,
        closed_by INTEGER,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id),
        FOREIGN KEY(dealer_id) REFERENCES dealers(id),
        FOREIGN KEY(contact_id) REFERENCES contacts(id),
        FOREIGN KEY(assigned_to) REFERENCES users(id),
        FOREIGN KEY(created_by) REFERENCES users(id),
        FOREIGN KEY(closed_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
    CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(issue_category);
    CREATE INDEX IF NOT EXISTS idx_issues_assigned ON issues(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_issues_product ON issues(product_id);
    CREATE INDEX IF NOT EXISTS idx_issues_dealer ON issues(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_issues_created ON issues(created_at);

    -- Issue Comments / Activity Log
    CREATE TABLE IF NOT EXISTS issue_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        comment_type TEXT CHECK(comment_type IN ('Comment', 'StatusChange', 'Assignment')) DEFAULT 'Comment',
        content TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_comments_issue ON issue_comments(issue_id);

    -- Issue Attachments
    CREATE TABLE IF NOT EXISTS issue_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        file_type TEXT,
        uploaded_by INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY(uploaded_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_attachments_issue ON issue_attachments(issue_id);

    -- Service Attachments (Unified for Inquiry, RMA, Dealer Repair)
    CREATE TABLE IF NOT EXISTS service_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_type TEXT NOT NULL CHECK(ticket_type IN ('Inquiry', 'RMA', 'DealerRepair')),
        ticket_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        file_type TEXT,
        uploaded_by INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(uploaded_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_service_attachments_ticket ON service_attachments(ticket_type, ticket_id);

    -- Import History
    CREATE TABLE IF NOT EXISTS import_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        import_type TEXT NOT NULL CHECK(import_type IN ('Excel', 'CSV', 'API')),
        file_name TEXT,
        total_records INTEGER,
        success_records INTEGER,
        failed_records INTEGER,
        error_log TEXT,
        imported_by INTEGER NOT NULL,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(imported_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ai_usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT,
        task_type TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Migration to add topic column (Safe fail if exists)
try { db.prepare("ALTER TABLE vocabulary ADD COLUMN topic TEXT").run(); } catch (e) { }

// Migration for Backup Settings (Primary)
try { db.prepare("ALTER TABLE system_settings ADD COLUMN backup_enabled BOOLEAN DEFAULT 1").run(); } catch (e) { }
try { db.prepare("ALTER TABLE system_settings ADD COLUMN backup_frequency INTEGER DEFAULT 1440").run(); } catch (e) { }
try { db.prepare("ALTER TABLE system_settings ADD COLUMN backup_retention_days INTEGER DEFAULT 7").run(); } catch (e) { }

// Migration for Secondary Backup Settings
try { db.prepare("ALTER TABLE system_settings ADD COLUMN secondary_backup_enabled BOOLEAN DEFAULT 1").run(); } catch (e) { }
try { db.prepare("ALTER TABLE system_settings ADD COLUMN secondary_backup_frequency INTEGER DEFAULT 4320").run(); } catch (e) { }
try { db.prepare("ALTER TABLE system_settings ADD COLUMN secondary_backup_retention_days INTEGER DEFAULT 30").run(); } catch (e) { }
try { db.prepare("ALTER TABLE system_settings ADD COLUMN ai_system_prompt TEXT").run(); } catch (e) { }

// Migration for inquiry_tickets: add knowledge_article_id
try { db.prepare("ALTER TABLE inquiry_tickets ADD COLUMN knowledge_article_id INTEGER REFERENCES knowledge_articles(id)").run(); } catch (e) { }

// [DEPRECATED] Migration: customers table extra columns
// customers 表已废弃，以下迁移代码保留仅作为历史参考
// try { db.prepare("ALTER TABLE customers ADD COLUMN account_type TEXT DEFAULT 'EndUser'").run(); } catch (e) { }
// try { db.prepare("ALTER TABLE customers ADD COLUMN service_tier TEXT DEFAULT 'STANDARD'").run(); } catch (e) { }
// try { db.prepare("ALTER TABLE customers ADD COLUMN industry_tags TEXT").run(); } catch (e) { }
// try { db.prepare("ALTER TABLE customers ADD COLUMN parent_dealer_id INTEGER").run(); } catch (e) { }

// [DEPRECATED] Migration: dealers table
// 经销商数据已迁移到 accounts 表 (account_type='DEALER')
// 此表已废弃，保留代码仅作为历史参考
/*
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS dealers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            dealer_type TEXT DEFAULT 'FirstTier',
            region TEXT DEFAULT '海外',
            country TEXT,
            city TEXT,
            province TEXT,
            contact_person TEXT,
            contact_email TEXT,
            contact_phone TEXT,
            can_repair INTEGER DEFAULT 0,
            repair_level TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_dealers_code ON dealers(code);
        CREATE INDEX IF NOT EXISTS idx_dealers_region ON dealers(region);
    `);
} catch (e) { console.log('[Migration] dealers table:', e.message); }

// Seed default dealers if table is empty
try {
    const dealerCount = db.prepare('SELECT COUNT(*) as cnt FROM dealers').get();
    if (dealerCount.cnt === 0) {
        db.exec(`
            INSERT OR IGNORE INTO dealers (name, code, dealer_type, region, country, can_repair, repair_level) VALUES
            ('ProAV Berlin', 'PROAV', 'FirstTier', '海外', 'Germany', 1, 'SimpleRepair'),
            ('Gafpa Gear', 'GAFPA', 'FirstTier', '海外', 'USA', 1, 'MediumRepair'),
            ('EU Office', 'EUOFFICE', 'Direct', '海外', 'Netherlands', 1, 'FullRepair'),
            ('1SV', '1SV', 'FirstTier', '海外', 'USA', 0, NULL),
            ('Cinetx', 'CINETX', 'FirstTier', '海外', 'USA', 1, 'SimpleRepair'),
            ('RMK', 'RMK', 'FirstTier', '海外', 'Russia', 0, NULL),
            ('DP Gadget', 'DPGADGET', 'FirstTier', '海外', 'Thailand', 0, NULL);
        `);
        console.log('[Init] Seeded default dealers');
    }
} catch (e) { console.log('[Migration] dealers seed:', e.message); }
*/

// Auto-Seeding: DISABLED to prevent loading incorrect vocabulary data
// The seed file contains incorrect format data that needs to be cleaned
console.log('[Init] Auto-seeding disabled to prevent data corruption');

// Uncomment below to re-enable auto-seeding after seed file is cleaned:
/*
try {
    const seedPath = path.join(__dirname, 'seeds/vocabulary_seed.json');

    if (fs.existsSync(seedPath)) {
        console.log('[Init] Checking for new vocabulary in seed file...');
        const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

        const checkExists = db.prepare('SELECT 1 FROM vocabulary WHERE word = ? AND language = ? AND level = ?');
        const insert = db.prepare(`
            INSERT INTO vocabulary (language, level, word, phonetic, meaning, meaning_zh, part_of_speech, examples, image, topic)
            VALUES (@language, @level, @word, @phonetic, @meaning, @meaning_zh, @part_of_speech, @examples, @image, @topic)
        `);

        let addedCount = 0;
        const insertTransaction = db.transaction((items) => {
            for (const item of items) {
                // Check if exists (Strict Match: word + language + level)
                const exists = checkExists.get(item.word, item.language, item.level);

                if (!exists) {
                    insert.run({
                        ...item,
                        examples: typeof item.examples === 'string' ? item.examples : JSON.stringify(item.examples),
                        image: item.image || null,
                        topic: item.topic || null
                    });
                    addedCount++;
                }
            }
        });

        insertTransaction(seeds);
        console.log(`[Init] Vocabulary Sync: ${addedCount > 0 ? 'Added ' + addedCount + ' new words.' : 'Up to date.'}`);

    } else {
        console.warn('[Init] Seed file not found at:', seedPath);
    }
} catch (err) {
    console.error('[Init] Failed to seed vocabulary:', err);
}
*/

// Debug Endpoint to force re-seed
app.post('/api/debug/seed', (req, res) => {
    try {
        console.log('[Debug] Manual Seeding Triggered');
        const seedPath = path.join(__dirname, 'seeds/vocabulary_seed.json');
        if (!fs.existsSync(seedPath)) return res.status(404).json({ error: 'Seed file not found' });

        const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        const checkExists = db.prepare('SELECT 1 FROM vocabulary WHERE word = ? AND language = ? AND level = ?');
        const insert = db.prepare(`
            INSERT INTO vocabulary (language, level, word, phonetic, meaning, meaning_zh, part_of_speech, examples, image)
            VALUES (@language, @level, @word, @phonetic, @meaning, @meaning_zh, @part_of_speech, @examples, @image)
        `);

        let addedCount = 0;
        const insertTransaction = db.transaction((items) => {
            for (const item of items) {
                const exists = checkExists.get(item.word, item.language, item.level);
                if (!exists) {
                    insert.run({
                        ...item,
                        examples: typeof item.examples === 'string' ? item.examples : JSON.stringify(item.examples)
                    });
                    addedCount++;
                }
            }
        });

        insertTransaction(seeds);
        res.json({ success: true, added: addedCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});



// Department display mapping (code -> display name for UI)
const DEPT_DISPLAY_MAP = {
    'OP': '运营部 (OP)',
    'MS': '市场部 (MS)',
    'RD': '研发部 (RD)',
    'RE': '通用台面 (RE)'
};

// Valid department codes (for path validation)
const VALID_DEPT_CODES = ['OP', 'MS', 'RD', 'RE', 'MEMBERS'];

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

// Chinese name to Code mapping (Global)
const NAME_TO_CODE = {
    '运营部': 'OP',
    '市场部': 'MS',
    '研发中心': 'RD',
    '研发部': 'RD',
    '综合管理': 'GE',
    '通用台面': 'RE'
};

// Resolve frontend paths - normalize to uppercase department codes
function resolvePath(requestPath) {
    if (!requestPath) return '';

    // Log initial path
    // console.log(`[PathResolve] Input: "${requestPath}"`);

    // Normalize to NFC to Ensure Chinese characters match JS string literals
    // iOS/macOS often sends NFD (Decomposed), while JS uses NFC.
    const normalizedPath = requestPath.normalize('NFC');

    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length > 0) {
        let firstSegment = segments[0];

        // Try mapping Chinese -> Code
        if (NAME_TO_CODE[firstSegment]) {
            firstSegment = NAME_TO_CODE[firstSegment];
        }

        const firstSegmentUpper = firstSegment.toUpperCase();
        // Validate and normalize department code
        if (VALID_DEPT_CODES.includes(firstSegmentUpper)) {
            segments[0] = firstSegmentUpper;
        }
    }
    return segments.join('/');
}

// DEBUG: Log Hex to inspect encoding issues
function logHex(str, label) {
    if (!str) return;
    console.log(`[HEX] ${label}: "${str}" -> ${Buffer.from(str).toString('hex')}`);
}

// Authentication Middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.sendStatus(403);
            }

            try {
                // Reload user from DB to ensure latest role/department info
                // Use both integer and float comparison for backward compatibility
                const user = db.prepare(`
                    SELECT id, username, role, department_id, user_type 
                    FROM users
                    WHERE id = ? OR id = CAST(? AS REAL)
                `).get(decoded.id, decoded.id);

                if (!user) {
                    return res.sendStatus(401);
                }

                req.user = user;
                next();
            } catch (err) {
                console.error('[Auth Middleware] Database Error:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
        });
    } else {
        res.sendStatus(401);
    }
};

// Check if user has permission for a path
// ... (fs.ensureDirSync calls remain unchanged) ...

const hasPermission = (user, folderPath, accessType = 'Read') => {
    try {
        // fs.appendFileSync(path.join(__dirname, 'debug_perm.txt'), ...); // Disabled detailed logging
    } catch (e) { }

    if (user.role === 'Admin') return true;

    const normalizedPath = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

    // Normalize DB Department Name to Code if necessary
    let deptName = user.department_name;

    // Handle "Name (Code)" format (e.g. "运营部 (OP)" -> "OP")
    const codeMatch = deptName ? deptName.match(/\(([A-Za-z]+)\)$/) : null;
    if (codeMatch) {
        deptName = codeMatch[1];
    } else if (deptName && NAME_TO_CODE[deptName]) {
        deptName = NAME_TO_CODE[deptName];
    }

    // 1. Check personal space: Members/username
    const personalPath = `members/${user.username.toLowerCase()}`;
    const normalizedLower = normalizedPath.toLowerCase();

    if (normalizedLower === personalPath || normalizedLower.startsWith(personalPath + '/')) {
        return true;
    }

    // 2. Check departmental logic
    if (deptName) {
        const deptNameLower = deptName.toLowerCase();
        if (user.role === 'Lead' && (normalizedLower === deptNameLower || normalizedLower.startsWith(deptNameLower + '/'))) return true;
        if (user.role === 'Member' && (normalizedLower === deptNameLower || normalizedLower.startsWith(deptNameLower + '/'))) {
            // Legacy personal path support
            const legacyPersonalPath = `${deptNameLower}/members/${user.username.toLowerCase()}`;
            if (normalizedLower === legacyPersonalPath || normalizedLower.startsWith(legacyPersonalPath + '/')) return true;
            if (accessType === 'Read' || accessType === 'Contributor') return true;
        }
    }

    // 3. Check extended permissions
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

// Ensure user folders exist (Members/{username})
const ensureUserFolders = (user) => {
    try {
        const personalPath = path.join(DISK_A, 'Members', user.username);
        fs.ensureDirSync(personalPath);

        // Removed implicit recycle bin creation to avoid clutter
        // const trashPath = path.join(personalPath, '.Trash');
        // fs.ensureDirSync(trashPath);
    } catch (e) {
        console.error(`[Init] Failed to ensure folders for ${user.username}:`, e.message);
    }
};

async function moveItemToRecycle(subPath, userId) {
    const fullPath = path.join(DISK_A, subPath);
    if (!fs.existsSync(fullPath)) return;

    const stats = fs.statSync(fullPath);
    const fileName = path.basename(subPath);
    const deletedName = `${Date.now()}_${fileName}`;
    const deletedPath = path.join(RECYCLE_DIR, deletedName);

    await fs.ensureDir(RECYCLE_DIR);
    await fs.move(fullPath, deletedPath);

    db.prepare(`
        INSERT INTO recycle_bin (name, original_path, deleted_path, user_id, is_directory)
        VALUES (?, ?, ?, ?, ?)
    `).run(fileName, subPath, deletedName, userId, stats.isDirectory() ? 1 : 0);

    // Clean up
    db.prepare('DELETE FROM file_stats WHERE path = ? OR path LIKE ?').run(subPath, subPath + '/%');
    db.prepare('DELETE FROM access_logs WHERE path = ? OR path LIKE ?').run(subPath, subPath + '/%');
}

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
    next();
};


// Explicitly set MIME types for HEIC/Video to ensure correct browser/client handling
// MUST be before compression to support Rate Limits / Range requests correctly on iOS
app.use('/preview', (req, res, next) => {
    console.log(`[Preview] Incoming: ${req.path}`);
    res.on('finish', () => {
        console.log(`[Preview] Completed: ${req.path} | Status: ${res.statusCode} | Size: ${res.get('Content-Length') || 'Chunked'}`);
    });

    const ext = path.extname(req.path).toLowerCase();
    if (ext === '.heic') res.setHeader('Content-Type', 'image/heic');
    if (ext === '.heif') res.setHeader('Content-Type', 'image/heif');
    if (ext === '.hevc') res.setHeader('Content-Type', 'video/hevc');
    if (ext === '.mov') res.setHeader('Content-Type', 'video/quicktime');
    next();
}, express.static(DISK_A, {
    maxAge: '1d',  // Cache images for 1 day
    etag: true,
    lastModified: true,
    acceptRanges: true // Enable Range requests
}));

app.use(compression()); // Enable gzip compression
app.use(cors());
app.use(express.json());

// GLOBAL LOGGER
// GLOBAL LOGGER
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url} | IP: ${req.ip}`);
    console.log(`[HTTP] ${req.method} ${req.url} | IP: ${req.ip}`);
    next();
});

// AI Routes
app.post('/api/ai/ticket_parse', authenticate, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Missing text content' });

        const ticketData = await aiService.parseTicket(text);
        res.json({ success: true, data: ticketData });
    } catch (err) {
        console.error('[AI] Ticket Parse Error:', err);
        res.status(500).json({ error: 'AI processing failed', details: err.message });
    }
});


app.post('/api/ai/chat', authenticate, async (req, res) => {
    try {
        const { messages, context } = req.body;
        if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Missing messages array' });

        const result = await aiService.chat(messages, context, req.user);  // Pass user for ticket search permission
        res.json({ success: true, data: { content: result } });  // 返回格式统一为 { content: string }
    } catch (err) {
        console.error('[AI] Chat Error:', err);
        res.status(500).json({ error: 'AI processing failed', details: err.message });
    }
});


// Service Routes - Core (non-duplicated)
// NOTE: inquiry-tickets, rma-tickets, dealer-repairs, knowledge, context 
//       are registered in service/index.js via initService()
const attachmentsDir = path.join(__dirname, 'data', 'issue_attachments');
app.use('/api/admin', settings(db, authenticate, backupService));
app.use('/api/v1/products', products(db, authenticate));
app.use('/api/v1/admin/products', productsAdmin(db, authenticate));

// Health Check Route
// Batch Vocabulary Fetch (Optimized for Updates) - MOVED TO TOP to prevent shadowing
app.get('/api/vocabulary/batch', (req, res) => {
    try {
        const { language, level, count } = req.query;
        let limit = parseInt(count) || 20;
        if (limit > 100) limit = 100; // Cap at 100

        let sql = 'SELECT * FROM vocabulary';
        const params = [];
        const conditions = [];

        if (language) {
            conditions.push('language = ?');
            params.push(language);
        }
        if (level) {
            conditions.push('level = ?');
            params.push(level);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        // Randomly select N rows
        sql += ` ORDER BY RANDOM() LIMIT ?`;
        params.push(limit);

        const rows = db.prepare(sql).all(params);

        const words = rows.map(word => {
            try {
                if (word.examples && typeof word.examples === 'string') {
                    word.examples = JSON.parse(word.examples);
                }
            } catch (e) {
                word.examples = [];
            }
            return word;
        });
        res.json(words);
    } catch (err) {
        console.error('[Vocabulary] Batch Error:', err);
        res.status(500).json({ error: err.message });
    }
});


// Phase 8: Hunger Index Endpoint (Monitoring)
app.get('/api/admin/vocab-health', authenticate, (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
        // Aggregate counts by Language + Level
        const stats = db.prepare(`
            SELECT language, level, COUNT(*) as count 
            FROM vocabulary 
            GROUP BY language, level
            ORDER BY language, level
        `).all();

        // Enrich with Health Status (Hunger Index)
        const healthReport = stats.map(item => {
            let status = 'Healthy';
            // Simple threshold: < 300 words is "Critical" (Hungry)
            if (item.count < 100) status = 'Critical';
            else if (item.count < 300) status = 'Low';

            return {
                ...item,
                status,
                action_required: status !== 'Healthy'
            };
        });

        res.json({
            timestamp: new Date().toISOString(),
            pools: healthReport,
            total_words: healthReport.reduce((acc, cur) => acc + cur.count, 0)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Phase 8: Forge Trigger (Action)
app.post('/api/admin/forge/trigger', authenticate, (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const { language, level, topic, count } = req.body;

    console.log(`[Forge] Triggered by user ${req.user.username} for ${language} ${level}`);

    // Spawn separate process for generation to not block main thread
    const { spawn } = require('child_process');
    const scriptPath = path.join(__dirname, 'scripts/ai_forge.js');

    const args = [
        scriptPath,
        `--language=${language || 'en'}`,
        `--level=${level || 'Advanced'}`,
        `--topic=${topic || 'General'}`,
        `--count=${count || 20}`
    ];

    // Use 'node' executable
    const forgeProcess = spawn('node', args);

    let output = '';

    forgeProcess.stdout.on('data', (data) => {
        output += data.toString();
        // Live logging could go here
    });

    forgeProcess.stderr.on('data', (data) => {
        console.error(`[Forge] Error: ${data}`);
    });

    forgeProcess.on('close', (code) => {
        console.log(`[Forge] Process exited with code ${code}`);
        console.log(`[Forge] Output Preview: ${output.substring(0, 200)}...`);
    });

    // Immediate response (Async)
    res.json({ success: true, message: "Forge job started", details: args });
});


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

        // Support "preview" mode for larger, higher quality images
        const isPreview = req.query.size === 'preview';
        const size = isPreview ? 1200 : (parseInt(req.query.size) || 200);
        const quality = isPreview ? 85 : 75;
        const fitMode = isPreview ? 'inside' : 'cover'; // 'inside' preserves aspect ratio

        // Validate file extension
        const ext = path.extname(decodedPath).toLowerCase();
        // Standard images that sharp handles natively
        const imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
        // Formats to process with ffmpeg (Videos + HEIC/HEIF which sharp might fail on)
        const ffmpegFormats = ['.mov', '.mp4', '.m4v', '.avi', '.mkv', '.hevc', '.heic', '.heif'];
        const supportedFormats = [...imageFormats, ...ffmpegFormats];

        if (!supportedFormats.includes(ext)) {
            return res.status(400).json({ error: 'Unsupported format for thumbnails' });
        }

        const sourcePath = path.join(DISK_A, decodedPath);
        console.log(`[Thumbnail] Checking path: ${sourcePath} (DISK_A=${DISK_A}, decodedPath=${decodedPath})`);
        if (!fs.existsSync(sourcePath)) {
            console.log(`[Thumbnail] File NOT found: ${sourcePath}`);
            return res.status(404).json({ error: 'File not found' });
        }

        // Generate cache key based on file path and size
        const cacheKey = `${decodedPath.replace(/[\/\\]/g, '_')}_${size}.webp`;
        const cachePath = path.join(THUMB_DIR, cacheKey);

        // Check if cached thumbnail exists, is valid (size > 0), and is newer than source
        let useCache = false;
        if (fs.existsSync(cachePath)) {
            try {
                const sourceStat = fs.statSync(sourcePath);
                const cacheStat = fs.statSync(cachePath);

                if (cacheStat.size > 0 && cacheStat.mtime > sourceStat.mtime) {
                    useCache = true;
                } else if (cacheStat.size === 0) {
                    // Delete empty/corrupt cache file
                    try { fs.unlinkSync(cachePath); } catch (e) { }
                }
            } catch (err) {
                console.error(`[Thumbnail] Cache stat error:`, err.message);
            }
        }

        // If valid cache exists, serve it directly (simpler, synchronous)
        if (useCache) {
            try {
                const cacheData = await fs.readFile(cachePath);
                res.set('Cache-Control', 'public, max-age=604800');
                res.set('Content-Type', 'image/webp');
                return res.send(cacheData);
            } catch (err) {
                console.error(`[Thumbnail] Failed to read cache: ${cachePath}`, err.message);
                // Delete bad cache, continue to regeneration
                try { fs.unlinkSync(cachePath); } catch (e) { }
            }
        }

        let thumbnail;

        // Thumbnail Generation Queue to prevent server overload (CPU/IO)
        const thumbQueue = [];
        let thumbProcessing = 0;
        const MAX_CONCURRENT_THUMBS = 2; // Conservative limit for Raspberry Pi/Mini PCs

        const runThumbQueue = () => {
            if (thumbProcessing >= MAX_CONCURRENT_THUMBS || thumbQueue.length === 0) return;

            thumbProcessing++;
            const { task, resolve, reject } = thumbQueue.shift();

            task().then(resolve).catch(reject).finally(() => {
                thumbProcessing--;
                runThumbQueue();
            });
        };

        const queueThumbTask = (task) => {
            return new Promise((resolve, reject) => {
                thumbQueue.push({ task, resolve, reject });
                runThumbQueue();
            });
        };

        if (ffmpegFormats.includes(ext)) {
            // Use ffmpeg/sips for video AND HEIC thumbnails (Async + Queued)
            const { exec } = require('child_process');
            const tempPath = path.join(THUMB_DIR, `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`);
            const logPath = path.join(THUMB_DIR, 'ffmpeg_error.log');

            // Auto-detect ffmpeg path
            const possibleFfmpegPaths = [
                '/opt/homebrew/bin/ffmpeg', // Apple Silicon
                '/usr/local/bin/ffmpeg',    // Intel Mac
                '/usr/bin/ffmpeg',          // Linux default
                'ffmpeg'                    // PATH fallback
            ];
            let ffmpegPath = 'ffmpeg';
            for (const p of possibleFfmpegPaths) {
                if (fs.existsSync(p)) {
                    ffmpegPath = p;
                    break;
                }
            }

            console.log(`[Thumbnail] Queued generation for: ${decodedPath} (preview=${isPreview}) using ${ffmpegPath}`);

            try {
                let cmd;
                if (['.heic', '.heif'].includes(ext)) {
                    // Use macOS native 'sips' for HEIC (More reliable than ffmpeg on Mac)
                    // sips -s format jpeg input.heic --out output.jpg
                    cmd = `sips -s format jpeg "${sourcePath}" --out "${tempPath}"`;
                } else {
                    // Video: Try to get frame at 1s, fallback to start
                    cmd = `"${ffmpegPath}" -y -i "${sourcePath}" -ss 00:00:01 -vframes 1 -vf "scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}" "${tempPath}" 2>/dev/null || "${ffmpegPath}" -y -i "${sourcePath}" -vframes 1 -vf "scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}" "${tempPath}"`;
                }

                // execute via Queue
                await queueThumbTask(() => {
                    return new Promise((resolve, reject) => {
                        console.log(`[Thumbnail] Processing started: ${decodedPath}`);
                        exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
                            if (error) {
                                fs.appendFileSync(logPath, `[${new Date().toISOString()}] Error for ${decodedPath}: ${error.message}\nStderr: ${stderr}\n`);
                                reject(error);
                            } else {
                                resolve();
                            }
                        });
                    });
                });

                if (fs.existsSync(tempPath)) {
                    // Convert to WebP using sharp
                    // For preview mode, use 'inside' fit to preserve aspect ratio
                    thumbnail = await sharp(tempPath)
                        .rotate() // Respect EXIF Orientation
                        .resize(size, size, { fit: fitMode, position: 'center', withoutEnlargement: true })
                        .webp({ quality: quality })
                        .toBuffer();

                    fs.unlinkSync(tempPath);
                } else {
                    throw new Error('Output file missing');
                }
            } catch (err) {
                console.error(`[Thumbnail] Generation error for ${decodedPath}:`, err.message);
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                return res.status(404).json({ error: 'Thumbnail generation failed' });
            }
        } else {
            // Standard Image processing
            try {
                thumbnail = await sharp(sourcePath)
                    .rotate() // Respect EXIF Orientation
                    .resize(size, size, { fit: fitMode, position: 'center', withoutEnlargement: true })
                    .webp({ quality: quality })
                    .toBuffer();
            } catch (err) {
                console.error(`[Thumbnail] Sharp error for ${decodedPath}:`, err.message);
                return res.status(500).json({ error: 'Image thumbnail processing failed' });
            }
        }

        // Save to cache ATOMICALLY (Write temp -> Rename)
        const tempCachePath = path.join(THUMB_DIR, `cache_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webp`);
        try {
            await fs.writeFile(tempCachePath, thumbnail);
            await fs.move(tempCachePath, cachePath, { overwrite: true });
        } catch (e) {
            console.error('[Thumbnail] Cache write error:', e.message);
            if (fs.existsSync(tempCachePath)) fs.unlinkSync(tempCachePath);
        }

        // Respond with thumbnail
        res.set('Cache-Control', 'public, max-age=604800');
        res.set('Content-Type', 'image/webp');
        res.send(thumbnail);

    } catch (err) {
        console.error('[Thumbnail] Error:', err.message);
        res.status(500).json({ error: 'Thumbnail generation failed' });
    }
});



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

// 🔍 DEBUG ENDPOINT (For diagnosis of Remote Server State)
app.get('/api/debug/info', authenticate, (req, res) => {
    try {
        const users = db.prepare('SELECT id, username, role, department_id, created_at FROM users').all();
        const depts = db.prepare('SELECT * FROM departments').all();

        // Test Path Resolution
        const testPathCN = resolvePath('运营部');
        const testPathAL = resolvePath('OP');

        // Test Permission Logic
        const permCheck = {
            user: { username: req.user.username, role: req.user.role, dept: req.user.department_name },
            check_OP: hasPermission(req.user, 'OP', 'Read'),
            check_CN: hasPermission(req.user, '运营部', 'Read')
        };

        res.json({
            serverTime: new Date().toISOString(),
            currentUser: req.user,
            users: users,
            departments: depts,
            pathResolution: {
                '运营部': testPathCN,
                'OP': testPathAL
            },
            permissionCheck: permCheck,
            env: process.env
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
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
            INSERT OR REPLACE INTO file_stats (path, uploaded_at, uploaded_by, accessed_count, last_accessed)
            VALUES (?, ?, ?, COALESCE((SELECT accessed_count FROM file_stats WHERE path = ?), 0), COALESCE((SELECT last_accessed FROM file_stats WHERE path = ?), CURRENT_TIMESTAMP))
        `);

        // Use transaction for better performance
        const transaction = db.transaction((files) => {
            files.forEach(file => {
                const itemPath = path.join(subPath, file.originalname);
                const normalizedPath = itemPath.normalize('NFC').replace(/\\/g, '/');
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

// Chunked Upload - Check existing chunks (for resume)
app.post('/api/upload/check-chunks', authenticate, async (req, res) => {
    try {
        const { uploadId, totalChunks } = req.body;

        if (!uploadId || !totalChunks) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const chunkDir = path.join(DISK_A, '.chunks', uploadId);
        const existingChunks = [];

        if (fs.existsSync(chunkDir)) {
            for (let i = 0; i < parseInt(totalChunks); i++) {
                const chunkPath = path.join(chunkDir, `${i}`);
                if (fs.existsSync(chunkPath)) {
                    existingChunks.push(i);
                }
            }
        }

        console.log(`[Check Chunks] Upload ${uploadId}: ${existingChunks.length}/${totalChunks} chunks exist`);
        res.json({
            success: true,
            existingChunks,
            totalChunks: parseInt(totalChunks),
            uploadId
        });
    } catch (err) {
        console.error('[Check Chunks] Error:', err);
        res.status(500).json({ error: 'Failed to check chunks' });
    }
});

// Chunked Upload - Receive individual chunks
app.post('/api/upload/chunk', authenticate, chunkUpload.single('chunk'), async (req, res) => {
    try {
        const { uploadId, fileName, chunkIndex, totalChunks } = req.body;

        if (!uploadId || !fileName || chunkIndex === undefined || !totalChunks) {
            return res.status(400).json({ error: 'Missing required chunk metadata' });
        }

        // Create chunk directory for this upload
        const chunkDir = path.join(DISK_A, '.chunks', uploadId);
        fs.ensureDirSync(chunkDir);

        // Move uploaded chunk to its proper location (sync for speed)
        const chunkPath = path.join(chunkDir, `${chunkIndex}`);
        fs.renameSync(req.file.path, chunkPath);

        console.log(`[Chunk] ✓ Chunk ${parseInt(chunkIndex) + 1}/${totalChunks} saved for ${fileName}`);
        res.json({ success: true, chunkIndex: parseInt(chunkIndex) });
    } catch (err) {
        console.error('[Chunk] Error:', err);
        res.status(500).json({ error: 'Failed to save chunk', details: err.message });
    }
});

// Chunked Upload - Merge all chunks into final file
app.post('/api/upload/merge', authenticate, async (req, res) => {
    try {
        const { uploadId, fileName, totalChunks, path: uploadPath } = req.body;

        console.log('[Merge] Request received:', {
            uploadId,
            fileName,
            totalChunks,
            uploadPath,
            user: req.user.username,
            role: req.user.role
        });

        if (!uploadId || !fileName || !totalChunks) {
            console.error('[Merge] Missing metadata');
            return res.status(400).json({ error: 'Missing required merge metadata' });
        }

        let subPath = resolvePath(uploadPath || '');
        console.log('[Merge] Resolved path:', subPath);

        if (!subPath || subPath === '') {
            subPath = `Members/${req.user.username}`;
            console.log('[Merge] Using default personal path:', subPath);
        }
        if (subPath.toLowerCase() === 'members' && req.user.role !== 'Admin') {
            subPath = `Members/${req.user.username}`;
            console.log('[Merge] Redirected to personal path:', subPath);
        }

        console.log('[Merge] Checking permissions for path:', subPath);
        const hasFull = hasPermission(req.user, subPath, 'Full');
        const hasContrib = hasPermission(req.user, subPath, 'Contributor');
        console.log('[Merge] Permission check result:', { hasFull, hasContrib, isAdmin: req.user.role === 'Admin' });

        if (!hasFull && !hasContrib) {
            console.error('[Merge] Permission denied for user', req.user.username, 'on path', subPath);
            return res.status(403).json({ error: 'No write permission for this folder' });
        }

        const chunkDir = path.join(DISK_A, '.chunks', uploadId);
        const targetDir = path.join(DISK_A, subPath);
        console.log('[Merge] Directories:', { chunkDir, targetDir });

        fs.ensureDirSync(targetDir);

        const finalPath = path.join(targetDir, fileName);
        const writeStream = fs.createWriteStream(finalPath);

        // Merge chunks in order
        for (let i = 0; i < parseInt(totalChunks); i++) {
            const chunkPath = path.join(chunkDir, `${i}`);
            if (!fs.existsSync(chunkPath)) {
                console.error('[Merge] Missing chunk:', i);
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

        // Clean up chunk directory ONLY after successful merge
        fs.removeSync(chunkDir);

        // Update database (skip file_stats for Service module - table may not exist)
        const itemPath = path.join(subPath, fileName);
        const normalizedPath = itemPath.normalize('NFC').replace(/\\/g, '/');

        try {
            db.prepare(`
                INSERT OR REPLACE INTO file_stats (path, uploaded_at, uploaded_by, accessed_count, last_accessed)
                VALUES (?, ?, ?, COALESCE((SELECT accessed_count FROM file_stats WHERE path = ?), 0), COALESCE((SELECT last_accessed FROM file_stats WHERE path = ?), CURRENT_TIMESTAMP))
            `).run(normalizedPath, new Date().toISOString(), req.user.id, normalizedPath, normalizedPath);
        } catch (statsErr) {
            console.log('[Merge] file_stats update skipped (OK for Service uploads):', statsErr.message);
        }

        console.log(`[Merge] ✓ Completed ${fileName} (${totalChunks} chunks) to ${subPath} by ${req.user.username}`);
        res.json({ success: true, path: normalizedPath });
    } catch (err) {
        console.error('[Merge] Error:', err);
        console.error('[Merge] Stack:', err.stack);
        // DO NOT delete chunk directory on error - allow resume
        res.status(500).json({ error: 'Failed to merge chunks', canRetry: true, details: err.message });
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

// Get department stats for the current user
app.get('/api/department/my-stats', authenticate, (req, res) => {
    try {
        // Fetch fresh user info including department
        const userInfo = db.prepare(`
            SELECT u.*, d.name as department_name 
            FROM users u 
            LEFT JOIN departments d ON u.department_id = d.id 
            WHERE u.id = ?
        `).get(req.user.id);

        const deptName = userInfo ? userInfo.department_name : null;

        if (!deptName) {
            return res.json({
                fileCount: 0,
                storageUsed: 0,
                memberCount: 0,
                departmentName: "Unknown"
            });
        }

        // Member Count
        const memberCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE department_id = (SELECT id FROM departments WHERE name = ?)').get(deptName).count || 0;

        // File Stats (Scanning DISK_A/<DeptName>)
        let fileCount = 0;
        let storageUsed = 0;
        const deptPath = path.join(DISK_A, deptName);

        const scan = (dir) => {
            if (!fs.existsSync(dir)) return;
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    try {
                        const stats = fs.statSync(fullPath);
                        if (stats.isDirectory()) {
                            scan(fullPath);
                        } else {
                            fileCount++;
                            storageUsed += stats.size;
                        }
                    } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore dir access error */ }
        };

        scan(deptPath);

        res.json({
            fileCount,
            storageUsed,
            memberCount,
            departmentName: deptName
        });
    } catch (err) {
        console.error('[Dept Stats] Error:', err);
        res.status(500).json({ error: 'Failed to fetch department stats' });
    }
});



// Get current user's special permissions
app.get('/api/user/permissions', authenticate, (req, res) => {
    try {
        const perms = db.prepare(`
            SELECT id, folder_path, access_type, expires_at 
            FROM permissions 
            WHERE user_id = ?
        `).all(req.user.id);

        // Filter out expired permissions
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const validPerms = perms.filter(p => {
            if (!p.expires_at) return true;
            return new Date(p.expires_at) >= now;
        });

        res.json(validPerms);
    } catch (err) {
        console.error('[Permissions] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// System Stats API (for Dashboard)
app.get('/api/admin/stats', authenticate, isAdmin, async (req, res) => {
    console.log('[SystemStats] Request received from user:', req.user.username);
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Helper function to calculate directory size
        const getDirectorySize = (dirPath) => {
            let totalSize = 0;
            const getAllFiles = (dir) => {
                try {
                    const items = fs.readdirSync(dir);
                    for (const item of items) {
                        // Skip macOS system folders
                        if (item.startsWith('.')) continue;

                        const fullPath = path.join(dir, item);
                        try {
                            const stat = fs.statSync(fullPath);
                            if (stat.isDirectory()) {
                                getAllFiles(fullPath);
                            } else {
                                totalSize += stat.size;
                            }
                        } catch (err) {
                            // Skip files/folders that can't be accessed (permission denied, etc.)
                            console.warn(`Skipping inaccessible path: ${fullPath}`);
                        }
                    }
                } catch (err) {
                    console.warn(`Cannot read directory: ${dir}`, err.message);
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
            SELECT COUNT(*) as count, COALESCE(SUM(s.size), 0) as total_size
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
                COUNT(DISTINCT s.path) as fileCount,
                COALESCE(SUM(s.size), 0) as totalSize
            FROM users u
            LEFT JOIN file_stats s ON u.id = s.uploaded_by
            WHERE s.uploaded_by IS NOT NULL
            GROUP BY u.id, u.username
            ORDER BY totalSize DESC
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
            topUploaders,
            totalFiles
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Record file access (for access logging)
app.post('/api/files/access', authenticate, (req, res) => {
    try {
        const { path: filePath } = req.body;
        if (!filePath) {
            return res.status(400).json({ error: 'Path is required' });
        }

        const userId = req.user.id;
        const username = req.user.username;

        // Update or insert access log
        const existing = db.prepare(`
            SELECT id, count FROM access_logs 
            WHERE path = ? AND user_id = ?
        `).get(filePath, userId);

        if (existing) {
            db.prepare(`
                UPDATE access_logs 
                SET count = count + 1, last_access = datetime('now')
                WHERE id = ?
            `).run(existing.id);
        } else {
            db.prepare(`
                INSERT INTO access_logs (path, user_id, username, count, last_access)
                VALUES (?, ?, ?, 1, datetime('now'))
            `).run(filePath, userId, username);
        }

        // Also update file_stats accessed_count
        db.prepare(`
            UPDATE file_stats 
            SET accessed_count = accessed_count + 1
            WHERE path = ?
        `).run(filePath);

        res.json({ success: true });
    } catch (err) {
        console.error('[Access Log] Error:', err);
        res.status(500).json({ error: 'Failed to record access' });
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
            SELECT s.path, s.accessed_count, u.username as uploader, 
                   (SELECT last_access FROM access_logs WHERE path = s.path ORDER BY last_access DESC LIMIT 1) as last_time
            FROM file_stats s
            LEFT JOIN users u ON s.uploaded_by = u.id
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
                    access_count: row.access_count,
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
// --- Vocabulary API (Daily Word V13) ---
// Vocabulary API (SQLite Driven)
app.get('/api/vocabulary/random', (req, res) => {
    const { language, level } = req.query;

    // Base query
    let sql = 'SELECT * FROM vocabulary';
    const params = [];
    const conditions = [];

    if (language) {
        conditions.push('language = ?');
        params.push(language);
    }

    if (level) {
        conditions.push('level = ?');
        params.push(level);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    // Order by random
    sql += ' ORDER BY RANDOM() LIMIT 1';

    try {
        const word = db.prepare(sql).get(...params);
        if (word) {
            // Parse JSON examples
            try {
                word.examples = JSON.parse(word.examples);
            } catch (e) {
                word.examples = [];
            }
            res.json(word);
        } else {
            res.status(404).json({ error: 'No words found' });
        }
    } catch (err) {
        console.error('Vocabulary error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// List available levels for a language
app.get('/api/vocabulary/levels', (req, res) => {
    const { language } = req.query;
    if (!language) return res.status(400).json({ error: 'Language required' });

    try {
        const rows = db.prepare('SELECT DISTINCT level FROM vocabulary WHERE language = ?').all(language);
        res.json(rows.map(r => r.level));
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Duplicate route removed (Moved to top)

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
                SELECT s.accessed_count, u.username as uploader 
                FROM file_stats s 
                LEFT JOIN users u ON s.uploaded_by = u.id 
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
                access_count: dbStats ? dbStats.accessed_count : 0,
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
        console.error('[Starred Error]', err.message, err.code);
        // Handle both SQLITE_CONSTRAINT and SQLITE_CONSTRAINT_UNIQUE
        if (err.code && err.code.includes('SQLITE_CONSTRAINT')) {
            return res.status(409).json({ error: 'File already starred' });
        }
        res.status(500).json({ error: 'Failed to star file', details: err.message });
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
                        const fileInfo = db.prepare('SELECT uploaded_by FROM file_stats WHERE path = ?').get(relativePath);
                        if (fileInfo && fileInfo.uploaded_by === user.id) {
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
        const rawShares = db.prepare(`
            SELECT sl.id, sl.user_id, sl.file_path, 
                   sl.share_token as token, sl.expires_at, sl.access_count, sl.created_at, sl.language,
                   (sl.password IS NOT NULL AND sl.password != '') as has_password,
                   fs.size as file_size,
                   u.username as uploader_name
            FROM share_links sl
            LEFT JOIN file_stats fs ON sl.file_path = fs.path
            LEFT JOIN users u ON fs.uploaded_by = u.id
            WHERE sl.user_id = ?
            ORDER BY sl.created_at DESC
        `).all(req.user.id);

        // Transform data for iOS compatibility, getting file size from filesystem if not in DB
        const shares = rawShares.map(s => {
            let fileSize = s.file_size;
            let uploaderName = s.uploader_name;

            // If file_size is null, try to get from filesystem
            if (!fileSize && s.file_path) {
                try {
                    const fullPath = path.join(DISK_A, s.file_path);
                    if (fs.existsSync(fullPath)) {
                        const stats = fs.statSync(fullPath);
                        fileSize = stats.size;
                    }
                } catch (e) {
                    console.error('[Shares] Error getting file size:', e.message);
                }
            }

            return {
                ...s,
                file_name: s.file_path ? s.file_path.split('/').pop() : null,
                file_size: fileSize,
                uploader: uploaderName || 'unknown',
                has_password: Boolean(s.has_password)
            };
        });

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

// Update share link (password, expiry)
app.put('/api/shares/:id', authenticate, (req, res) => {
    try {
        const { password, expiresInDays, removePassword } = req.body;
        const shareId = req.params.id;

        // Verify ownership
        const share = db.prepare(`
            SELECT * FROM share_links WHERE id = ? AND user_id = ?
        `).get(shareId, req.user.id);

        if (!share) {
            return res.status(404).json({ error: 'Share link not found' });
        }

        // Build update query
        const updates = [];
        const values = [];

        // Handle password update
        if (removePassword) {
            updates.push('password = NULL');
        } else if (password) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            updates.push('password = ?');
            values.push(hashedPassword);
        }

        // Handle expiry update
        if (expiresInDays !== undefined) {
            if (expiresInDays === null || expiresInDays === -1) {
                updates.push('expires_at = NULL');
            } else {
                const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
                updates.push('expires_at = ?');
                values.push(expiresAt);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        values.push(shareId, req.user.id);
        const result = db.prepare(`
            UPDATE share_links SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
        `).run(...values);

        res.json({ success: true, changes: result.changes });
    } catch (err) {
        console.error('[Shares] Error updating:', err);
        res.status(500).json({ error: 'Failed to update share link' });
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
            previewHTML = `<div style="margin: 30px 0;"><img src="/api/download-share/${token}?size=preview${password ? '&password=' + encodeURIComponent(password) : ''}" style="max-width: 100%; max-height: 500px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" alt="${fileName}"></div>`;
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

app.get('/api/download-share/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password, size } = req.query;
        const shareLink = db.prepare('SELECT * FROM share_links WHERE share_token = ?').get(token);
        if (!shareLink || (shareLink.expires_at && new Date(shareLink.expires_at) < new Date())) {
            return res.status(404).json({ error: 'Link not found or expired' });
        }
        if (shareLink.password && (!password || !bcrypt.compareSync(password, shareLink.password))) {
            return res.status(403).json({ error: 'Invalid password' });
        }
        const filePath = path.join(DISK_A, shareLink.file_path);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

        // Preview Mode
        if (size === 'preview') {
            const ext = path.extname(filePath).toLowerCase();
            const imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.tiff'];
            if (imageFormats.includes(ext)) {
                // Try to use existing thumbnail cache or generate one
                // We use the same THUMB_DIR as the main thumbnail API
                const cacheKey = `${shareLink.file_path.replace(/[\/\\]/g, '_')}_preview_share.webp`;
                const cachePath = path.join(THUMB_DIR, cacheKey);

                if (fs.existsSync(cachePath)) {
                    res.set('Content-Type', 'image/webp');
                    return res.download(cachePath);
                }

                // Generate
                try {
                    // Check if sharp is available (it should be)
                    // We generate a 1200px preview
                    let transform = sharp(filePath);
                    if (ext === '.heic') {
                        const inputBuffer = await fs.readFile(filePath);
                        const outputBuffer = await heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 0.8 });
                        transform = sharp(outputBuffer);
                    }

                    await transform
                        .rotate()
                        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 80 })
                        .toFile(cachePath);

                    res.set('Content-Type', 'image/webp');
                    return res.download(cachePath);
                } catch (sharpErr) {
                    console.error('[Share Preview] Generation failed:', sharpErr);
                    // Fallback to original
                }
            }
        }

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
// Get file access stats
app.get('/api/files/stats', authenticate, (req, res) => {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: 'Path required' });

    // Check permission (Full or Owner)
    const fileStat = db.prepare('SELECT uploader_id FROM file_stats WHERE path = ?').get(filePath);
    const isOwner = fileStat && fileStat.uploader_id === req.user.id;

    if (!isOwner && !hasPermission(req.user, filePath, 'Full')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const stats = db.prepare(`
            SELECT l.count, l.last_access, u.username
            FROM access_logs l
            JOIN users u ON l.user_id = u.id
            WHERE l.path = ?
            ORDER BY l.last_access DESC
        `).all(filePath);

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/files', authenticate, async (req, res) => {
    const requestedPath = req.query.path || '';
    let subPath = resolvePath(requestedPath);

    // Auto-fix: If resolving to "Members" (root) and user is not Admin,
    // force it to their personal directory.
    if (subPath.toLowerCase() === 'members' && req.user.role !== 'Admin') {
        subPath = `Members/${req.user.username}`;
    }

    const fullPath = path.join(DISK_A, subPath);

    // 🔍 DEBUG LOGGING
    console.log(`[FILES] Query Path: "${requestedPath}"`);
    console.log(`[FILES] Resolved SubPath: "${subPath}"`);
    console.log(`[FILES] Full Path: "${fullPath}"`);
    console.log(`[FILES] User: ${req.user.username} (Role: ${req.user.role}, Dept: ${req.user.department_name})`);
    console.log(`[FILES] Resolved SubPath: "${subPath}"`);
    console.log(`[FILES] User: ${req.user.username} (Role: ${req.user.role}, Dept: ${req.user.department_name})`);

    // Check Read permissions for the subPath
    if (!hasPermission(req.user, subPath, 'Read')) {
        console.log(`[FILES] ❌ Permission Denied for user ${req.user.username} on ${subPath}`);
        return res.status(403).json({ error: 'Permission denied' });
    } else {
        console.log(`[FILES] ✅ Permission Granted`);
    }

    // Handle File Download
    if (req.query.download === 'true') {
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            return res.download(fullPath);
        } else {
            return res.status(404).json({ error: 'File not found' });
        }
    }

    try {
        // Check write permissions - both Full and Contributor can write
        const canWrite = hasPermission(req.user, subPath, 'Full') || hasPermission(req.user, subPath, 'Contributor');
        let items = [];
        try {
            console.log(`[FILES] Reading directory: ${fullPath}`);
            items = (await fs.readdir(fullPath, { withFileTypes: true }))
                .filter(item => !item.name.startsWith('.'));
            console.log(`[FILES] Found ${items.length} items`);
        } catch (e) {
            console.error(`[FILES] ReadDir Error: ${e.message}`);
            // If folder doesn't exist on disk but permission granted (e.g. valid DB dept but no folder)
            items = [];
        }

        // Generate ETag source data (names + mtime + size)

        // Generate ETag source data (names + mtime + size)
        // Note: For deep folders, getFolderSize is expensive, so we exclude folder sizes from ETag calculation for speed
        const etagData = items.map(item => {
            const fullItemPath = path.join(fullPath, item.name);
            const stats = fs.statSync(fullItemPath);
            return `${item.name}-${stats.mtime.getTime()}-${item.isDirectory() ? 'dir' : stats.size}`;
        }).join('|');

        // Include user's starred count in ETag so it invalidates when starred changes
        const userStarredCount = db.prepare('SELECT COUNT(*) as count FROM starred_files WHERE user_id = ?').get(req.user.id)?.count || 0;

        // Simple hash for ETag
        const etag = 'W/"' + require('crypto').createHash('md5').update(etagData + '|starred:' + userStarredCount).digest('hex') + '"';

        // Check If-None-Match
        if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
        }

        res.setHeader('ETag', etag);

        const result = items.map(item => {
            const itemPath = path.join(subPath, item.name).normalize('NFC');
            const fullItemPath = path.join(fullPath, item.name);
            const stats = fs.statSync(fullItemPath);
            // Ultimate Omni-Matcher: Try Exact -> NFC -> NFD -> Suffix Match -> ALIAS
            // 1. Generate path aliases (Dept Code <-> Dept Name)
            const pathVariants = [itemPath, itemPath.normalize('NFC'), itemPath.normalize('NFD')];

            // Try identifying Department prefix and add alias
            Object.entries(DEPT_DISPLAY_MAP).forEach(([code, displayName]) => {
                // If path starts with Code (e.g. "MS/"), add Name alias (e.g. "市场部 (MS)/")
                if (itemPath.startsWith(code + '/') || itemPath === code) {
                    pathVariants.push(itemPath.replace(code, displayName));
                }
                // If path starts with Name (e.g. "市场部 (MS)/"), add Code alias (e.g. "MS/")
                else if (itemPath.startsWith(displayName + '/') || itemPath === displayName) {
                    pathVariants.push(itemPath.replace(displayName, code));
                }
            });

            // Deduplicate variants
            const uniqueVariants = [...new Set(pathVariants)];
            const placeholders = uniqueVariants.map(() => '?').join(',');

            let dbStats = db.prepare(`
                SELECT s.access_count, u.username as uploader 
                FROM file_stats s 
                LEFT JOIN users u ON s.uploader_id = u.id 
                WHERE s.path IN (${placeholders})
            `).get(...uniqueVariants);

            if (!dbStats) {
                // Fuzzy fallback: Match by file name suffix
                dbStats = db.prepare(`
                    SELECT s.access_count, u.username as uploader 
                    FROM file_stats s 
                    LEFT JOIN users u ON s.uploader_id = u.id 
                    WHERE s.path LIKE ? ESCAPE '\\'
                    LIMIT 1
                `).get(`%/${item.name}`);
            }

            // Explicit Debug for Uploader Issue
            if (dbStats && dbStats.uploader === null) {
                console.log(`[Debug] Uploader IS NULL for path: ${itemPath} (uploader_id might be missing/invalid)`);
            } else if (dbStats) {
                // console.log(`[Debug] Uploader found: ${dbStats.uploader} for ${itemPath}`);
            }


            // Debug logging for unknown uploader
            if (!dbStats) {
                const verifyStart = db.prepare('SELECT count(*) as c FROM file_stats WHERE path = ?').get(itemPath);
                console.log(`[Debug] Unknown Uploader: Path="${itemPath}" | DB_Count=${verifyStart ? verifyStart.c : 'err'}`);
            }

            if (!dbStats && (itemPath.includes('运营部') || itemPath.includes('市场部'))) {
                console.log(`[Debug] Query MISS: "${itemPath}" | Hex: ${Buffer.from(itemPath).toString('hex')}`);
            }

            // Calculate folder size if directory
            const size = item.isDirectory() ? getFolderSize(fullItemPath) : stats.size;

            // Check if file is starred by current user
            // Match by exact path, suffix with slash, or just filename (for root level)
            const starredRecord = db.prepare(`
                SELECT 1 FROM starred_files 
                WHERE user_id = ? AND (file_path = ? OR file_path LIKE ? OR file_path = ?)
            `).get(req.user.id, itemPath, `%/${item.name}`, item.name);
            const isStarred = starredRecord ? true : false;

            // 🐛 Debug log - will be removed after fix confirmed
            if (isStarred) {
                console.log(`⭐ [Starred] Match: user=${req.user.id}, file="${item.name}"`);
            }
            // Log first file of each request to verify user ID
            if (items.indexOf(item) === 0) {
                const userStarred = db.prepare('SELECT file_path FROM starred_files WHERE user_id = ?').all(req.user.id);
                console.log(`📋 [Starred Check] User=${req.user.id}, Starred count=${userStarred.length}, First file path="${itemPath}"`);
            }

            return {
                name: item.name,
                isDirectory: item.isDirectory(),
                path: itemPath,
                size: size,
                mtime: stats.mtime,
                access_count: dbStats ? dbStats.access_count : 0,
                uploader: dbStats ? dbStats.uploader : 'unknown',
                starred: isStarred
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
        db.prepare('INSERT OR REPLACE INTO file_stats (path, uploader_id) VALUES (?, ?)').run(targetPath.normalize('NFC'), req.user.id);
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

            const items = fs.readdirSync(fullPath).filter(name => !name.startsWith('.'));

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
            return nodes;
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

// Placeholder for a single vocabulary fetch endpoint, inferred from the provided snippet
// This block was not fully provided in the instruction, but its error handling and
// the subsequent batch endpoint suggest its presence.
// Assuming a structure like:
// app.get('/api/vocabulary/:id', (req, res) => {
//     try {
//         const { id } = req.params;
//         let sql = 'SELECT data FROM vocabulary WHERE id = ?';
//         const params = [id];
//
//         const row = db.prepare(sql).get(params);
//
//         if (!row) {
//              return res.status(404).json({ error: 'No words found' });
//         }
//
//         let wordEntry = JSON.parse(row.data);
//         res.json(wordEntry);
//     } catch (err) {
//         console.error('[Vocabulary] Error:', err);
//         res.status(500).json({ error: err.message });
//     }
// });

// The provided snippet starts here, assuming it's part of a vocabulary endpoint
// The `const row = db.prepare(sql).get(params);` line seems to be a fragment
// from a single item fetch, which is then followed by the batch fetch.
// To make the code syntactically correct, I'm placing the batch endpoint directly.
// If there was an intention to add a single vocabulary endpoint, it would need its full definition.

// Batch Vocabulary Fetch (Optimized for Updates)
// Duplicate route removed

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

// Rename file/folder
app.post('/api/files/rename', authenticate, async (req, res) => {
    const { path: filePath, newName } = req.body;
    if (!filePath || !newName) {
        return res.status(400).json({ error: 'Path and newName required' });
    }

    // Validate newName (no path separators)
    if (newName.includes('/') || newName.includes('\\')) {
        return res.status(400).json({ error: 'Invalid name: contains path separator' });
    }

    // Check permission
    if (!hasPermission(req.user, filePath, 'Full') && !hasPermission(req.user, filePath, 'Contributor')) {
        return res.status(403).json({ error: 'No permission to rename this file' });
    }

    // For Contributor, check ownership
    if (!hasPermission(req.user, filePath, 'Full')) {
        const fileStat = db.prepare('SELECT uploader_id FROM file_stats WHERE path = ?').get(filePath);
        if (!fileStat || fileStat.uploader_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only rename files you uploaded' });
        }
    }

    try {
        const oldFullPath = path.join(DISK_A, filePath);
        const parentDir = path.dirname(filePath);
        const newSubPath = path.join(parentDir, newName);
        const newFullPath = path.join(DISK_A, newSubPath);

        // Check if source exists
        if (!await fs.pathExists(oldFullPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if target already exists
        if (await fs.pathExists(newFullPath)) {
            return res.status(409).json({ error: 'A file with that name already exists' });
        }

        // Perform rename
        await fs.rename(oldFullPath, newFullPath);

        // Update database records
        db.prepare('UPDATE file_stats SET path = ? WHERE path = ?').run(newSubPath, filePath);
        db.prepare('UPDATE access_logs SET path = ? WHERE path = ?').run(newSubPath, filePath);
        db.prepare('UPDATE starred_files SET file_path = ? WHERE file_path = ?').run(newSubPath, filePath);
        db.prepare('UPDATE share_links SET file_path = ? WHERE file_path = ?').run(newSubPath, filePath);

        res.json({ success: true, newPath: newSubPath });
    } catch (err) {
        console.error('[Rename] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Copy file/folder
app.post('/api/files/copy', authenticate, async (req, res) => {
    const { sourcePath, targetDir } = req.body;
    if (!sourcePath || !targetDir) {
        return res.status(400).json({ error: 'sourcePath and targetDir required' });
    }

    // Check read permission on source
    if (!hasPermission(req.user, sourcePath, 'Reader') &&
        !hasPermission(req.user, sourcePath, 'Contributor') &&
        !hasPermission(req.user, sourcePath, 'Full')) {
        return res.status(403).json({ error: 'No permission to read source file' });
    }

    // Check write permission on target
    if (!hasPermission(req.user, targetDir, 'Full') && !hasPermission(req.user, targetDir, 'Contributor')) {
        return res.status(403).json({ error: 'No write permission for target directory' });
    }

    try {
        const sourceFullPath = path.join(DISK_A, sourcePath);
        const fileName = path.basename(sourcePath);
        let targetFileName = fileName;
        let targetFullPath = path.join(DISK_A, targetDir, targetFileName);

        // Check if source exists
        if (!await fs.pathExists(sourceFullPath)) {
            return res.status(404).json({ error: 'Source file not found' });
        }

        // Handle name conflict - add (copy) suffix
        let copyNum = 0;
        while (await fs.pathExists(targetFullPath)) {
            copyNum++;
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            targetFileName = `${base} (copy${copyNum > 1 ? ' ' + copyNum : ''})${ext}`;
            targetFullPath = path.join(DISK_A, targetDir, targetFileName);
        }

        // Perform copy
        await fs.copy(sourceFullPath, targetFullPath);

        // Copy file_stats if exists (with new uploader)
        const sourceStat = db.prepare('SELECT * FROM file_stats WHERE path = ?').get(sourcePath);
        const newPath = path.join(targetDir, targetFileName);

        if (sourceStat) {
            db.prepare(`
                INSERT OR REPLACE INTO file_stats (path, access_count, uploader_id, last_accessed, size)
                VALUES (?, 0, ?, datetime('now'), ?)
            `).run(newPath, req.user.id, sourceStat.size);
        }

        res.json({ success: true, newPath: newPath });
    } catch (err) {
        console.error('[Copy] Error:', err);
        res.status(500).json({ error: err.message });
    }
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

// Recycle Bin Thumbnail API - serves thumbnails for files in recycle bin
app.get('/api/recycle-bin/thumbnail', authenticate, async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) {
            return res.status(400).json({ error: 'Missing path parameter' });
        }

        const decodedPath = decodeURIComponent(filePath);
        const size = parseInt(req.query.size) || 200;

        // Validate file extension
        const ext = path.extname(decodedPath).toLowerCase();
        const imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
        const ffmpegFormats = ['.mov', '.mp4', '.m4v', '.avi', '.mkv', '.hevc', '.heic', '.heif'];
        const supportedFormats = [...imageFormats, ...ffmpegFormats];

        if (!supportedFormats.includes(ext)) {
            return res.status(400).json({ error: 'Unsupported format for thumbnails' });
        }

        // Use RECYCLE_DIR instead of DISK_A
        const sourcePath = path.join(RECYCLE_DIR, decodedPath);
        if (!fs.existsSync(sourcePath)) {
            return res.status(404).json({ error: 'File not found in recycle bin' });
        }

        // Generate cache key with recycle prefix
        const cacheKey = `recycle_${decodedPath.replace(/[\/\\]/g, '_')}_${size}.webp`;
        const cachePath = path.join(THUMB_DIR, cacheKey);

        // Check cache
        if (fs.existsSync(cachePath)) {
            try {
                const sourceStat = fs.statSync(sourcePath);
                const cacheStat = fs.statSync(cachePath);
                if (cacheStat.size > 0 && cacheStat.mtime > sourceStat.mtime) {
                    const cacheData = await fs.readFile(cachePath);
                    res.set('Cache-Control', 'public, max-age=604800');
                    res.set('Content-Type', 'image/webp');
                    return res.send(cacheData);
                }
            } catch (err) {
                // Continue to regeneration
            }
        }

        // Generate thumbnail
        if (imageFormats.includes(ext)) {
            // Use sharp for standard images
            const sharp = require('sharp');
            const thumbBuffer = await sharp(sourcePath)
                .resize(size, size, { fit: 'cover', position: 'center' })
                .webp({ quality: 75 })
                .toBuffer();

            await fs.writeFile(cachePath, thumbBuffer);
            res.set('Cache-Control', 'public, max-age=604800');
            res.set('Content-Type', 'image/webp');
            return res.send(thumbBuffer);
        } else {
            // Use ffmpeg for videos/HEIC
            const { spawn } = require('child_process');
            const tempPath = path.join(THUMB_DIR, `temp_${Date.now()}.jpg`);

            await new Promise((resolve, reject) => {
                const ffmpeg = spawn('ffmpeg', [
                    '-i', sourcePath,
                    '-ss', '00:00:01',
                    '-vframes', '1',
                    '-vf', `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}`,
                    '-y', tempPath
                ]);
                ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error('ffmpeg failed')));
                ffmpeg.on('error', reject);
            });

            const sharp = require('sharp');
            const thumbBuffer = await sharp(tempPath).webp({ quality: 75 }).toBuffer();
            await fs.writeFile(cachePath, thumbBuffer);
            await fs.remove(tempPath);

            res.set('Cache-Control', 'public, max-age=604800');
            res.set('Content-Type', 'image/webp');
            return res.send(thumbBuffer);
        }
    } catch (err) {
        console.error('[Recycle Thumbnail Error]', err.message);
        res.status(500).json({ error: 'Failed to generate thumbnail' });
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

// Cleanup orphaned upload chunks (24 hours old)
async function cleanupOrphanedChunks() {
    console.log('🧹 Running orphaned chunks cleanup...');
    const chunksDir = path.join(DISK_A, '.chunks');

    if (!fs.existsSync(chunksDir)) {
        return;
    }

    try {
        const uploadDirs = await fs.readdir(chunksDir);
        const twentyFourHoursAgo = Date.now() - 24 * 3600 * 1000;
        let cleanedCount = 0;

        for (const uploadId of uploadDirs) {
            const uploadDir = path.join(chunksDir, uploadId);
            try {
                const stats = await fs.stat(uploadDir);
                // Delete if older than 24 hours
                if (stats.mtimeMs < twentyFourHoursAgo) {
                    await fs.remove(uploadDir);
                    cleanedCount++;
                    console.log(`🗑️ Cleaned orphaned chunks: ${uploadId}`);
                }
            } catch (e) {
                console.error(`❌ Failed to cleanup chunks ${uploadId}:`, e);
            }
        }

        if (cleanedCount > 0) {
            console.log(`✅ Cleaned ${cleanedCount} orphaned upload(s)`);
        }
    } catch (err) {
        console.error('[Chunk Cleanup] Error:', err);
    }
}

// Automatic cleanup
cleanupRecycleBin();
cleanupOrphanedChunks();
setInterval(cleanupRecycleBin, 24 * 3600 * 1000); // Daily
setInterval(cleanupOrphanedChunks, 6 * 3600 * 1000); // Every 6 hours

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
    maxAge: '0',  // Disabled for now to force cache refresh
    etag: true,
    lastModified: true
}));

// Serve knowledge base images (from fileserver Service directory)
app.use('/data/knowledge_images', express.static('/Volumes/fileserver/Service/Knowledge/Images', {
    maxAge: '1d',  // Cache for 1 day
    etag: true
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

// Update Share Collection
app.put('/api/share-collection/:id', authenticate, (req, res) => {
    try {
        const { password, expiresInDays, removePassword } = req.body;
        const shareId = req.params.id;

        // Verify ownership
        const share = db.prepare(`SELECT * FROM share_collections WHERE id = ? AND user_id = ?`).get(shareId, req.user.id);
        if (!share) return res.status(404).json({ error: 'Share collection not found' });

        // Build update query
        const updates = [];
        const values = [];

        if (removePassword) {
            updates.push('password = NULL');
        } else if (password) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            updates.push('password = ?');
            values.push(hashedPassword);
        }

        if (expiresInDays !== undefined) {
            if (expiresInDays === null || expiresInDays === -1) {
                updates.push('expires_at = NULL');
            } else {
                const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
                updates.push('expires_at = ?');
                values.push(expiresAt);
            }
        }

        if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

        values.push(shareId, req.user.id);
        db.prepare(`UPDATE share_collections SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

        res.json({ success: true });
    } catch (err) {
        console.error('[Share Collection] Error updating:', err);
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

// ==================== Product Issue Tracking API ====================

const ISSUE_ATTACHMENTS_DIR = path.join(__dirname, 'data/issue_attachments');
fs.ensureDirSync(ISSUE_ATTACHMENTS_DIR);
const issueUpload = multer({ dest: ISSUE_ATTACHMENTS_DIR });

// Generate Issue Number: ISS-YYYY-NNNN
function generateIssueNumber() {
    const year = new Date().getFullYear();
    const result = db.prepare(`
        SELECT COUNT(*) as count FROM issues 
        WHERE issue_number LIKE 'ISS-${year}-%'
    `).get();
    const seq = (result.count || 0) + 1;
    return `ISS-${year}-${String(seq).padStart(4, '0')}`;
}

// Permission check for issues
function canAccessIssue(user, issue) {
    if (user.role === 'Admin') return { read: true, write: true };

    // Lead can access all issues, write own department's
    if (user.role === 'Lead') {
        const creator = db.prepare('SELECT department_id FROM users WHERE id = ?').get(issue.created_by);
        const isOwnDept = creator && creator.department_id === user.department_id;
        return { read: true, write: isOwnDept || issue.assigned_to === user.id };
    }

    // Member can only access assigned or created issues
    const canAccess = issue.assigned_to === user.id || issue.created_by === user.id;
    return { read: canAccess, write: canAccess };
}

// --- Issues CRUD ---

// Get Issues List (with filtering & pagination)
app.get('/api/issues', authenticate, (req, res) => {
    try {
        const { status, category, source, severity, assigned_to, search, page = 1, limit = 20 } = req.query;
        const user = req.user;

        let whereConditions = [];
        let params = [];

        // Role-based filtering
        if (user.role === 'Member') {
            whereConditions.push('(i.assigned_to = ? OR i.created_by = ?)');
            params.push(user.id, user.id);
        }

        // Filter conditions
        if (status && status !== 'all') {
            whereConditions.push('i.status = ?');
            params.push(status);
        }
        if (category && category !== 'all') {
            whereConditions.push('i.issue_category = ?');
            params.push(category);
        }
        if (source && source !== 'all') {
            whereConditions.push('i.issue_source = ?');
            params.push(source);
        }
        if (severity && severity !== 'all') {
            whereConditions.push('i.severity = ?');
            params.push(severity);
        }
        if (assigned_to === 'me') {
            whereConditions.push('i.assigned_to = ?');
            params.push(user.id);
        } else if (assigned_to && assigned_to !== 'all') {
            whereConditions.push('i.assigned_to = ?');
            params.push(parseInt(assigned_to));
        }
        if (search) {
            whereConditions.push('(i.issue_number LIKE ? OR i.title LIKE ? OR c.customer_name LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Count total
        const countSql = `
            SELECT COUNT(*) as total FROM issues i
            LEFT JOIN accounts acc ON i.account_id = acc.id
            ${whereClause}
        `;
        const total = db.prepare(countSql).get(...params).total;

        // Get issues
        const sql = `
            SELECT 
                i.*,
                p.model_name as product_model,
                p.serial_number as product_serial,
                acc.name as customer_name,
                acc.account_type as customer_type,
                creator.username as created_by_name,
                assignee.username as assigned_to_name
            FROM issues i
            LEFT JOIN products p ON i.product_id = p.id
            LEFT JOIN accounts acc ON i.account_id = acc.id
            LEFT JOIN users creator ON i.created_by = creator.id
            LEFT JOIN users assignee ON i.assigned_to = assignee.id
            ${whereClause}
            ORDER BY i.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const issues = db.prepare(sql).all(...params, parseInt(limit), offset);

        res.json({
            issues,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('[Issues] List error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create Issue
app.post('/api/issues', authenticate, (req, res) => {
    try {
        const { product_id, account_id, issue_category, issue_source, title, description, severity } = req.body;

        if (!issue_category || !issue_source || !title || !description) {
            return res.status(400).json({ error: 'Missing required fields: issue_category, issue_source, title, description' });
        }

        const issue_number = generateIssueNumber();

        const result = db.prepare(`
            INSERT INTO issues (issue_number, product_id, account_id, issue_category, issue_source, title, description, severity, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            issue_number,
            product_id || null,
            account_id || null,
            issue_category,
            issue_source,
            title,
            description,
            severity || 'Medium',
            req.user.id
        );

        res.json({ success: true, issue_id: result.lastInsertRowid, issue_number });
    } catch (err) {
        console.error('[Issues] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get Issue Detail
app.get('/api/issues/:id', authenticate, (req, res) => {
    try {
        const issue = db.prepare(`
            SELECT 
                i.*,
                p.product_line, p.model_name, p.serial_number, p.firmware_version, p.production_batch,
                acc.account_type as customer_type, acc.name as customer_name,
                ct.name as contact_person, ct.phone, ct.email,
                acc.country, acc.province, acc.city,
                creator.username as created_by_name,
                assignee.username as assigned_to_name,
                closer.username as closed_by_name
            FROM issues i
            LEFT JOIN products p ON i.product_id = p.id
            LEFT JOIN accounts acc ON i.account_id = acc.id
            LEFT JOIN contacts ct ON i.contact_id = ct.id
            LEFT JOIN users creator ON i.created_by = creator.id
            LEFT JOIN users assignee ON i.assigned_to = assignee.id
            LEFT JOIN users closer ON i.closed_by = closer.id
            WHERE i.id = ?
        `).get(req.params.id);

        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        const access = canAccessIssue(req.user, issue);
        if (!access.read) {
            return res.status(403).json({ error: 'No permission to view this issue' });
        }

        // Get comments
        const comments = db.prepare(`
            SELECT ic.*, u.username as user_name
            FROM issue_comments ic
            LEFT JOIN users u ON ic.user_id = u.id
            WHERE ic.issue_id = ?
            ORDER BY ic.created_at ASC
        `).all(req.params.id);

        // Get attachments
        const attachments = db.prepare(`
            SELECT ia.*, u.username as uploaded_by_name
            FROM issue_attachments ia
            LEFT JOIN users u ON ia.uploaded_by = u.id
            WHERE ia.issue_id = ?
            ORDER BY ia.uploaded_at DESC
        `).all(req.params.id);

        res.json({
            issue,
            comments,
            attachments,
            canWrite: access.write
        });
    } catch (err) {
        console.error('[Issues] Detail error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update Issue
app.put('/api/issues/:id', authenticate, (req, res) => {
    try {
        const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        const access = canAccessIssue(req.user, issue);
        if (!access.write) {
            return res.status(403).json({ error: 'No permission to edit this issue' });
        }

        const { title, description, severity, status, resolution } = req.body;
        const updates = [];
        const params = [];

        if (title !== undefined) { updates.push('title = ?'); params.push(title); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (severity !== undefined) { updates.push('severity = ?'); params.push(severity); }
        if (resolution !== undefined) { updates.push('resolution = ?'); params.push(resolution); }

        // Status change with timestamp updates
        if (status !== undefined && status !== issue.status) {
            updates.push('status = ?');
            params.push(status);

            if (status === 'Closed') {
                updates.push('closed_at = CURRENT_TIMESTAMP', 'closed_by = ?');
                params.push(req.user.id);
            }
            if (status === 'AwaitingVerification' && !issue.resolved_at) {
                updates.push('resolved_at = CURRENT_TIMESTAMP');
            }

            // Log status change
            db.prepare(`
                INSERT INTO issue_comments (issue_id, user_id, comment_type, content)
                VALUES (?, ?, 'StatusChange', ?)
            `).run(req.params.id, req.user.id, `Status changed from ${issue.status} to ${status}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        db.prepare(`UPDATE issues SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        res.json({ success: true });
    } catch (err) {
        console.error('[Issues] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Assign Issue
app.post('/api/issues/:id/assign', authenticate, (req, res) => {
    try {
        if (req.user.role === 'Member') {
            return res.status(403).json({ error: 'Only Admin or Lead can assign issues' });
        }

        const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        const { assigned_to } = req.body;
        const assignee = db.prepare('SELECT id, username FROM users WHERE id = ?').get(assigned_to);
        if (!assignee) {
            return res.status(400).json({ error: 'Invalid assignee' });
        }

        const newStatus = issue.status === 'Pending' ? 'Assigned' : issue.status;

        db.prepare(`
            UPDATE issues SET assigned_to = ?, assigned_at = CURRENT_TIMESTAMP, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(assigned_to, newStatus, req.params.id);

        // Log assignment
        db.prepare(`
            INSERT INTO issue_comments (issue_id, user_id, comment_type, content)
            VALUES (?, ?, 'Assignment', ?)
        `).run(req.params.id, req.user.id, `Assigned to ${assignee.username}`);

        res.json({ success: true });
    } catch (err) {
        console.error('[Issues] Assign error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add Comment
app.post('/api/issues/:id/comments', authenticate, (req, res) => {
    try {
        const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        const access = canAccessIssue(req.user, issue);
        if (!access.read) {
            return res.status(403).json({ error: 'No permission to comment on this issue' });
        }

        const { content, is_internal } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        const result = db.prepare(`
            INSERT INTO issue_comments (issue_id, user_id, content, is_internal)
            VALUES (?, ?, ?, ?)
        `).run(req.params.id, req.user.id, content, is_internal ? 1 : 0);

        // Update issue timestamp
        db.prepare('UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

        res.json({ success: true, comment_id: result.lastInsertRowid });
    } catch (err) {
        console.error('[Issues] Comment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Upload Attachment
app.post('/api/issues/:id/attachments', authenticate, issueUpload.array('files', 10), async (req, res) => {
    try {
        const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        const access = canAccessIssue(req.user, issue);
        if (!access.write) {
            return res.status(403).json({ error: 'No permission to upload attachments' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const insertedIds = [];
        for (const file of req.files) {
            const result = db.prepare(`
                INSERT INTO issue_attachments (issue_id, file_name, file_path, file_size, file_type, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(req.params.id, file.originalname, file.filename, file.size, file.mimetype, req.user.id);
            insertedIds.push(result.lastInsertRowid);
        }

        res.json({ success: true, attachment_ids: insertedIds });
    } catch (err) {
        console.error('[Issues] Upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Download Attachment
app.get('/api/issues/attachments/:attachmentId', authenticate, (req, res) => {
    try {
        const attachment = db.prepare(`
            SELECT ia.*, i.created_by, i.assigned_to 
            FROM issue_attachments ia
            JOIN issues i ON ia.issue_id = i.id
            WHERE ia.id = ?
        `).get(req.params.attachmentId);

        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        const issue = { created_by: attachment.created_by, assigned_to: attachment.assigned_to };
        const access = canAccessIssue(req.user, issue);
        if (!access.read) {
            return res.status(403).json({ error: 'No permission to download this attachment' });
        }

        const filePath = path.join(ISSUE_ATTACHMENTS_DIR, attachment.file_path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on disk' });
        }

        res.download(filePath, attachment.file_name);
    } catch (err) {
        console.error('[Issues] Download attachment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Issue (Admin only)
app.delete('/api/issues/:id', authenticate, (req, res) => {
    try {
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Only Admin can delete issues' });
        }

        const result = db.prepare('DELETE FROM issues WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[Issues] Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Products CRUD ---

// Get Products List
app.get('/api/products', authenticate, (req, res) => {
    try {
        const { product_line, search, page = 1, limit = 50 } = req.query;

        let whereConditions = [];
        let params = [];

        if (product_line && product_line !== 'all') {
            whereConditions.push('product_line = ?');
            params.push(product_line);
        }
        if (search) {
            whereConditions.push('(model_name LIKE ? OR serial_number LIKE ? OR production_batch LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const total = db.prepare(`SELECT COUNT(*) as total FROM products ${whereClause}`).get(...params).total;
        const products = db.prepare(`
            SELECT * FROM products ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        res.json({ products, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error('[Products] List error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create Product
app.post('/api/products', authenticate, (req, res) => {
    try {
        const { product_line, model_name, serial_number, firmware_version, production_batch, production_date, notes } = req.body;

        if (!product_line || !model_name) {
            return res.status(400).json({ error: 'product_line and model_name are required' });
        }

        const result = db.prepare(`
            INSERT INTO products (product_line, model_name, serial_number, firmware_version, production_batch, production_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(product_line, model_name, serial_number || null, firmware_version || null, production_batch || null, production_date || null, notes || null);

        res.json({ success: true, product_id: result.lastInsertRowid });
    } catch (err) {
        console.error('[Products] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get Product Detail (with related issues)
app.get('/api/products/:id', authenticate, (req, res) => {
    try {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const relatedIssues = db.prepare(`
            SELECT id, issue_number, title, status, severity, created_at
            FROM issues WHERE product_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        `).all(req.params.id);

        res.json({ product, related_issues: relatedIssues });
    } catch (err) {
        console.error('[Products] Detail error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update Product
app.put('/api/products/:id', authenticate, (req, res) => {
    try {
        const { product_line, model_name, serial_number, firmware_version, production_batch, production_date, notes } = req.body;

        const updates = [];
        const params = [];

        if (product_line !== undefined) { updates.push('product_line = ?'); params.push(product_line); }
        if (model_name !== undefined) { updates.push('model_name = ?'); params.push(model_name); }
        if (serial_number !== undefined) { updates.push('serial_number = ?'); params.push(serial_number); }
        if (firmware_version !== undefined) { updates.push('firmware_version = ?'); params.push(firmware_version); }
        if (production_batch !== undefined) { updates.push('production_batch = ?'); params.push(production_batch); }
        if (production_date !== undefined) { updates.push('production_date = ?'); params.push(production_date); }
        if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        const result = db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[Products] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Customers CRUD (v1 API) ---

// GET /api/v1/customers - List customers with account_type support (Dealer/Customer)
app.get('/api/v1/customers', authenticate, (req, res) => {
    try {
        const { type, account_type, name, page = 1, page_size = 50 } = req.query;
        const limit = parseInt(page_size) || 50;
        const offset = (parseInt(page) - 1) * limit;

        let sql = `SELECT * FROM customers WHERE 1=1`;
        const params = [];

        if (req.user.role === 'Dealer') {
            sql += ` AND (parent_dealer_id = ? OR customer_type = 'EndUser' AND parent_dealer_id = ?)`;
            params.push(req.user.dealer_id, req.user.dealer_id);
        }

        if (account_type === 'Dealer') {
            // Query Accounts Table for dealer list (new architecture)
            let dealerSql = `
                SELECT 
                    a.id, 
                    a.name as customer_name, 
                    'Dealer' as customer_type,
                    c.name as contact_person, 
                    c.phone as phone, 
                    c.email as email,
                    a.country, NULL as province, a.city, 
                    a.dealer_code as company_name, 
                    a.notes, 
                    'Dealer' as account_type,
                    a.service_tier,
                    a.dealer_level,
                    a.is_active,
                    a.created_at
                FROM accounts a
                LEFT JOIN contacts c ON c.account_id = a.id AND (c.is_primary = 1 OR c.status = 'PRIMARY')
                WHERE a.account_type = 'DEALER'
            `;
            const dealerParams = [];

            if (name) {
                dealerSql += ` AND (a.name LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)`;
                const like = `%${name}%`;
                dealerParams.push(like, like, like, like);
            }

            dealerSql += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
            dealerParams.push(limit, offset);

            const list = db.prepare(dealerSql).all(...dealerParams);

            let dealerCountSql = `SELECT COUNT(*) as total FROM accounts WHERE account_type = 'DEALER'`;
            const dealerCountParams = [];
            if (name) {
                dealerCountSql += ` AND (name LIKE ? OR EXISTS (SELECT 1 FROM contacts c WHERE c.account_id = accounts.id AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)))`;
                const like = `%${name}%`;
                dealerCountParams.push(like, like, like, like);
            }
            const total = db.prepare(dealerCountSql).get(...dealerCountParams).total;

            return res.json({ success: true, data: { list, total, page: parseInt(page), page_size: limit } });
        }

        // Normal Customer Logic (EndUser)
        if (type) {
            sql += ` AND customer_type = ?`;
            params.push(type);
        }

        if (account_type) {
            if (account_type === 'Customer') {
                sql += ` AND customer_type = 'EndUser'`;
            } else {
                sql += ` AND customer_type = ?`;
                params.push(account_type);
            }
        }

        if (req.user.role === 'Dealer') {
            if (!req.user.dealer_id) {
                sql += ` AND 1=0`;
            } else {
                sql += ` AND parent_dealer_id = ?`;
                params.push(req.user.dealer_id);
            }
        }

        if (name) {
            sql += ` AND (customer_name LIKE ? OR contact_person LIKE ? OR phone LIKE ?)`;
            const like = `%${name}%`;
            params.push(like, like, like);
        }

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const list = db.prepare(sql).all(...params);

        // Get Total Count
        let countSql = `SELECT COUNT(*) as total FROM customers WHERE 1=1`;
        const countParams = [];
        if (type) { countSql += ` AND customer_type = ?`; countParams.push(type); }
        if (account_type) {
            if (account_type === 'Customer') { countSql += ` AND customer_type = 'EndUser'`; }
            else { countSql += ` AND customer_type = ?`; countParams.push(account_type); }
        }
        if (req.user.role === 'Dealer') {
            if (!req.user.dealer_id) { countSql += ` AND 1=0`; }
            else { countSql += ` AND parent_dealer_id = ?`; countParams.push(req.user.dealer_id); }
        }
        if (name) {
            countSql += ` AND (customer_name LIKE ? OR contact_person LIKE ? OR phone LIKE ?)`;
            const like = `%${name}%`;
            countParams.push(like, like, like);
        }
        const total = db.prepare(countSql).get(...countParams).total;

        res.json({ success: true, data: { list, total, page: parseInt(page), page_size: limit } });
    } catch (err) {
        console.error('[Customers] List Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/customers - Create customer
app.post('/api/v1/customers', authenticate, (req, res) => {
    try {
        const {
            customer_type, customer_name, contact_person, phone, email,
            country, province, city, company_name, notes,
            account_type, service_tier, industry_tags
        } = req.body;

        if (!customer_name || !customer_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        let parentDealerId = null;
        let finalCustomerType = customer_type;

        if (req.user.role === 'Dealer') {
            if (!req.user.dealer_id) return res.status(403).json({ error: 'Dealer account not linked' });
            parentDealerId = req.user.dealer_id;
            finalCustomerType = 'EndUser';
        }

        const result = db.prepare(`
            INSERT INTO customers (
                customer_type, customer_name, contact_person, phone, email,
                country, province, city, company_name, notes,
                account_type, service_tier, industry_tags, parent_dealer_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            finalCustomerType, customer_name, contact_person || null, phone || null, email || null,
            country || null, province || null, city || null, company_name || null, notes || null,
            account_type || 'EndUser', service_tier || 'STANDARD', industry_tags || null, parentDealerId
        );

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        console.error('[Customers] Create Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/customers/:id
app.get('/api/v1/customers/:id', authenticate, (req, res) => {
    try {
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json({ success: true, data: customer });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/dealers/:id - Get dealer detail (Legacy 兼容，查询accounts表)
app.get('/api/v1/dealers/:id', authenticate, (req, res) => {
    try {
        const dealer = db.prepare('SELECT * FROM accounts WHERE id = ? AND account_type = ?').get(req.params.id, 'DEALER');
        if (!dealer) return res.status(404).json({ error: 'Dealer not found' });
        res.json({ success: true, data: dealer });
    } catch (err) {
        console.error('[Dealers] Get Detail Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/v1/customers/:id
app.put('/api/v1/customers/:id', authenticate, (req, res) => {
    try {
        const {
            customer_type, customer_name, contact_person, phone, email,
            country, province, city, company_name, notes,
            account_type, service_tier, industry_tags
        } = req.body;

        const result = db.prepare(`
            UPDATE customers SET 
                customer_type = COALESCE(?, customer_type),
                customer_name = COALESCE(?, customer_name),
                contact_person = COALESCE(?, contact_person),
                phone = COALESCE(?, phone),
                email = COALESCE(?, email),
                country = COALESCE(?, country),
                province = COALESCE(?, province),
                city = COALESCE(?, city),
                company_name = COALESCE(?, company_name),
                notes = COALESCE(?, notes),
                account_type = COALESCE(?, account_type),
                service_tier = COALESCE(?, service_tier),
                industry_tags = COALESCE(?, industry_tags),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            customer_type, customer_name, contact_person, phone, email,
            country, province, city, company_name, notes,
            account_type, service_tier, industry_tags,
            req.params.id
        );

        if (result.changes === 0) return res.status(404).json({ error: 'Customer not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('[Customers] Update Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/v1/customers/:id
app.delete('/api/v1/customers/:id', authenticate, (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
    try {
        const result = db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Customer not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('[Customers] Delete Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- [DEPRECATED] Legacy Customers CRUD ---
// customers 表已废弃，以下 API 保留仅作为历史参考
// 新的客户管理请使用 /api/v1/accounts API
/*
// Get Customers List
app.get('/api/customers', authenticate, (req, res) => {
    try {
        const { customer_type, country, search, page = 1, limit = 50 } = req.query;

        let whereConditions = [];
        let params = [];

        if (customer_type && customer_type !== 'all') {
            whereConditions.push('customer_type = ?');
            params.push(customer_type);
        }
        if (country) {
            whereConditions.push('country = ?');
            params.push(country);
        }
        if (search) {
            whereConditions.push('(customer_name LIKE ? OR contact_person LIKE ? OR company_name LIKE ? OR phone LIKE ? OR email LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const total = db.prepare(`SELECT COUNT(*) as total FROM customers ${whereClause}`).get(...params).total;
        const customers = db.prepare(`
            SELECT * FROM customers ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        res.json({ customers, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error('[Customers] List error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create Customer
app.post('/api/customers', authenticate, (req, res) => {
    try {
        const { customer_type, customer_name, contact_person, phone, email, country, province, city, company_name, notes } = req.body;

        if (!customer_type || !customer_name) {
            return res.status(400).json({ error: 'customer_type and customer_name are required' });
        }

        const result = db.prepare(`
            INSERT INTO customers (customer_type, customer_name, contact_person, phone, email, country, province, city, company_name, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(customer_type, customer_name, contact_person || null, phone || null, email || null, country || null, province || null, city || null, company_name || null, notes || null);

        res.json({ success: true, customer_id: result.lastInsertRowid });
    } catch (err) {
        console.error('[Customers] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get Customer Detail (with related issues)
app.get('/api/customers/:id', authenticate, (req, res) => {
    try {
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const relatedIssues = db.prepare(`
            SELECT id, issue_number, title, status, severity, created_at
            FROM issues WHERE account_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        `).all(req.params.id);

        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as resolved
            FROM issues WHERE account_id = ?
        `).get(req.params.id);

        res.json({ customer, related_issues: relatedIssues, issue_statistics: stats });
    } catch (err) {
        console.error('[Customers] Detail error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update Customer
app.put('/api/customers/:id', authenticate, (req, res) => {
    try {
        const { customer_type, customer_name, contact_person, phone, email, country, province, city, company_name, notes } = req.body;

        const updates = [];
        const params = [];

        if (customer_type !== undefined) { updates.push('customer_type = ?'); params.push(customer_type); }
        if (customer_name !== undefined) { updates.push('customer_name = ?'); params.push(customer_name); }
        if (contact_person !== undefined) { updates.push('contact_person = ?'); params.push(contact_person); }
        if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
        if (email !== undefined) { updates.push('email = ?'); params.push(email); }
        if (country !== undefined) { updates.push('country = ?'); params.push(country); }
        if (province !== undefined) { updates.push('province = ?'); params.push(province); }
        if (city !== undefined) { updates.push('city = ?'); params.push(city); }
        if (company_name !== undefined) { updates.push('company_name = ?'); params.push(company_name); }
        if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        const result = db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[Customers] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});
*/

// --- Statistics API ---

// Overview Statistics
app.get('/api/issues/statistics/overview', authenticate, (req, res) => {
    try {
        const byStatus = db.prepare(`
            SELECT status, COUNT(*) as count FROM issues GROUP BY status
        `).all();

        const byCategory = db.prepare(`
            SELECT issue_category, COUNT(*) as count FROM issues GROUP BY issue_category
        `).all();

        const total = db.prepare('SELECT COUNT(*) as count FROM issues').get().count;
        const closed = db.prepare("SELECT COUNT(*) as count FROM issues WHERE status = 'Closed'").get().count;

        // Average resolution time (in hours)
        const avgTime = db.prepare(`
            SELECT AVG((julianday(closed_at) - julianday(created_at)) * 24) as avg_hours
            FROM issues WHERE closed_at IS NOT NULL
        `).get();

        res.json({
            total_issues: total,
            by_status: Object.fromEntries(byStatus.map(s => [s.status, s.count])),
            by_category: Object.fromEntries(byCategory.map(c => [c.issue_category, c.count])),
            resolution_rate: total > 0 ? Math.round((closed / total) * 100) : 0,
            avg_resolution_time: avgTime.avg_hours ? Math.round(avgTime.avg_hours) : null
        });
    } catch (err) {
        console.error('[Statistics] Overview error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== Service Module ====================
// Initialize the Service module for product service closure management
try {
    const { initService } = require('./service');
    initService(app, db, {
        attachmentsDir: ISSUE_ATTACHMENTS_DIR,
        serviceUpload: serviceUpload,
        authenticate,
        multer
    });
    console.log('[Init] Service module loaded successfully');
} catch (err) {
    console.error('[Init] Failed to load Service module:', err.message);
}

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
