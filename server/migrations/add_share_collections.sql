-- Share Collections Feature Migration
-- Creates tables for batch sharing functionality

-- Share Collections Table
CREATE TABLE IF NOT EXISTS share_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    name TEXT,
    password TEXT,
    expires_at DATETIME,
    access_count INTEGER DEFAULT 0,
    last_accessed DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_collection_token ON share_collections(token);
CREATE INDEX IF NOT EXISTS idx_collection_user ON share_collections(user_id);

-- Share Collection Items Table
CREATE TABLE IF NOT EXISTS share_collection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    is_directory BOOLEAN DEFAULT 0,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(collection_id) REFERENCES share_collections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collection_items ON share_collection_items(collection_id);
