-- Advanced Search and Export
-- Version: 0.3.0
-- Date: 2026-02-02
-- Phase 2: Advanced query capabilities and Excel export

-- ============================================
-- 1. Saved Search Filters
-- ============================================

CREATE TABLE IF NOT EXISTS saved_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    filter_type TEXT NOT NULL DEFAULT 'issue', -- issue/service_record
    filter_config TEXT NOT NULL, -- JSON config of filter parameters
    is_public INTEGER DEFAULT 0, -- 1 = visible to all, 0 = personal
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_type ON saved_filters(filter_type);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(created_by);

-- ============================================
-- 2. Export History (for audit)
-- ============================================

CREATE TABLE IF NOT EXISTS export_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    export_type TEXT NOT NULL, -- issues/service_records/statistics
    filter_config TEXT, -- JSON of applied filters
    record_count INTEGER DEFAULT 0,
    file_name TEXT,
    file_size INTEGER,
    exported_by INTEGER NOT NULL,
    exported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(exported_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_export_history_user ON export_history(exported_by);
CREATE INDEX IF NOT EXISTS idx_export_history_date ON export_history(exported_at);

-- ============================================
-- 3. Search Analytics (for improving search)
-- ============================================

CREATE TABLE IF NOT EXISTS search_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    search_type TEXT NOT NULL, -- keyword/filter/context
    search_query TEXT,
    result_count INTEGER DEFAULT 0,
    clicked_result_id INTEGER,
    clicked_result_type TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_date ON search_analytics(created_at);

-- ============================================
-- 4. Extended System Dictionaries for Phase 2
-- ============================================

INSERT OR IGNORE INTO system_dictionaries (dict_type, dict_key, dict_value, sort_order) VALUES
-- Export Formats
('export_format', 'xlsx', 'Excel (.xlsx)', 1),
('export_format', 'csv', 'CSV (.csv)', 2),

-- Date Range Presets
('date_range_preset', 'today', '今天', 1),
('date_range_preset', 'yesterday', '昨天', 2),
('date_range_preset', 'this_week', '本周', 3),
('date_range_preset', 'last_week', '上周', 4),
('date_range_preset', 'this_month', '本月', 5),
('date_range_preset', 'last_month', '上月', 6),
('date_range_preset', 'this_quarter', '本季度', 7),
('date_range_preset', 'this_year', '今年', 8),

-- Common Filter Fields
('filter_field', 'status', '状态', 1),
('filter_field', 'issue_type', '问题类型', 2),
('filter_field', 'ticket_type', '工单类型', 3),
('filter_field', 'severity', '严重程度', 4),
('filter_field', 'region', '区域', 5),
('filter_field', 'dealer_id', '经销商', 6),
('filter_field', 'assigned_to', '处理人', 7),
('filter_field', 'is_warranty', '保修状态', 8),
('filter_field', 'created_at', '创建日期', 9);
