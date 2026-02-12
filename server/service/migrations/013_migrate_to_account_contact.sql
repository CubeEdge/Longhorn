-- Migration 013: Migrate Existing Data to Account-Contact Architecture
-- 将现有 customers 和 dealers 数据迁移到新的 accounts/contacts 架构
-- 注意: 此迁移假设 Migration 012 已执行

-- =====================================================
-- 步骤 1: 迁移经销商到账户表
-- =====================================================
INSERT INTO accounts (
    account_number,
    name,
    account_type,
    dealer_code,
    dealer_level,
    region,
    country,
    city,
    email,
    phone,
    can_repair,
    repair_level,
    credit_limit,
    is_active,
    notes,
    created_at
)
SELECT 
    'ACC-' || strftime('%Y', 'now') || '-' || printf('%04d', (SELECT COALESCE(MAX(last_sequence), 0) + 1 FROM account_sequences WHERE year = CAST(strftime('%Y', 'now') AS INTEGER)) + ROW_NUMBER() OVER (ORDER BY d.id)),
    d.name,
    'DEALER',
    d.code,
    d.dealer_type,
    d.region,
    d.country,
    d.city,
    d.contact_email,
    d.contact_phone,
    COALESCE(d.can_repair, 0),
    d.repair_level,
    COALESCE(d.credit_limit, 0),
    COALESCE(d.is_active, 1),
    d.notes,
    COALESCE(d.created_at, CURRENT_TIMESTAMP)
FROM dealers d
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE dealer_code = d.code);

-- 更新账户序列
INSERT OR REPLACE INTO account_sequences (year, last_sequence, updated_at)
SELECT 
    CAST(strftime('%Y', 'now') AS INTEGER),
    (SELECT COUNT(*) FROM accounts WHERE account_type = 'DEALER'),
    CURRENT_TIMESTAMP;

-- =====================================================
-- 步骤 2: 迁移客户到账户表
-- =====================================================
INSERT INTO accounts (
    account_number,
    name,
    account_type,
    email,
    phone,
    wechat,
    country,
    province,
    city,
    address,
    service_tier,
    industry_tags,
    parent_dealer_id,
    is_active,
    notes,
    created_at
)
SELECT 
    'ACC-' || strftime('%Y', 'now') || '-' || printf('%04d', 
        (SELECT COALESCE(MAX(last_sequence), 0) FROM account_sequences WHERE year = CAST(strftime('%Y', 'now') AS INTEGER)) 
        + ROW_NUMBER() OVER (ORDER BY c.id)
    ),
    COALESCE(c.company, c.customer_name),
    CASE 
        WHEN c.company IS NOT NULL AND c.company != '' THEN 'CORPORATE'
        ELSE 'INDIVIDUAL'
    END,
    c.email,
    c.phone,
    c.wechat,
    c.country,
    c.province,
    c.city,
    c.address,
    COALESCE(c.customer_level, 'STANDARD'),
    c.industry_tags,
    (SELECT a.id FROM accounts a WHERE a.account_type = 'DEALER' AND a.dealer_code = (SELECT d.code FROM dealers d WHERE d.id = c.parent_dealer_id)),
    1,
    c.notes,
    COALESCE(c.created_at, CURRENT_TIMESTAMP)
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a 
    WHERE a.name = COALESCE(c.company, c.customer_name)
    AND a.account_type IN ('CORPORATE', 'INDIVIDUAL')
);

-- 更新账户序列
UPDATE account_sequences 
SET last_sequence = (SELECT COUNT(*) FROM accounts),
    updated_at = CURRENT_TIMESTAMP
WHERE year = CAST(strftime('%Y', 'now') AS INTEGER);

-- =====================================================
-- 步骤 3: 为每个账户创建默认联系人
-- =====================================================
INSERT INTO contacts (
    account_id,
    name,
    email,
    phone,
    wechat,
    job_title,
    is_primary,
    status,
    created_at
)
SELECT 
    a.id,
    COALESCE(
        (SELECT c.contact_person FROM customers c WHERE COALESCE(c.company, c.customer_name) = a.name LIMIT 1),
        (SELECT c.customer_name FROM customers c WHERE COALESCE(c.company, c.customer_name) = a.name LIMIT 1),
        a.name
    ),
    COALESCE(
        (SELECT c.email FROM customers c WHERE COALESCE(c.company, c.customer_name) = a.name LIMIT 1),
        a.email
    ),
    COALESCE(
        (SELECT c.phone FROM customers c WHERE COALESCE(c.company, c.customer_name) = a.name LIMIT 1),
        a.phone
    ),
    (SELECT c.wechat FROM customers c WHERE COALESCE(c.company, c.customer_name) = a.name LIMIT 1),
    CASE 
        WHEN a.account_type = 'CORPORATE' THEN '联系人'
        ELSE NULL
    END,
    1,
    'PRIMARY',
    CURRENT_TIMESTAMP
