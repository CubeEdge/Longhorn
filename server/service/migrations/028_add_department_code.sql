-- Add code column to departments table
-- Part of P2 Overview/Team-stats refinement

ALTER TABLE departments ADD COLUMN code TEXT;

-- Initialize code with name as fallback
UPDATE departments SET code = name;
