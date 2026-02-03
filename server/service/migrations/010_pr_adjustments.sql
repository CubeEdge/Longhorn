-- Migration 010: PR Adjustments (Account Model & Product Family)

-- 1. Products: Add product_family
-- A=CineCamera, B=ArchivedCamera, C=EVF, D=Accessory
ALTER TABLE products ADD COLUMN product_family TEXT;

-- 2. Customers: Add Account Model fields
ALTER TABLE customers ADD COLUMN account_type TEXT DEFAULT 'EndUser';
ALTER TABLE customers ADD COLUMN acquisition_channel TEXT;
ALTER TABLE customers ADD COLUMN parent_dealer_id INTEGER;
ALTER TABLE customers ADD COLUMN service_tier TEXT DEFAULT 'STANDARD';
ALTER TABLE customers ADD COLUMN industry_tags TEXT;

-- 3. Inquiry Tickets: Add host_device fields for Class C products
ALTER TABLE inquiry_tickets ADD COLUMN host_device_type TEXT;
ALTER TABLE inquiry_tickets ADD COLUMN host_device_model TEXT;

-- 4. RMA Tickets: Add host_device fields for Class C products
ALTER TABLE rma_tickets ADD COLUMN host_device_type TEXT;
ALTER TABLE rma_tickets ADD COLUMN host_device_model TEXT;
