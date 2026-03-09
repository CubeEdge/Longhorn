-- Migration: Add service_uploads table for file upload tracking
-- Date: 2026-03-09
-- Description: Track warranty invoice uploads and other service attachments

CREATE TABLE IF NOT EXISTS service_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    upload_type TEXT DEFAULT 'general',
    uploaded_by INTEGER NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(uploaded_by) REFERENCES users(id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_uploads_type ON service_uploads(upload_type);
CREATE INDEX IF NOT EXISTS idx_service_uploads_user ON service_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_service_uploads_path ON service_uploads(file_path);
