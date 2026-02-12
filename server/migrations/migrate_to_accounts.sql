-- Migration: Migrate dealers and customers to accounts table
-- This script migrates existing data from dealers/customers tables to the new accounts architecture

-- ============================================
-- Step 1: Migrate DEALERS to accounts (account_type = 'DEALER')
-- ============================================

INSERT INTO accounts (
    account_number,
    name,
    account_type,
    email,
    phone,
    country,
    city,
    service_tier,
    dealer_code,
    dealer_level,
    region,
    can_repair,
    repair_level,
    is_active,
    notes,
    created_at,
    updated_at
)
SELECT 
    'ACC-' || strftime('%Y', COALESCE(created_at, CURRENT_TIMESTAMP)) || '-' || printf('%04d%04d', id, ABS(RANDOM()) % 10000),
    d.name,
    'DEALER',
    d.contact_email,
    d.contact_phone,
    d.country,
    d.city,
    'STANDARD',
    d.code,
    CASE 
        WHEN d.dealer_type = 'FirstTier' THEN 'FirstTier'
        WHEN d.dealer_type = 'SecondTier' THEN 'SecondTier'
        WHEN d.dealer_type = 'ThirdTier' THEN 'ThirdTier'
        ELSE 'FirstTier'
    END,
    d.region,
    COALESCE(d.can_repair, 0),
    d.repair_level,
    1,
    d.notes,
    d.created_at,
    d.updated_at
FROM dealers d
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.dealer_code = d.code
);

-- ============================================
-- Step 2: Create contacts for dealers (primary contact)
-- ============================================

INSERT INTO contacts (
    account_id,
    name,
    email,
    phone,
    status,
    is_primary,
    created_at
)
SELECT 
    a.id,
    COALESCE(d.contact_person, d.name),
    d.contact_email,
    d.contact_phone,
    'PRIMARY',
    1,
    d.created_at
FROM dealers d
JOIN accounts a ON a.dealer_code = d.code
WHERE (d.contact_person IS NOT NULL OR d.contact_email IS NOT NULL OR d.contact_phone IS NOT NULL)
AND NOT EXISTS (
    SELECT 1 FROM contacts c WHERE c.account_id = a.id
)
AND NOT EXISTS (
    SELECT 1 FROM contacts c2 WHERE c2.account_id = a.id AND c2.email = d.contact_email AND d.contact_email IS NOT NULL
);

-- ============================================
-- Step 3: Migrate CUSTOMERS (EndUser type) to accounts
-- Determine account_type based on company_name: ORGANIZATION vs INDIVIDUAL
-- ============================================

INSERT INTO accounts (
    account_number,
    name,
    account_type,
    email,
    phone,
    country,
    city,
    service_tier,
    parent_dealer_id,
    is_active,
    notes,
    created_at,
    updated_at
)
SELECT 
    'ACC-' || strftime('%Y', COALESCE(c.created_at, CURRENT_TIMESTAMP)) || '-' || printf('%04d%04d', c.id, ABS(RANDOM()) % 10000),
    c.customer_name,
    CASE 
        WHEN c.company_name IS NOT NULL AND c.company_name != '' THEN 'ORGANIZATION'
        ELSE 'INDIVIDUAL'
    END,
    c.email,
    c.phone,
    c.country,
    c.city,
    COALESCE(c.service_tier, 'STANDARD'),
    -- Map parent_dealer_id to the new account id if it exists
    (SELECT a.id FROM accounts a 
     JOIN dealers d ON d.code = a.dealer_code 
     WHERE d.id = c.parent_dealer_id LIMIT 1),
    1,
    c.notes,
    c.created_at,
    c.updated_at
FROM customers c
WHERE c.customer_type = 'EndUser'
AND NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.name = c.customer_name AND a.email = c.email
);

-- ============================================
-- Step 4: Create contacts for customers
-- ============================================

INSERT INTO contacts (
    account_id,
    name,
    email,
    phone,
    status,
    is_primary,
    created_at
)
SELECT 
    a.id,
    COALESCE(c.contact_person, c.customer_name),
    c.email,
    c.phone,
    'PRIMARY',
    1,
    c.created_at
FROM customers c
JOIN accounts a ON a.name = c.customer_name AND (a.email = c.email OR (a.email IS NULL AND c.email IS NULL))
WHERE c.customer_type = 'EndUser'
AND (c.contact_person IS NOT NULL OR c.email IS NOT NULL OR c.phone IS NOT NULL)
AND NOT EXISTS (
    SELECT 1 FROM contacts ct WHERE ct.account_id = a.id
)
AND NOT EXISTS (
    SELECT 1 FROM contacts ct2 WHERE ct2.account_id = a.id AND ct2.email = c.email AND c.email IS NOT NULL
);

-- ============================================
-- Step 5: Update account_sequences to reflect max ID used
-- ============================================

INSERT OR REPLACE INTO account_sequences (year, last_sequence, updated_at)
SELECT 
    strftime('%Y', CURRENT_TIMESTAMP),
    MAX(CAST(substr(account_number, 9, 4) AS INTEGER)),
    CURRENT_TIMESTAMP
FROM accounts
WHERE account_number LIKE 'ACC-' || strftime('%Y', CURRENT_TIMESTAMP) || '-%';
