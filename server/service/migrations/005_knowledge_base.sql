-- Knowledge Base System
-- Version: 0.3.0
-- Date: 2026-02-02
-- Phase 3: Knowledge base with visibility tiers

-- ============================================
-- 1. Knowledge Articles Table
-- ============================================

CREATE TABLE IF NOT EXISTS knowledge_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Basic Info
    title TEXT NOT NULL,
    slug TEXT UNIQUE, -- URL-friendly identifier
    summary TEXT, -- Brief description
    content TEXT NOT NULL, -- Full article content (Markdown supported)
    
    -- Classification
    category TEXT NOT NULL, -- FAQ/Troubleshooting/Manual/ReleaseNotes/Compatibility/Internal
    subcategory TEXT,
    tags TEXT, -- JSON array of tags
    
    -- Product Association
    product_line TEXT, -- Cinema/Eagle/Accessories/General
    product_models TEXT, -- JSON array of applicable models
    firmware_versions TEXT, -- JSON array of applicable versions
    
    -- Visibility Tiers (per PRD)
    visibility TEXT NOT NULL DEFAULT 'Internal', -- Public/Dealer/Internal/Department
    department_ids TEXT, -- JSON array of department IDs for Department visibility
    
    -- Status
    status TEXT DEFAULT 'Draft', -- Draft/Published/Archived
    published_at DATETIME,
    
    -- Metadata
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    
    -- Audit
    created_by INTEGER NOT NULL,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id)
);

-- Full-text search support
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_articles_fts USING fts5(
    title, summary, content, tags,
    content='knowledge_articles',
    content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS knowledge_articles_ai AFTER INSERT ON knowledge_articles BEGIN
    INSERT INTO knowledge_articles_fts(rowid, title, summary, content, tags) 
    VALUES (new.id, new.title, new.summary, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_articles_ad AFTER DELETE ON knowledge_articles BEGIN
    INSERT INTO knowledge_articles_fts(knowledge_articles_fts, rowid, title, summary, content, tags) 
    VALUES('delete', old.id, old.title, old.summary, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_articles_au AFTER UPDATE ON knowledge_articles BEGIN
    INSERT INTO knowledge_articles_fts(knowledge_articles_fts, rowid, title, summary, content, tags) 
    VALUES('delete', old.id, old.title, old.summary, old.content, old.tags);
    INSERT INTO knowledge_articles_fts(rowid, title, summary, content, tags) 
    VALUES (new.id, new.title, new.summary, new.content, new.tags);
END;

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_visibility ON knowledge_articles(visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_articles(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_product ON knowledge_articles(product_line);

-- ============================================
-- 2. Knowledge Article Versions (History)
-- ============================================

CREATE TABLE IF NOT EXISTS knowledge_article_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    change_summary TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_kav_article ON knowledge_article_versions(article_id);

-- ============================================
-- 3. Knowledge Article Links (Related Articles)
-- ============================================

CREATE TABLE IF NOT EXISTS knowledge_article_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_article_id INTEGER NOT NULL,
    target_article_id INTEGER NOT NULL,
    link_type TEXT DEFAULT 'Related', -- Related/SeeAlso/Prerequisite
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(source_article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE,
    FOREIGN KEY(target_article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE,
    UNIQUE(source_article_id, target_article_id)
);

-- ============================================
-- 4. Knowledge Article Feedback
-- ============================================

CREATE TABLE IF NOT EXISTS knowledge_article_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    is_helpful INTEGER NOT NULL, -- 1 = helpful, 0 = not helpful
    feedback_text TEXT,
    user_id INTEGER,
    user_type TEXT, -- Customer/Dealer/Employee
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kaf_article ON knowledge_article_feedback(article_id);

-- ============================================
-- 5. Compatibility Test Results
-- ============================================

CREATE TABLE IF NOT EXISTS compatibility_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Test Subject
    product_model TEXT NOT NULL,
    firmware_version TEXT,
    
    -- Compatibility Target
    target_type TEXT NOT NULL, -- Lens/Monitor/Recorder/Media/Accessory/Software
    target_brand TEXT NOT NULL,
    target_model TEXT NOT NULL,
    target_version TEXT, -- For software/firmware
    
    -- Test Results
    compatibility_status TEXT NOT NULL, -- Compatible/PartiallyCompatible/Incompatible/Untested
    test_date DATE,
    test_notes TEXT,
    known_issues TEXT, -- JSON array of known issues
    workarounds TEXT, -- JSON array of workarounds
    
    -- Documentation
    related_article_id INTEGER, -- Link to knowledge article with details
    
    -- Metadata
    tested_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(related_article_id) REFERENCES knowledge_articles(id),
    FOREIGN KEY(tested_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_compat_product ON compatibility_tests(product_model);
CREATE INDEX IF NOT EXISTS idx_compat_target ON compatibility_tests(target_type, target_brand);
CREATE INDEX IF NOT EXISTS idx_compat_status ON compatibility_tests(compatibility_status);

-- ============================================
-- 6. Extended System Dictionaries for Phase 3
-- ============================================

INSERT OR IGNORE INTO system_dictionaries (dict_type, dict_key, dict_value, sort_order) VALUES
-- Knowledge Categories
('knowledge_category', 'FAQ', '常见问题', 1),
('knowledge_category', 'Troubleshooting', '故障排除', 2),
('knowledge_category', 'Manual', '使用手册', 3),
('knowledge_category', 'ReleaseNotes', '发布说明', 4),
('knowledge_category', 'Compatibility', '兼容性', 5),
('knowledge_category', 'Internal', '内部文档', 6),

-- Knowledge Visibility
('knowledge_visibility', 'Public', '公开 (所有人可见)', 1),
('knowledge_visibility', 'Dealer', '经销商 (登录后可见)', 2),
('knowledge_visibility', 'Internal', '内部 (员工可见)', 3),
('knowledge_visibility', 'Department', '部门 (特定部门可见)', 4),

-- Product Lines
('product_line', 'Cinema', '电影机产品线', 1),
('product_line', 'Eagle', 'Eagle产品线', 2),
('product_line', 'Accessories', '配件', 3),
('product_line', 'General', '通用', 4),

-- Compatibility Target Types
('compat_target_type', 'Lens', '镜头', 1),
('compat_target_type', 'Monitor', '监视器', 2),
('compat_target_type', 'Recorder', '录机', 3),
('compat_target_type', 'Media', '存储介质', 4),
('compat_target_type', 'Accessory', '配件', 5),
('compat_target_type', 'Software', '软件', 6),

-- Compatibility Status
('compat_status', 'Compatible', '完全兼容', 1),
('compat_status', 'PartiallyCompatible', '部分兼容', 2),
('compat_status', 'Incompatible', '不兼容', 3),
('compat_status', 'Untested', '未测试', 4);
