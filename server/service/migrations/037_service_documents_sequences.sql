-- Migration: Add sequence tables for PI and Repair Reports
-- Date: 2026-03-11
-- Description: Fixes missing tables used in rma-documents.js for auto-numbering

CREATE TABLE IF NOT EXISTS pi_sequences (
    date_key TEXT PRIMARY KEY,
    last_sequence INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS report_sequences (
    date_key TEXT PRIMARY KEY,
    last_sequence INTEGER DEFAULT 0
);
