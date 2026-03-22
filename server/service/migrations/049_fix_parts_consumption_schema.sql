-- Migration: Fix parts_consumption table schema for repair report sync
-- Date: 2026-03-22
-- Description: Add missing columns required by syncPartsConsumption logic

-- ============================================
-- 1. Add missing columns to parts_consumption
-- ============================================

-- Add total_price (to match code use of total_price vs total_amount)
ALTER TABLE parts_consumption ADD COLUMN total_price REAL DEFAULT 0;

-- Add condition_type (new/used/etc)
ALTER TABLE parts_consumption ADD COLUMN condition_type TEXT DEFAULT 'new';

-- Add source reference IDs for sync logic
ALTER TABLE parts_consumption ADD COLUMN source_ref_id TEXT;
ALTER TABLE parts_consumption ADD COLUMN source_document_id INTEGER;

-- Add soft delete support
ALTER TABLE parts_consumption ADD COLUMN is_deleted INTEGER DEFAULT 0;

-- ============================================
-- 2. Data Migration: Sync total_price with total_amount
-- ============================================
UPDATE parts_consumption SET total_price = total_amount WHERE total_price = 0 AND total_amount IS NOT NULL;

-- ============================================
-- 3. Update indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_parts_consumption_source ON parts_consumption(source_type, source_document_id);
CREATE INDEX IF NOT EXISTS idx_parts_consumption_ref ON parts_consumption(source_ref_id);
