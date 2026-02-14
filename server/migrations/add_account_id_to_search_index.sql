-- =============================================================================
-- Migration: Add account_id to ticket_search_index and sync data
-- 为工单搜索索引表添加 account_id 字段，替换 customer_id
-- =============================================================================

-- 1. 为 ticket_search_index 添加 account_id 字段（如果不存在）
ALTER TABLE ticket_search_index ADD COLUMN account_id INTEGER REFERENCES accounts(id);

-- 2. 从 customer_id 同步到 account_id（基于工单表的 account_id）
-- inquiry tickets
UPDATE ticket_search_index 
SET account_id = (
    SELECT it.account_id 
    FROM inquiry_tickets it 
    WHERE it.id = ticket_search_index.ticket_id
)
WHERE ticket_type = 'inquiry' AND account_id IS NULL;

-- rma tickets
UPDATE ticket_search_index 
SET account_id = (
    SELECT rt.account_id 
    FROM rma_tickets rt 
    WHERE rt.id = ticket_search_index.ticket_id
)
WHERE ticket_type = 'rma' AND account_id IS NULL;

-- dealer repairs
UPDATE ticket_search_index 
SET account_id = (
    SELECT dr.account_id 
    FROM dealer_repairs dr 
    WHERE dr.id = ticket_search_index.ticket_id
)
WHERE ticket_type = 'dealer_repair' AND account_id IS NULL;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_ticket_search_index_account ON ticket_search_index(account_id);

-- 4. 验证结果
SELECT 'ticket_search_index records with account_id:' as check_item, 
       COUNT(*) as count 
FROM ticket_search_index 
WHERE account_id IS NOT NULL;
