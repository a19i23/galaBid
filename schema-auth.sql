-- Run after schema.sql to add user accounts and social login support.
-- Each bidder is a person (Google/Facebook); multiple people can share a "table" label.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  provider      TEXT NOT NULL,   -- 'google' | 'facebook'
  provider_id   TEXT NOT NULL,
  table_label   TEXT,            -- optional e.g. "Table 3" for display/reporting
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_id)
);

-- Optional: link bids to user (bidder text kept for display)
ALTER TABLE bids ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
-- Optional: link payments to user
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_bids_user_id ON bids(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider, provider_id);
