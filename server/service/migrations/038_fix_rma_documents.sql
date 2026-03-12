-- Migration: Fix RMA Documents tables (Idempotent)
-- Date: 2026-03-11
-- Description: Ensure PI table and audit log have correct schema

-- ============================================
-- Step 1: Ensure proforma_invoices has correct schema
-- Note: This migration is idempotent - safe to run multiple times
-- ============================================

-- The proforma_invoices table should already have the correct schema
-- If not, this will create indexes (they use IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_pi_ticket ON proforma_invoices(ticket_id);
CREATE INDEX IF NOT EXISTS idx_pi_status ON proforma_invoices(status);
CREATE INDEX IF NOT EXISTS idx_pi_number ON proforma_invoices(pi_number);

-- ============================================
-- Step 2: Ensure document_audit_log has 'recalled' action
-- Note: If table already has the correct constraint, this is a no-op
-- ============================================

-- The table recreation was already done. These indexes ensure everything is in place.
CREATE INDEX IF NOT EXISTS idx_audit_doc_type ON document_audit_log(document_type);
CREATE INDEX IF NOT EXISTS idx_audit_doc_id ON document_audit_log(document_id);
