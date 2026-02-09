-- 为knowledge_articles表添加来源字段
-- 用于记录知识文章的导入来源信息

-- 添加source_type字段（来源类型：Manual/PDF/URL/Text）
ALTER TABLE knowledge_articles ADD COLUMN source_type TEXT;

-- 添加source_reference字段（来源文件名或引用）
ALTER TABLE knowledge_articles ADD COLUMN source_reference TEXT;

-- 添加source_url字段（如果来源是网页）
ALTER TABLE knowledge_articles ADD COLUMN source_url TEXT;

-- 为查询优化添加索引
CREATE INDEX IF NOT EXISTS idx_knowledge_source_type ON knowledge_articles(source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_source_reference ON knowledge_articles(source_reference);
