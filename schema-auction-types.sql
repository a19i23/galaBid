-- Run after schema.sql (and schema-auth.sql if using social login).
-- Adds auction_type to items and silent auction window to settings.

ALTER TABLE auction_items ADD COLUMN IF NOT EXISTS auction_type TEXT NOT NULL DEFAULT 'silent';

INSERT INTO settings (key, value) VALUES
  ('silent_start', ''),
  ('silent_end', '')
ON CONFLICT (key) DO NOTHING;