FROM accounts a
WHERE a.account_type IN ('CORPORATE', 'INDIVIDUAL')
AND NOT EXISTS (SELECT 1 FROM contacts WHERE account_id = a.id);

-- =====================================================
-- 步骤 4: 更新咨询工单表中的关联
-- =====================================================
-- 先更新 account_id
UPDATE inquiry_tickets 
SET account_id = (
    SELECT a.id 
    FROM accounts a 
    JOIN customers c ON a.name = COALESCE(c.company, c.customer_name)
    WHERE c.id = inquiry_tickets.customer_id
    AND a.account_type IN ('CORPORATE', 'INDIVIDUAL')
)
WHERE customer_id IS NOT NULL;

-- 再更新 contact_id (取该账户下的主要联系人)
UPDATE inquiry_tickets 
SET contact_id = (
    SELECT id 
    FROM contacts 
    WHERE account_id = inquiry_tickets.account_id 
    AND (status = 'PRIMARY' OR is_primary = 1)
    LIMIT 1
)
WHERE account_id IS NOT NULL AND contact_id IS NULL;

-- 更新 dealer_id 指向 accounts 表
UPDATE inquiry_tickets 
SET dealer_id = (
    SELECT a.id 
    FROM accounts a 
    JOIN dealers d ON a.dealer_code = d.code
    WHERE d.id = inquiry_tickets.dealer_id
    AND a.account_type = 'DEALER'
)
WHERE dealer_id IS NOT NULL;

-- =====================================================
-- 步骤 5: 更新 RMA 工单表中的关联
-- =====================================================
UPDATE rma_tickets 
SET account_id = (
    SELECT a.id 
    FROM accounts a 
    JOIN customers c ON a.name = COALESCE(c.company, c.customer_name)
    WHERE c.id = rma_tickets.customer_id
    AND a.account_type IN ('CORPORATE', 'INDIVIDUAL')
)
WHERE customer_id IS NOT NULL;

UPDATE rma_tickets 
SET contact_id = (
    SELECT id 
    FROM contacts 
    WHERE account_id = rma_tickets.account_id 
    AND (status = 'PRIMARY' OR is_primary = 1)
    LIMIT 1
)
WHERE account_id IS NOT NULL AND contact_id IS NULL;

UPDATE rma_tickets 
SET dealer_id = (
    SELECT a.id 
    FROM accounts a 
    JOIN dealers d ON a.dealer_code = d.code
    WHERE d.id = rma_tickets.dealer_id
    AND a.account_type = 'DEALER'
)
WHERE dealer_id IS NOT NULL;

-- =====================================================
-- 步骤 6: 更新经销商维修单中的关联
-- =====================================================
UPDATE dealer_repairs 
SET account_id = (
    SELECT a.id 
    FROM accounts a 
    JOIN customers c ON a.name = COALESCE(c.company, c.customer_name)
    WHERE c.id = dealer_repairs.customer_id
    AND a.account_type IN ('CORPORATE', 'INDIVIDUAL')
)
WHERE customer_id IS NOT NULL;

UPDATE dealer_repairs 
SET contact_id = (
    SELECT id 
    FROM contacts 
    WHERE account_id = dealer_repairs.account_id 
    AND (status = 'PRIMARY' OR is_primary = 1)
    LIMIT 1
)
WHERE account_id IS NOT NULL AND contact_id IS NULL;

UPDATE dealer_repairs 
SET dealer_id = (
    SELECT a.id 
    FROM accounts a 
    JOIN dealers d ON a.dealer_code = d.code
    WHERE d.id = dealer_repairs.dealer_id
    AND a.account_type = 'DEALER'
)
WHERE dealer_id IS NOT NULL;

-- =====================================================
-- 步骤 7: 数据验证统计
-- =====================================================
-- 统计迁移结果
SELECT 
    'Accounts migrated' as metric,
    COUNT(*) as count
FROM accounts
UNION ALL
SELECT 
    'Contacts created',
    COUNT(*)
FROM contacts
UNION ALL
SELECT 
    'Inquiry tickets with account_id',
    COUNT(*)
FROM inquiry_tickets
WHERE account_id IS NOT NULL
UNION ALL
SELECT 
    'RMA tickets with account_id',
    COUNT(*)
FROM rma_tickets
WHERE account_id IS NOT NULL
UNION ALL
SELECT 
    'Dealer repairs with account_id',
    COUNT(*)
FROM dealer_repairs
WHERE account_id IS NOT NULL;
