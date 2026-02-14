-- Migration 011: Add product_family column to ticket tables
-- Purpose: Enable efficient filtering by product family (A/B/C/D)
-- Date: 2026-02-12

-- 1. Add product_family column to inquiry_tickets
ALTER TABLE inquiry_tickets ADD COLUMN product_family TEXT;

-- 2. Add product_family column to rma_tickets
ALTER TABLE rma_tickets ADD COLUMN product_family TEXT;

-- 3. Add product_family column to dealer_repairs
ALTER TABLE dealer_repairs ADD COLUMN product_family TEXT;

-- 4. Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_inquiry_product_family ON inquiry_tickets(product_family);
CREATE INDEX IF NOT EXISTS idx_rma_product_family ON rma_tickets(product_family);
CREATE INDEX IF NOT EXISTS idx_dealer_product_family ON dealer_repairs(product_family);

-- 5. Create triggers to auto-update product_family when product_id changes
-- Trigger for inquiry_tickets
CREATE TRIGGER IF NOT EXISTS trg_inquiry_product_family_insert
AFTER INSERT ON inquiry_tickets
WHEN NEW.product_id IS NOT NULL
BEGIN
    UPDATE inquiry_tickets 
    SET product_family = (SELECT product_family FROM products WHERE id = NEW.product_id)
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_inquiry_product_family_update
AFTER UPDATE OF product_id ON inquiry_tickets
WHEN NEW.product_id IS NOT NULL
BEGIN
    UPDATE inquiry_tickets 
    SET product_family = (SELECT product_family FROM products WHERE id = NEW.product_id)
    WHERE id = NEW.id;
END;

-- Trigger for rma_tickets
CREATE TRIGGER IF NOT EXISTS trg_rma_product_family_insert
AFTER INSERT ON rma_tickets
WHEN NEW.product_id IS NOT NULL
BEGIN
    UPDATE rma_tickets 
    SET product_family = (SELECT product_family FROM products WHERE id = NEW.product_id)
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_rma_product_family_update
AFTER UPDATE OF product_id ON rma_tickets
WHEN NEW.product_id IS NOT NULL
BEGIN
    UPDATE rma_tickets 
    SET product_family = (SELECT product_family FROM products WHERE id = NEW.product_id)
    WHERE id = NEW.id;
END;

-- Trigger for dealer_repairs
CREATE TRIGGER IF NOT EXISTS trg_dealer_product_family_insert
AFTER INSERT ON dealer_repairs
WHEN NEW.product_id IS NOT NULL
BEGIN
    UPDATE dealer_repairs 
    SET product_family = (SELECT product_family FROM products WHERE id = NEW.product_id)
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_dealer_product_family_update
AFTER UPDATE OF product_id ON dealer_repairs
WHEN NEW.product_id IS NOT NULL
BEGIN
    UPDATE dealer_repairs 
    SET product_family = (SELECT product_family FROM products WHERE id = NEW.product_id)
    WHERE id = NEW.id;
END;
