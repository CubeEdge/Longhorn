-- Add source tracking to knowledge articles
-- Migration: 011_add_knowledge_source.sql

ALTER TABLE knowledge_articles ADD COLUMN source_type TEXT CHECK(source_type IN ('PDF', 'URL', 'Text', 'Excel', 'Manual'));
ALTER TABLE knowledge_articles ADD COLUMN source_reference TEXT;  -- PDF filename, URL, or source description
ALTER TABLE knowledge_articles ADD COLUMN source_url TEXT;  -- For URL imports
