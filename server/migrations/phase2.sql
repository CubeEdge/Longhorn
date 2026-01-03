-- Phase 2: Quick Access Features Database Migration

-- 星标文件表
CREATE TABLE IF NOT EXISTS starred_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    starred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, file_path),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 分享链接表
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

-- 索引
CREATE INDEX IF NOT EXISTS idx_starred_user ON starred_files(user_id);
CREATE INDEX IF NOT EXISTS idx_starred_path ON starred_files(file_path);
CREATE INDEX IF NOT EXISTS idx_share_token ON share_links(share_token);
CREATE INDEX IF NOT EXISTS idx_share_user ON share_links(user_id);
