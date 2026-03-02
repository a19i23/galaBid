-- Run this once to set up your database
-- Railway: connect via the Railway dashboard > Postgres plugin > Query tab

CREATE TABLE IF NOT EXISTS auction_items (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT,
  emoji       TEXT DEFAULT '🎁',
  min_bid     INTEGER NOT NULL,
  current_bid INTEGER NOT NULL,
  bid_count   INTEGER DEFAULT 0,
  bidder      TEXT,
  increment   INTEGER DEFAULT 25,
  status      TEXT DEFAULT 'open', -- open | closed
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bids (
  id         SERIAL PRIMARY KEY,
  item_id    INTEGER REFERENCES auction_items(id),
  bidder     TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  placed_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('event_name', 'Lincoln Elementary Annual Gala'),
  ('auction_open', 'false'),
  ('admin_message', '')
ON CONFLICT (key) DO NOTHING;


CREATE TABLE IF NOT EXISTS payments (
  id                    SERIAL PRIMARY KEY,
  item_id               INTEGER REFERENCES auction_items(id),
  bidder                TEXT NOT NULL,
  amount_cents          INTEGER NOT NULL,
  stripe_session_id     TEXT UNIQUE,
  stripe_payment_intent TEXT,
  status                TEXT DEFAULT 'pending', -- pending | paid | failed
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  paid_at               TIMESTAMPTZ
);
