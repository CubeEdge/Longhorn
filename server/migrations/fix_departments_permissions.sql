-- Transaction to ensure atomicity
BEGIN TRANSACTION;

-- 1. Fix Departments: Consolidate to IDs 1-4
-- First, standardize existing IDs 1-4 with correct codes
UPDATE departments SET code = 'MS', name = '市场部 (MS)' WHERE id = 1;
UPDATE departments SET code = 'OP', name = '运营部 (OP)' WHERE id = 2;
UPDATE departments SET code = 'RD', name = '研发部 (RD)' WHERE id = 3;
UPDATE departments SET code = 'RE', name = '通用台面 (RE)' WHERE id = 4;

-- Delete duplicates (IDs > 100 created by auto-seed)
DELETE FROM departments WHERE id > 100;

-- 2. Fix Users: Ensure Admin and others act as expected
-- Update Admin (id 1) to be SuperAdmin essentially (no specific dept needed for logic, but good for data integrity)
UPDATE users SET department_id = NULL, department_name = NULL WHERE username = 'admin';

-- Update Lead/Members if their department_id point to deleted records (just in case)
-- (Assuming they are currently correct as per previous check: 1, 2, etc.)

-- 3. Restore Base Permissions
-- Clear existing permissions to start fresh (it was empty anyway)
DELETE FROM permissions;

-- Grant Admin full access to everything (Explicitly, though role check handles it)
-- INSERT INTO permissions (user_id, folder_path, access_type) VALUES (1, '', 'Full');

-- Grant Department Leads/Members access to their departments
-- 市场部 (MS) -> ID 1
INSERT INTO permissions (user_id, folder_path, access_type) 
SELECT id, 'MS', 'Full' FROM users WHERE department_id = 1 AND role = 'Lead';

INSERT INTO permissions (user_id, folder_path, access_type) 
SELECT id, 'MS', 'Read' FROM users WHERE department_id = 1 AND role = 'Member';

-- 运营部 (OP) -> ID 2
INSERT INTO permissions (user_id, folder_path, access_type) 
SELECT id, 'OP', 'Full' FROM users WHERE department_id = 2 AND role = 'Lead';

INSERT INTO permissions (user_id, folder_path, access_type) 
SELECT id, 'OP', 'Read' FROM users WHERE department_id = 2 AND role = 'Member';

-- 研发部 (RD) -> ID 3
INSERT INTO permissions (user_id, folder_path, access_type) 
SELECT id, 'RD', 'Full' FROM users WHERE department_id = 3 AND role = 'Lead';

INSERT INTO permissions (user_id, folder_path, access_type) 
SELECT id, 'RD', 'Read' FROM users WHERE department_id = 3 AND role = 'Member';

-- 通用台面 (RE) -> ID 4
INSERT INTO permissions (user_id, folder_path, access_type) 
SELECT id, 'RE', 'Full' FROM users WHERE department_id = 4 AND role = 'Lead';

INSERT INTO permissions (user_id, folder_path, access_type) 
SELECT id, 'RE', 'Read' FROM users WHERE department_id = 4 AND role = 'Member';

COMMIT;
