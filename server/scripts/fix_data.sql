-- 数据修复脚本
-- 执行时间: 2026-02-14

-- 1. 更新产品名称为真实产品名称
UPDATE products SET model_name = 'MAVO Edge 8K' WHERE id = 8;
UPDATE products SET model_name = 'KineBAT 150' WHERE id = 9;

-- 2. 删除重复产品（保留ID 1和2）
DELETE FROM products WHERE id IN (10, 11, 12);

-- 3. 更新工单产品ID（将指向已删除产品的ID更新到有效产品）
UPDATE inquiry_tickets SET product_id = 1 WHERE product_id IN (10, 11, 12);

-- 4. 更新所有工单日期为30天内（2026-02-14基准）
UPDATE inquiry_tickets SET created_at = datetime('2026-02-14', '-' || (ABS(RANDOM()) % 30) || ' days'), updated_at = datetime('2026-02-14', '-' || (ABS(RANDOM()) % 30) || ' days');

-- 5. 设置60%工单无经销商（id以0-5结尾的设为无经销商）
UPDATE inquiry_tickets SET dealer_id = NULL WHERE id % 10 IN (0, 1, 2, 3, 4, 5);

-- 6. 为无经销商的工单设置account_id（从现有账户中选择）
UPDATE inquiry_tickets SET account_id = (SELECT id FROM accounts WHERE rowid = (inquiry_tickets.id % (SELECT COUNT(*) FROM accounts)) + 1) WHERE dealer_id IS NULL AND account_id IS NULL;

-- 7. 为所有工单设置contact_id（从关联账户的主联系人中选择）
UPDATE inquiry_tickets SET contact_id = (SELECT c.id FROM contacts c WHERE c.account_id = inquiry_tickets.account_id AND c.status = 'PRIMARY' LIMIT 1) WHERE account_id IS NOT NULL;
