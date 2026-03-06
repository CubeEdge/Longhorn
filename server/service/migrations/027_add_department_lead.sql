-- Migration 027: Add lead_id to departments
-- 允许为每个部门指定一个明确的负责人

ALTER TABLE departments ADD COLUMN lead_id INTEGER REFERENCES users(id);

-- 更新现有部门负责人数据
-- MS Lead: Cathy
-- GE Lead: SherryFin
UPDATE departments SET lead_id = (SELECT id FROM users WHERE username = 'Cathy') WHERE code = 'MS';
UPDATE departments SET lead_id = (SELECT id FROM users WHERE username = 'SherryFin') WHERE code = 'GE';
