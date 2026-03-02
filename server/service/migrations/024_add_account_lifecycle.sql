-- Migration 024: Add Account Lifecycle Stage
-- 添加账户生命周期状态字段

-- 1. 添加 lifecycle_stage 字段，默认为 'ACTIVE' (正式客户)
-- 由于 SQLite 的 ALTER TABLE 限制，添加带约束的字段比较简单
ALTER TABLE accounts ADD COLUMN lifecycle_stage TEXT DEFAULT 'ACTIVE' CHECK(lifecycle_stage IN ('PROSPECT', 'ACTIVE', 'ARCHIVED'));

-- 2. 添加索引以优化筛选
CREATE INDEX IF NOT EXISTS idx_accounts_lifecycle_stage ON accounts(lifecycle_stage);

-- 3. 数据初始化 (由于默认值是 ACTIVE，存量数据会自动变成 ACTIVE)
-- 这一步已通过 DEFAULT 实现。
