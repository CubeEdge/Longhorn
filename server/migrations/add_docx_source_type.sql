-- 添加 DOCX 到 source_type 约束
-- 日期: 2026-02-09
-- 目的: 支持DOCX文档导入

-- 1. 创建新表（带更新的CHECK约束）
CREATE TABLE knowledge_articles_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Basic Info
    title TEXT NOT NULL,
    slug TEXT UNIQUE, -- URL-friendly identifier
    summary TEXT, -- Brief description
    content TEXT NOT NULL, -- Full article content (Markdown supported)
    
    -- Classification
    category TEXT NOT NULL,
    subcategory TEXT,
    tags TEXT, -- JSON array of tags
    
    -- Product Association
    product_line TEXT,
    product_models TEXT, -- JSON array of applicable models
    firmware_versions TEXT, -- JSON array of applicable versions
    
    -- Visibility Tiers (per PRD)
    visibility TEXT NOT NULL DEFAULT 'Internal',
    department_ids TEXT, -- JSON array of department IDs for Department visibility
    
    -- Status
    status TEXT DEFAULT 'Draft',
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
    
    -- Source tracking (更新的CHECK约束)
    source_type TEXT CHECK(source_type IN ('PDF', 'DOCX', 'URL', 'Text', 'Excel', 'Manual')),
    source_reference TEXT,
    source_url TEXT,
    
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id)
);

-- 2. 复制数据
INSERT INTO knowledge_articles_new 
SELECT * FROM knowledge_articles;

-- 3. 删除旧表
DROP TABLE knowledge_articles;

-- 4. 重命名新表
ALTER TABLE knowledge_articles_new RENAME TO knowledge_articles;

-- 5. 重建索引
CREATE INDEX idx_knowledge_category ON knowledge_articles(category);
CREATE INDEX idx_knowledge_visibility ON knowledge_articles(visibility);
CREATE INDEX idx_knowledge_status ON knowledge_articles(status);
CREATE INDEX idx_knowledge_product ON knowledge_articles(product_line);
CREATE INDEX idx_knowledge_source_type ON knowledge_articles(source_type);
CREATE INDEX idx_knowledge_source_reference ON knowledge_articles(source_reference);

-- 验证
SELECT COUNT(*) as total_articles FROM knowledge_articles;
