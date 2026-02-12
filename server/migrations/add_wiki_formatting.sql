-- Wiki Article Formatting & Chapter Aggregation Enhancement
-- Version: 1.0.0
-- Date: 2026-02-12
-- Purpose: Support AI-assisted article formatting, draft preview, and chapter aggregation

-- ============================================
-- 1. Add formatting fields to knowledge_articles
-- ============================================

-- Formatted content (AI/human optimized draft)
ALTER TABLE knowledge_articles ADD COLUMN formatted_content TEXT;

-- Format status: none(default) / draft / published
ALTER TABLE knowledge_articles ADD COLUMN format_status TEXT DEFAULT 'none';

-- Who formatted: 'ai' / 'human' / 'external'
ALTER TABLE knowledge_articles ADD COLUMN formatted_by TEXT;

-- When formatted
ALTER TABLE knowledge_articles ADD COLUMN formatted_at DATETIME;

-- Chapter hierarchy info (parsed from title)
ALTER TABLE knowledge_articles ADD COLUMN chapter_number INTEGER;
ALTER TABLE knowledge_articles ADD COLUMN section_number INTEGER;

-- Parent chapter article ID (for sections like 2.1 -> 2)
ALTER TABLE knowledge_articles ADD COLUMN parent_article_id INTEGER;

-- Image layout metadata (JSON)
-- Example: {"mode":"auto","maxWidth":720,"rules":[{"imageIndex":0,"align":"center","width":"80%"}]}
ALTER TABLE knowledge_articles ADD COLUMN image_layout_meta TEXT;

-- Short summary for chapter card display (1-2 sentences)
ALTER TABLE knowledge_articles ADD COLUMN short_summary TEXT;

-- ============================================
-- 2. Indexes for chapter navigation
-- ============================================

CREATE INDEX IF NOT EXISTS idx_knowledge_chapter ON knowledge_articles(product_line, product_models, chapter_number);
CREATE INDEX IF NOT EXISTS idx_knowledge_parent ON knowledge_articles(parent_article_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_format_status ON knowledge_articles(format_status);

-- ============================================
-- 3. Update existing articles with chapter info
-- ============================================

-- This will be handled by application logic during migration
-- The parseChapterNumber function will populate chapter_number and section_number
