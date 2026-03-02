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

-- Seed items (delete these and add your real items)
INSERT INTO auction_items (title, category, description, emoji, min_bid, current_bid, increment) VALUES
  ('Weekend Getaway – Big Bear Cabin',  'Travel',        '2-night stay for up to 8 guests in a luxury mountain setting.',            '🏔️', 500, 500, 25),
  ('Chef''s Table Dinner for 6',         'Dining',        'Private 5-course dinner prepared by Chef Marco at your home.',             '🍽️', 350, 350, 25),
  ('Disneyland 4-Pack',                  'Entertainment', '4 one-day park hopper tickets. Valid through Dec 2025.',                   '🎢', 600, 600, 25),
  ('Principal for a Day',                'School',        'Your child runs the school for a day — morning news, lunch pick & more!',  '🏫', 150, 150, 10),
  ('Private Surf Lesson (4 ppl)',        'Experiences',   '2-hour surf lesson with pro instructor at Malibu. Boards included.',       '🏄', 200, 200, 10),
  ('Spa Day for Two',                    'Wellness',      'Full day at Spa Montage — facials, massages, and all amenities.',          '🧖', 400, 400, 25),
  ('Lakers Floor Seats (2)',             'Sports',        'Two floor seats to a home Lakers game. Row 3, center court.',             '🏀', 800, 800, 50),
  ('Art Class Package',                  'School',        '10-week private art lessons with our school''s beloved art teacher.',      '🎨', 100, 100, 10)
ON CONFLICT DO NOTHING;

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
