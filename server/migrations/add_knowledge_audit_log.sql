-- 知识库操作审计日志表
-- 记录所有对知识库的写操作，供Admin追踪和审计

CREATE TABLE IF NOT EXISTS knowledge_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 操作信息
    operation TEXT NOT NULL, -- 'create', 'update', 'delete', 'import', 'publish', 'archive'
    operation_detail TEXT, -- 操作详情描述
    
    -- 文章信息
    article_id INTEGER, -- 关联的文章ID（删除后可能为NULL）
    article_title TEXT NOT NULL, -- 文章标题快照
    article_slug TEXT, -- 文章slug快照
    
    -- 分类信息
    category TEXT, -- 文章分类
    product_line TEXT, -- 产品线
    product_models TEXT, -- JSON数组：产品型号
    
    -- 变更内容
    changes_summary TEXT, -- 变更摘要（JSON格式）
    old_status TEXT, -- 旧状态
    new_status TEXT, -- 新状态
    
    -- 导入来源（仅导入操作）
    source_type TEXT, -- 'Manual', 'PDF', 'URL', 'Text'
    source_reference TEXT, -- 来源文件名或URL
    batch_id TEXT, -- 批量操作ID（批量导入时相同）
    
    -- 操作人信息
    user_id INTEGER NOT NULL, -- 操作人ID
    user_name TEXT NOT NULL, -- 操作人姓名快照
    user_role TEXT, -- 操作人角色快照
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(article_id) REFERENCES knowledge_articles(id) ON DELETE SET NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_audit_operation ON knowledge_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_article ON knowledge_audit_log(article_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON knowledge_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON knowledge_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_batch ON knowledge_audit_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_audit_product ON knowledge_audit_log(product_line);
