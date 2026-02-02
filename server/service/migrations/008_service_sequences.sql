-- Migration: 008_service_sequences.sql
-- Description: Create unified sequence table for service IDs
-- Date: 2026-02-02

-- ============================================
-- Unified Service Sequences Table
-- ============================================
-- Two-layer service model:
--   1. Service Record (SR) - Customer service tracking
--   2. RMA (RA) - Physical repair workflow
-- 
-- Sequence Key Format Examples:
--   RMA-09C-2602  = RMA for product 09, customer channel, Feb 2026
--   RMA-09D-2602  = RMA for product 09, dealer channel, Feb 2026
--   SRC-2602      = Service Record for Customer, Feb 2026
--   SRD-2602      = Service Record for Dealer, Feb 2026

CREATE TABLE IF NOT EXISTS service_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sequence_key TEXT NOT NULL UNIQUE,
    last_sequence INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_service_sequences_key ON service_sequences(sequence_key);

-- ============================================
-- ID Format Documentation (Two-Layer Model)
-- ============================================
-- 
-- Service Record: SR{Type}-{YYMM}-{Seq}
--   Example: SRD-2512-001 (Dealer), SRC-2512-001 (Customer)
--   - Type: D=Dealer, C=Customer
--   - YYMM: Year (2 digits) + Month (2 digits)
--   - Seq: 001-FFF (hex after 999, max 4095/month)
--   - Use: Customer service, consultation, issue tracking
--   - Can upgrade to: RMA (when physical repair needed)
--
-- RMA Number: RA{ProductCode}{ChannelCode}-{YYMM}-{Seq}
--   Example: RA09C-2512-001
--   - ProductCode: 2-digit (09=MAVO Edge 2, etc.)
--   - ChannelCode: C=Customer, D=Dealer
--   - YYMM: Year (2 digits) + Month (2 digits)
--   - Seq: 001-FFF (hex after 999, max 4095/month)
--   - Use: Physical repair workflow, logistics, parts
