-- Migration: Add prepared_by fields to repair_reports
-- Date: 2026-03-20
-- Description: Store prepared_by user info for repair reports

-- ============================================
-- 1. Add prepared_by columns to repair_reports
-- ============================================
ALTER TABLE repair_reports ADD COLUMN prepared_by INTEGER REFERENCES users(id);
ALTER TABLE repair_reports ADD COLUMN prepared_by_name TEXT;
