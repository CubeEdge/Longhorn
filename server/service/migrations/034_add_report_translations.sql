-- Migration: Add translation support for repair reports
-- Date: 2026-03-19
-- Description: Store AI translations and manual corrections for repair report content

-- ============================================
-- 1. Add translations column to repair_reports
-- ============================================
ALTER TABLE repair_reports ADD COLUMN translations TEXT;  -- JSON: { 'zh-CN': {...}, 'en-US': {...}, 'ja-JP': {...}, 'de-DE': {...} }

-- ============================================
-- 2. Create translation cache table (for AI translation results)
-- ============================================
CREATE TABLE IF NOT EXISTS translation_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_text TEXT NOT NULL,
    source_lang TEXT NOT NULL,
    target_lang TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    model_used TEXT,  -- e.g., 'gpt-4', 'claude-3'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    use_count INTEGER DEFAULT 1,  -- track how many times this translation is used
    
    -- Unique constraint to avoid duplicate translations
    UNIQUE(source_text, source_lang, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_translation_lookup ON translation_cache(source_text, source_lang, target_lang);

-- ============================================
-- 3. Add translation audit log
-- ============================================
CREATE TABLE IF NOT EXISTS translation_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES repair_reports(id),
    field_name TEXT NOT NULL,  -- e.g., 'issue_description', 'repair_process'
    target_lang TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('ai_translated', 'manual_edited', 'approved')),
    
    -- Content snapshot
    ai_translation TEXT,
    manual_correction TEXT,
    
    -- Actor
    user_id INTEGER REFERENCES users(id),
    user_name TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_translation_audit_report ON translation_audit_log(report_id);
