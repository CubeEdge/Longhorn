-- Add currency settings for repair reports
ALTER TABLE system_settings ADD COLUMN default_labor_rate_usd REAL DEFAULT 20;
ALTER TABLE system_settings ADD COLUMN default_labor_rate_eur REAL DEFAULT 20;
ALTER TABLE system_settings ADD COLUMN currency_conversion_factor REAL DEFAULT 5;
