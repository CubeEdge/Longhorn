-- Migration 022: Users Table Enhancement
-- 用户表增强：添加 job_title, display_name 等字段
-- 标准化 platform_role: Admin / Exec / Lead / Member / Dealer

-- 1. 添加新字段
ALTER TABLE users ADD COLUMN job_title TEXT;
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE users ADD COLUMN last_login_at TEXT;
