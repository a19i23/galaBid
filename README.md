# 🎉 GalaBid — School Auction Platform

Real-time silent + live auction with Stripe checkout. Built to replace GiveSmart.

---

## 🚀 Deploy to Fly.io

### Prerequisites
```bash
brew install flyctl       # macOS
flyctl auth login
```

### Step 1 — Create the app
```bash
cd galabid
flyctl launch             # Accept defaults, say YES to Postgres, NO to Redis
```
This creates your app and a managed Postgres instance automatically.

### Step 2 — Set secrets
```bash
flyctl secrets set \
  ADMIN_PASSWORD="your_secret_password" \
  STRIPE_SECRET_KEY="sk_test_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  APP_URL="https://your-app-name.fly.dev"
```

### Step 3 — Run the database schema
```bash
# Get your Postgres connection string
flyctl postgres connect -a your-app-name-db

# Then paste and run the contents of schema.sql
# Edit the seed items to match your real auction items first!
```

### Step 4 — Deploy
```bash
flyctl deploy
```

Your app is live at `https://your-app-name.fly.dev` 🎉

### Step 5 — Set up Stripe Webhook
1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-app-name.fly.dev/webhooks/stripe`
3. Select events: `checkout.session.completed` and `checkout.session.expired`
4. Copy the signing secret → `flyctl secrets set STRIPE_WEBHOOK_SECRET="whsec_..."`

---

## 💻 Local Development

```bash
# Install deps
npm install
cd client && npm install && cd ..

# Set up local env
cp .env.example .env
# Fill in DATABASE_URL, ADMIN_PASSWORD, STRIPE keys

# Set up local DB
createdb galabid
psql galabid < schema.sql

# Run (two terminals)
npm run dev                   # Terminal 1: server on :8080
cd client && npm start        # Terminal 2: React on :3000

# For local Stripe webhooks (optional)
stripe listen --forward-to localhost:8080/webhooks/stripe
```

---

## 👤 Sign-in & per-person bidding

Bidders can use the app in two ways:

1. **Sign in with Google** — Each person signs in on their phone. Multiple people at the same table can each have their own account. Optional “Which table are you at?” is stored for display and for paying for live-auction wins by table.
2. **Continue as guest** — Pick a table name only (no account). Works like before for events that don’t need social login.

**To enable Google login:**
1. Run the auth migration once: `psql galabid < schema-auth.sql`
2. Create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth client ID, Web application).
3. Set authorized redirect URI: `https://your-domain/auth/google/callback` (or `http://localhost:8080/auth/google/callback` for local).
4. In `.env`: set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and in production `SESSION_SECRET`.

**Facebook** can be added the same way (OAuth redirect + a `/auth/facebook` route). **Instagram** and **TikTok** don’t offer standard “Log in with Instagram/TikTok” for third-party apps like Google/Facebook; they’re aimed at content/API use, so we only support Google (and optionally Facebook) for social login.

---

**How it works:**
1. Auction closes → winner sees a "Pay Now" button on their card
2. Clicking it calls `POST /api/checkout` with their table name
3. Server creates a Stripe Checkout session with all their won items as line items
4. Bidder is redirected to Stripe's hosted payment page
5. On success, Stripe calls your webhook → payment marked as `paid` in DB
6. Admin dashboard updates in real time showing ✓ Paid

**Stripe test cards:**
- ✅ Success: `4242 4242 4242 4242`
- ❌ Decline: `4000 0000 0000 0002`
- Any future expiry, any CVC

**Going live:** Swap `sk_test_...` for `sk_live_...` keys the morning of the event.
```bash
flyctl secrets set STRIPE_SECRET_KEY="sk_live_..." STRIPE_WEBHOOK_SECRET="whsec_live_..."
```

---

## 🏗️ Architecture

```
client/src/
  App.js          — Full UI (bidder, my bids, admin, live auction, checkout pages)
  useAuction.js   — WebSocket hook for real-time state

server/
  index.js        — Express + WebSocket + Stripe + REST API

schema.sql        — Postgres schema (auction_items, bids, payments, settings)
fly.toml          — Fly.io deploy config
```

**Database tables:**
| Table | Purpose |
|-------|---------|
| `auction_items` | Items, current bids, winners |
| `bids` | Full bid history |
| `payments` | Stripe session tracking, paid/pending/failed |
| `settings` | Event name, admin broadcast message |

---

## 📊 Admin Features

- **Live bid count + current leader** per item
- **Payment status** column: Unpaid / ⏳ Pending / ✓ Paid
- **Broadcast message** — shows instantly on all bidder screens
- **Add items** on the fly during the event
- **Live Auction mode** — full-screen auctioneer paddle view
- **Stripe-verified total collected** (only counts confirmed payments)

---

## 💰 Cost

| Service | Cost |
|---------|------|
| Fly.io (shared-cpu-1x, 512MB) | ~$2–5/month |
| Fly.io Postgres (1GB) | Free on hobby plan |
| Stripe | 2.9% + 30¢ per transaction |

For a $20,000 auction night, Stripe fees ≈ $580. Still way cheaper than GiveSmart.

---

## 📋 Night-of Checklist

- [ ] Swap Stripe test keys → live keys: `flyctl secrets set STRIPE_SECRET_KEY="sk_live_..."`
- [ ] Run `schema.sql` with your real auction items (delete the seed data)
- [ ] Test checkout with a real card in Stripe test mode first
- [ ] Print QR code to your Fly.io URL — put one at every table
- [ ] Have a laptop at the podium for Live Auction mode
- [ ] Know your `ADMIN_PASSWORD`
- [ ] Monitor the Admin dashboard throughout the night for payment status
