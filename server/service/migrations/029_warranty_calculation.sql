-- Migration: Add warranty calculation fields to tickets table
-- Date: 2026-03-08
-- Description: Separate OP technical assessment from MS commercial warranty decision

-- OP technical assessment fields
ALTER TABLE tickets ADD COLUMN technical_damage_status TEXT CHECK(technical_damage_status IN ('no_damage', 'physical_damage', 'uncertain'));
ALTER TABLE tickets ADD COLUMN technical_warranty_suggestion TEXT CHECK(technical_warranty_suggestion IN ('suggest_in_warranty', 'suggest_out_warranty', 'needs_verification'));

-- Warranty calculation result (JSON stored)
ALTER TABLE tickets ADD COLUMN warranty_calculation TEXT;

-- MS review confirmation (JSON stored)
ALTER TABLE tickets ADD COLUMN ms_review TEXT;

-- Final settlement after repair (JSON stored)
ALTER TABLE tickets ADD COLUMN final_settlement TEXT;

-- Add comment for documentation
-- technical_damage_status: OP's technical assessment of physical damage
-- technical_warranty_suggestion: OP's suggestion for warranty status (reference only)
-- warranty_calculation: JSON object with warranty calculation results from engine
-- ms_review: JSON object with MS review confirmation data
-- final_settlement: JSON object with actual costs after repair completion
