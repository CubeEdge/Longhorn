CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
  , department_id INTEGER, created_at TEXT DEFAULT '2026-01-02 12:00:00', last_login TEXT);
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE shares (
    id TEXT PRIMARY KEY,
    path TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  , language TEXT DEFAULT 'zh');
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    folder_path TEXT,
    can_write INTEGER DEFAULT 0, access_type TEXT DEFAULT 'Read', expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, granted_by INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
CREATE TABLE departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );
CREATE TABLE file_stats (
    path TEXT PRIMARY KEY,
    uploader_id INTEGER,
    access_count INTEGER DEFAULT 0,
    last_access DATETIME, size INTEGER DEFAULT 0, uploaded_at DATETIME,
    FOREIGN KEY(uploader_id) REFERENCES users(id)
  );
CREATE TABLE access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT,
    user_id INTEGER,
    count INTEGER DEFAULT 0,
    last_access DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(path, user_id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
CREATE TABLE recycle_bin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    original_path TEXT,
    deleted_path TEXT,
    deletion_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    is_directory BOOLEAN
  );
CREATE TABLE starred_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            starred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, file_path),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
CREATE INDEX idx_starred_user ON starred_files(user_id);
CREATE TABLE share_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            share_token TEXT UNIQUE NOT NULL,
            password TEXT,
            expires_at DATETIME,
            access_count INTEGER DEFAULT 0,
            last_accessed DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, language TEXT DEFAULT 'zh',
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
CREATE INDEX idx_share_token ON share_links(share_token);
CREATE INDEX idx_share_user ON share_links(user_id);
CREATE TABLE share_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    name TEXT,
    password TEXT,
    expires_at DATETIME,
    access_count INTEGER DEFAULT 0,
    last_accessed DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, language TEXT DEFAULT 'zh',
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX idx_collection_token ON share_collections(token);
CREATE INDEX idx_collection_user ON share_collections(user_id);
CREATE TABLE share_collection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    is_directory BOOLEAN DEFAULT 0,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(collection_id) REFERENCES share_collections(id) ON DELETE CASCADE
);
CREATE INDEX idx_collection_items ON share_collection_items(collection_id);
