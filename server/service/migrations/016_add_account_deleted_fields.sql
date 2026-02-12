-- Migration 016: Add account deleted fields
-- 添加软删除字段支持

-- 添加 is_deleted 字段（0=未删除, 1=已删除）
ALTER TABLE accounts ADD COLUMN is_deleted INTEGER DEFAULT 0;

-- 添加 deleted_at 字段（删除时间）
ALTER TABLE accounts ADD COLUMN deleted_at TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_accounts_deleted ON accounts(is_deleted);
