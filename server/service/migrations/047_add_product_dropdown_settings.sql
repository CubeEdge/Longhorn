-- Migration: Add product dropdown visibility settings
-- Created: 2026-03-18
-- Description: Add settings for controlling product family visibility in dropdowns

-- Add new columns to system_settings table
ALTER TABLE system_settings ADD COLUMN show_family_a INTEGER DEFAULT 1;
ALTER TABLE system_settings ADD COLUMN show_family_b INTEGER DEFAULT 0;
ALTER TABLE system_settings ADD COLUMN show_family_c INTEGER DEFAULT 1;
ALTER TABLE system_settings ADD COLUMN show_family_d INTEGER DEFAULT 1;
ALTER TABLE system_settings ADD COLUMN show_family_e INTEGER DEFAULT 0;

-- Add product type filter settings
ALTER TABLE system_settings ADD COLUMN enable_product_type_filter INTEGER DEFAULT 1;
ALTER TABLE system_settings ADD COLUMN allowed_product_types TEXT DEFAULT '电影机,摄像机,电子寻像器,寻像器,套装';

-- Update existing row with default values
UPDATE system_settings SET 
    show_family_a = 1,
    show_family_b = 0,
    show_family_c = 1,
    show_family_d = 1,
    show_family_e = 0,
    enable_product_type_filter = 1,
    allowed_product_types = '电影机,摄像机,电子寻像器,寻像器,套装'
WHERE id = 1;
