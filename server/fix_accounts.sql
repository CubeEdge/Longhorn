PRAGMA foreign_keys = OFF;

-- Create temp table with data
CREATE TABLE accounts_backup AS SELECT * FROM accounts;

-- Drop and recreate accounts with correct constraint
DROP TABLE accounts;

CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT UNIQUE,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('ORGANIZATION', 'INDIVIDUAL', 'DEALER', 'INTERNAL')),
    email TEXT,
    phone TEXT,
    country TEXT,
    province TEXT,
    city TEXT,
    address TEXT,
    service_tier TEXT DEFAULT 'STANDARD' CHECK(service_tier IN ('STANDARD', 'VIP', 'VVIP', 'BLACKLIST')),
    industry_tags TEXT,
    credit_limit REAL DEFAULT 0,
    dealer_code TEXT,
    dealer_level TEXT,
    region TEXT,
    can_repair INTEGER DEFAULT 0,
    repair_level TEXT,
    parent_dealer_id INTEGER REFERENCES accounts(id),
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Restore data, converting CORPORATE to ORGANIZATION
INSERT INTO accounts SELECT * FROM accounts_backup;
UPDATE accounts SET account_type = 'ORGANIZATION' WHERE account_type = 'CORPORATE';

-- Drop backup
DROP TABLE accounts_backup;

-- Recreate indexes
CREATE INDEX idx_accounts_type ON accounts(account_type);
CREATE INDEX idx_accounts_parent_dealer ON accounts(parent_dealer_id);
CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_accounts_country_province ON accounts(country, province);
CREATE INDEX idx_accounts_service_tier ON accounts(service_tier);

PRAGMA foreign_keys = ON;

-- Verify
SELECT account_type, COUNT(*) as count FROM accounts GROUP BY account_type;
