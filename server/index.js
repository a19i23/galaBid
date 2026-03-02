require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const Stripe = require("stripe");

// ─── Init ─────────────────────────────────────────────────────────────────────
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 60000,
  max: 5,
});

// Prevent pool idle-client errors from crashing the process
pool.on("error", (err) => {
  console.error("pg pool error (non-fatal):", err.message);
});

// Retry a query once if the connection was terminated (e.g. DB machine restarted)
async function dbQuery(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (err.message === "Connection terminated unexpectedly") {
      await new Promise((r) => setTimeout(r, 1500));
      return await pool.query(text, params);
    }
    throw err;
  }
}

// Prevent any uncaught async route error from taking down the server
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (server kept running):", reason?.message ?? reason);
});
const APP_URL = process.env.APP_URL || "http://localhost:8080";
const CORS_ORIGIN = process.env.CORS_ORIGIN || (process.env.NODE_ENV === "production" ? APP_URL : "http://localhost:3000");
// Where to send the user after OAuth (e.g. React dev server in dev)
const FRONTEND_URL = process.env.FRONTEND_URL || APP_URL;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ─── Admin email list ─────────────────────────────────────────────────────────
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);
const isAdminEmail = (email) => !!(email && ADMIN_EMAILS.has(email.toLowerCase()));

// ─── Middleware ───────────────────────────────────────────────────────────────
// Raw body for Stripe webhook verification — MUST be before express.json()
app.use("/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

const cookieParserMw = cookieParser();
const sessionMw = session({
  secret: process.env.SESSION_SECRET || "galabid-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === "production", httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
});
app.use(cookieParserMw);
app.use(sessionMw);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/build")));
}

// ─── Auth: current user (session) ─────────────────────────────────────────────
function requireUser(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: "Not logged in" });
  next();
}

app.get("/auth/me", (req, res) => {
  // #region agent log
  fetch('http://127.0.0.1:7457/ingest/4d2c2020-e1c4-403a-b635-1990ce89cee5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b0b7f'},body:JSON.stringify({sessionId:'1b0b7f',location:'server/index.js:91',message:'/auth/me called',data:{hasSession:!!req.session,hasUser:!!req.session?.user,sessionID:req.sessionID,pid:process.pid},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (!req.session?.user) return res.status(401).json({ error: "Not logged in" });
  const { id, email, display_name, avatar_url, provider, table_label } = req.session.user;
  res.json({ id, email, display_name, avatar_url, provider, table_label, is_admin: isAdminEmail(email) });
});

app.patch("/auth/me", requireUser, async (req, res) => {
  const { table_label } = req.body;
  const userId = req.session.user.id;
  await dbQuery(
    "UPDATE users SET table_label=$1, updated_at=NOW() WHERE id=$2",
    [table_label || null, userId]
  );
  req.session.user.table_label = table_label || null;
  const { id, email, display_name, avatar_url, provider } = req.session.user;
  res.json({ id, email, display_name, avatar_url, provider, table_label: req.session.user.table_label, is_admin: isAdminEmail(email) });
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

// ─── One-time session handoff (for cross-origin dev: cookie set on :8080 isn't sent from :3000)
const sessionHandoff = new Map();
function createHandoffToken(user) {
  const token = require("crypto").randomBytes(24).toString("hex");
  sessionHandoff.set(token, { user, at: Date.now() });
  setTimeout(() => sessionHandoff.delete(token), 120000);
  return token;
}

app.post("/auth/session", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Missing token" });
  const entry = sessionHandoff.get(token);
  if (!entry) return res.status(400).json({ error: "Invalid or expired token" });
  sessionHandoff.delete(token);
  req.session.user = entry.user;
  const { id, email, display_name, avatar_url, provider, table_label } = entry.user;
  res.json({ id, email, display_name, avatar_url, provider, table_label, is_admin: isAdminEmail(email) });
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

app.get("/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: "Google login not configured" });
  const redirectUri = `${APP_URL}/auth/google/callback`;
  const scopes = "openid email profile";
  const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.redirect(`${FRONTEND_URL}?auth_error=config`);
  const { code } = req.query;
  if (!code) return res.redirect(`${FRONTEND_URL}?auth_error=no_code`);

  const redirectUri = `${APP_URL}/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return res.redirect(`${FRONTEND_URL}?auth_error=token`);

  const tokens = await tokenRes.json();
  const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userinfoRes.ok) return res.redirect(`${FRONTEND_URL}?auth_error=userinfo`);
  const profile = await userinfoRes.json();

  const email = profile.email;
  const display_name = profile.name || profile.email?.split("@")[0] || "Bidder";
  const avatar_url = profile.picture || null;
  const provider = "google";
  const provider_id = profile.id;

  let rows;
  try {
    ({ rows } = await dbQuery(
      `INSERT INTO users (email, display_name, avatar_url, provider, provider_id, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (provider, provider_id) DO UPDATE SET
         email=EXCLUDED.email, display_name=EXCLUDED.display_name, avatar_url=EXCLUDED.avatar_url, updated_at=NOW()
       RETURNING id, email, display_name, avatar_url, provider, table_label`,
      [email, display_name, avatar_url, provider, provider_id]
    ));
  } catch (err) {
    console.error("OAuth DB error:", err.message);
    return res.redirect(`${FRONTEND_URL}?auth_error=db`);
  }
  const user = rows[0];
  req.session.user = user;
  // Same origin (production): session cookie is set on this response, redirect directly.
  // Different origin (local dev: backend :8080, frontend :3000): use one-time token handoff.
  // #region agent log
  fetch('http://127.0.0.1:7457/ingest/4d2c2020-e1c4-403a-b635-1990ce89cee5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b0b7f'},body:JSON.stringify({sessionId:'1b0b7f',location:'server/index.js:195',message:'OAuth callback: about to redirect',data:{sameOrigin:APP_URL===FRONTEND_URL,APP_URL,FRONTEND_URL,sessionID:req.sessionID,pid:process.pid,userEmail:user.email},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  if (APP_URL === FRONTEND_URL) {
    return req.session.save((err) => {
      // #region agent log
      fetch('http://127.0.0.1:7457/ingest/4d2c2020-e1c4-403a-b635-1990ce89cee5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b0b7f'},body:JSON.stringify({sessionId:'1b0b7f',location:'server/index.js:198',message:'session.save callback',data:{saveErr:err?.message||null,sessionID:req.sessionID,pid:process.pid},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      res.redirect(FRONTEND_URL);
    });
  }
  const handoff = createHandoffToken(user);
  res.redirect(`${FRONTEND_URL}${FRONTEND_URL.includes("?") ? "&" : "?"}session=${handoff}`);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function checkSilentWindow() {
  const { rows } = await dbQuery(
    "SELECT key, value FROM settings WHERE key IN ('silent_start','silent_end')"
  );
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const now = new Date();
  if (s.silent_start && new Date(s.silent_start) > now) return "Silent auction hasn't started yet.";
  if (s.silent_end   && new Date(s.silent_end)   < now) return "Silent auction has ended.";
  return null;
}

// Auto-close open silent items once silent_end passes (checks every 30 s)
setInterval(async () => {
  try {
    const { rows: sr } = await dbQuery("SELECT value FROM settings WHERE key='silent_end'");
    const silentEnd = sr[0]?.value;
    if (!silentEnd) return;
    if (new Date(silentEnd) > new Date()) return;

    const { rows: open } = await dbQuery(
      "SELECT * FROM auction_items WHERE status='open' AND auction_type='silent'"
    );
    for (const item of open) {
      await dbQuery("UPDATE auction_items SET status='closed' WHERE id=$1", [item.id]);
      if (item.bidder) {
        await dbQuery(
          `INSERT INTO payments (item_id, bidder, amount_cents, status)
           VALUES ($1,$2,$3,'pending') ON CONFLICT DO NOTHING`,
          [item.id, item.bidder, Number(item.current_bid) * 100]
        );
      }
      broadcast({ type: "ITEM_CLOSED", itemId: item.id, winner: item.bidder, amount: item.current_bid });
    }
    if (open.length > 0) console.log(`[auto-close] closed ${open.length} silent item(s).`);
  } catch (e) { /* DB unavailable (machine sleeping) — will retry next interval */ }
}, 30_000);

// ─── REST: Place bid (session-based, for logged-in bidders) ────────────────────
app.post("/api/bid", requireUser, async (req, res) => {
  const { itemId } = req.body;
  const user = req.session.user;
  const displayName = user.table_label ? `${user.display_name} (${user.table_label})` : user.display_name;

  const { rows: settingsRows } = await dbQuery("SELECT key, value FROM settings WHERE key = 'auction_open'");
  const auctionOpen = settingsRows.find((r) => r.key === "auction_open")?.value === "true";
  if (!auctionOpen) {
    return res.status(400).json({ error: "Bidding is not open yet. The host will start the auction." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT * FROM auction_items WHERE id=$1 FOR UPDATE",
      [itemId]
    );
    const item = rows[0];
    if (!item) throw new Error("Item not found");
    if (item.auction_type === "live") throw new Error("This item is in the live auction — bids are placed by the auctioneer.");
    if (item.auction_type === "silent") {
      const windowErr = await checkSilentWindow();
      if (windowErr) throw new Error(windowErr);
    }
    if (item.status !== "open") throw new Error("Bidding is closed for this item");
    if (item.bidder === displayName) throw new Error("You are already the highest bidder");

    const newBid = Number(item.current_bid) + Number(item.increment);
    await client.query(
      "UPDATE auction_items SET current_bid=$1, bidder=$2, bid_count=bid_count+1 WHERE id=$3",
      [newBid, displayName, itemId]
    );
    try {
      await client.query(
        "INSERT INTO bids (item_id, bidder, amount, user_id) VALUES ($1,$2,$3,$4)",
        [itemId, displayName, newBid, user.id]
      );
    } catch (e) {
      if (e.code === "42703") {
        await client.query(
          "INSERT INTO bids (item_id, bidder, amount) VALUES ($1,$2,$3)",
          [itemId, displayName, newBid]
        );
      } else throw e;
    }
    await client.query("COMMIT");

    broadcast({
      type: "BID_PLACED",
      itemId,
      newBid,
      bidder: displayName,
      prevBidder: item.bidder,
      bidCount: Number(item.bid_count) + 1,
    });
    res.json({ ok: true, newBid, bidder: displayName });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((c) => c.readyState === WebSocket.OPEN && c.send(msg));
}

wss.on("connection", async (ws, req) => {
  // Run session middleware on the upgrade request so we can identify the user
  await new Promise((resolve) => cookieParserMw(req, {}, resolve));
  await new Promise((resolve) => sessionMw(req, {}, resolve));
  ws.isAdmin = isAdminEmail(req.session?.user?.email);

  try {
    const [items, settings, payments] = await Promise.all([
      dbQuery("SELECT * FROM auction_items ORDER BY id"),
      dbQuery("SELECT * FROM settings"),
      dbQuery("SELECT item_id, bidder, status FROM payments"),
    ]);
    ws.send(JSON.stringify({
      type: "INIT",
      items: items.rows,
      settings: Object.fromEntries(settings.rows.map((r) => [r.key, r.value])),
      payments: payments.rows,
    }));
  } catch (err) {
    console.error("WS init error:", err);
  }

  ws.on("message", async (raw) => {
    try { await handleWsMessage(JSON.parse(raw), ws); }
    catch (err) { console.error("WS error:", err); }
  });
});

async function handleWsMessage(msg, ws) {
  const isAdmin = () => ws.isAdmin;
  const deny = () => ws.send(JSON.stringify({ type: "ERROR", message: "Unauthorized" }));

  switch (msg.type) {

    // ── Silent auction bid ───────────────────────────────────────────────────
    case "PLACE_BID": {
      const { itemId, bidder } = msg;
      const { rows: settingsRows } = await dbQuery("SELECT key, value FROM settings WHERE key = 'auction_open'");
      const auctionOpen = settingsRows.find((r) => r.key === "auction_open")?.value === "true";
      if (!auctionOpen) {
        ws.send(JSON.stringify({ type: "BID_ERROR", message: "Bidding is not open yet. The host will start the auction." }));
        break;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(
          "SELECT * FROM auction_items WHERE id=$1 FOR UPDATE", [itemId]
        );
        const item = rows[0];
        if (!item) throw new Error("Item not found");
        if (item.auction_type === "live") throw new Error("This item is in the live auction.");
        if (item.auction_type === "silent") {
          const windowErr = await checkSilentWindow();
          if (windowErr) throw new Error(windowErr);
        }
        if (item.status !== "open") throw new Error("Bidding is closed for this item");
        if (item.bidder === bidder)  throw new Error("You are already the highest bidder");

        const newBid = Number(item.current_bid) + Number(item.increment);
        await client.query(
          "UPDATE auction_items SET current_bid=$1, bidder=$2, bid_count=bid_count+1 WHERE id=$3",
          [newBid, bidder, itemId]
        );
        await client.query(
          "INSERT INTO bids (item_id, bidder, amount) VALUES ($1,$2,$3)",
          [itemId, bidder, newBid]
        );
        await client.query("COMMIT");

        broadcast({
          type: "BID_PLACED",
          itemId,
          newBid,
          bidder,
          prevBidder: item.bidder,
          bidCount: Number(item.bid_count) + 1,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        ws.send(JSON.stringify({ type: "BID_ERROR", message: err.message }));
      } finally {
        client.release();
      }
      break;
    }

    // ── Close item ───────────────────────────────────────────────────────────
    case "CLOSE_ITEM": {
      if (!isAdmin()) return deny();
      const { rows } = await dbQuery(
        "SELECT * FROM auction_items WHERE id=$1", [msg.itemId]
      );
      const item = rows[0];
      if (!item || item.status === "closed") break;

      await dbQuery(
        "UPDATE auction_items SET status='closed' WHERE id=$1", [msg.itemId]
      );

      // Create a pending payment record for the winner
      if (item.bidder) {
        await dbQuery(
          `INSERT INTO payments (item_id, bidder, amount_cents, status)
           VALUES ($1,$2,$3,'pending')
           ON CONFLICT DO NOTHING`,
          [item.id, item.bidder, Number(item.current_bid) * 100]
        );
      }
      broadcast({ type: "ITEM_CLOSED", itemId: msg.itemId, winner: item.bidder, amount: item.current_bid });
      break;
    }

    // ── Live auction bid ─────────────────────────────────────────────────────
    case "LIVE_BID": {
      if (!isAdmin()) return deny();
      const { rows } = await dbQuery("SELECT * FROM auction_items WHERE id=$1", [msg.itemId]);
      const item = rows[0];
      if (!item) break;
      const newBid = Number(item.current_bid) + Number(item.increment);
      await dbQuery(
        "UPDATE auction_items SET current_bid=$1, bidder=$2, bid_count=bid_count+1 WHERE id=$3",
        [newBid, msg.bidder, msg.itemId]
      );
      await dbQuery("INSERT INTO bids (item_id, bidder, amount) VALUES ($1,$2,$3)", [msg.itemId, msg.bidder, newBid]);
      broadcast({ type: "LIVE_BID_UPDATE", itemId: msg.itemId, newBid, bidder: msg.bidder, bidCount: Number(item.bid_count) + 1 });
      break;
    }

    // ── Update settings ──────────────────────────────────────────────────────
    case "UPDATE_SETTING": {
      if (!isAdmin()) return deny();
      await dbQuery(
        "INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2",
        [msg.key, msg.value]
      );
      broadcast({ type: "SETTING_UPDATED", key: msg.key, value: msg.value });
      break;
    }

    default:
      ws.send(JSON.stringify({ type: "ERROR", message: `Unknown: ${msg.type}` }));
  }
}

// ─── Admin middleware ─────────────────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  if (!isAdminEmail(req.session?.user?.email)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// ─── REST: Items ──────────────────────────────────────────────────────────────
app.get("/api/items", async (req, res) => {
  const { rows } = await dbQuery("SELECT * FROM auction_items ORDER BY id");
  res.json(rows);
});

app.get("/api/items/:id/bids", async (req, res) => {
  const { rows } = await dbQuery(
    "SELECT * FROM bids WHERE item_id=$1 ORDER BY placed_at DESC LIMIT 20",
    [req.params.id]
  );
  res.json(rows);
});

// ─── REST: Admin ──────────────────────────────────────────────────────────────
app.post("/api/admin/items", requireAdmin, async (req, res) => {
  const { title, category, description, emoji, min_bid, increment, auction_type } = req.body;
  const { rows } = await dbQuery(
    `INSERT INTO auction_items (title, category, description, emoji, min_bid, current_bid, increment, auction_type)
     VALUES ($1,$2,$3,$4,$5,$5,$6,$7) RETURNING *`,
    [title, category, description, emoji || "🎁", min_bid, increment || 25, auction_type || "silent"]
  );
  broadcast({ type: "ITEM_ADDED", item: rows[0] });
  res.json(rows[0]);
});

app.patch("/api/admin/items/:id", requireAdmin, async (req, res) => {
  const { title, category, description, emoji, min_bid, current_bid, increment, bidder, status, auction_type } = req.body;
  const { rows } = await dbQuery(
    `UPDATE auction_items SET
       title        = COALESCE($1, title),
       category     = COALESCE($2, category),
       description  = COALESCE($3, description),
       emoji        = COALESCE($4, emoji),
       min_bid      = COALESCE($5, min_bid),
       current_bid  = COALESCE($6, current_bid),
       increment    = COALESCE($7, increment),
       bidder       = $8,
       status       = COALESCE($9, status),
       auction_type = COALESCE($10, auction_type)
     WHERE id=$11 RETURNING *`,
    [title, category, description, emoji, min_bid ?? null, current_bid ?? null, increment ?? null, bidder ?? null, status, auction_type ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Item not found" });
  broadcast({ type: "ITEM_UPDATED", item: rows[0] });
  res.json(rows[0]);
});


app.post("/api/admin/reset", requireAdmin, async (req, res) => {
  await dbQuery("UPDATE auction_items SET current_bid=min_bid, bidder=NULL, bid_count=0, status='open'");
  await dbQuery("DELETE FROM bids");
  await dbQuery("DELETE FROM payments");
  const { rows } = await dbQuery("SELECT * FROM auction_items ORDER BY id");
  broadcast({ type: "AUCTION_RESET", items: rows });
  res.json({ ok: true });
});

// Full admin report
app.get("/api/admin/report", requireAdmin, async (req, res) => {
  const [items, bids, payments] = await Promise.all([
    dbQuery("SELECT * FROM auction_items ORDER BY id"),
    dbQuery("SELECT * FROM bids ORDER BY placed_at DESC"),
    dbQuery("SELECT * FROM payments ORDER BY created_at DESC"),
  ]);
  const totalCollected = payments.rows
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount_cents / 100, 0);
  const totalWon = items.rows
    .filter((i) => i.status === "closed" && i.bidder)
    .reduce((s, i) => s + Number(i.current_bid), 0);
  res.json({ items: items.rows, bids: bids.rows, payments: payments.rows, totalCollected, totalWon });
});

// ─── REST: Stripe Checkout ────────────────────────────────────────────────────

// POST /api/checkout — bidder initiates checkout (session user, or legacy body.bidder)
app.post("/api/checkout", async (req, res) => {
  let bidderIdentifiers = [];
  let userId = null;

  if (req.session?.user) {
    const u = req.session.user;
    bidderIdentifiers.push(u.display_name);
    if (u.table_label) {
      bidderIdentifiers.push(`${u.display_name} (${u.table_label})`);
      bidderIdentifiers.push(u.table_label); // live-auction wins by table
    }
    userId = u.id;
  } else if (req.body?.bidder) {
    bidderIdentifiers = [req.body.bidder];
  }

  if (bidderIdentifiers.length === 0) {
    return res.status(400).json({ error: "Log in or provide bidder name" });
  }

  // All closed items won by this bidder (any of the identifiers) with no completed payment
  const placeholders = bidderIdentifiers.map((_, i) => `$${i + 1}`).join(",");
  const { rows: wonItems } = await dbQuery(
    `SELECT ai.*
     FROM auction_items ai
     LEFT JOIN payments p ON p.item_id = ai.id AND p.bidder = ai.bidder AND p.status = 'paid'
     WHERE ai.status = 'closed' AND ai.bidder IN (${placeholders}) AND p.id IS NULL`,
    bidderIdentifiers
  );

  if (wonItems.length === 0) {
    return res.status(400).json({ error: "No unpaid items found for this bidder" });
  }

  const bidderLabel = req.session?.user
    ? (req.session.user.table_label ? `${req.session.user.display_name} (${req.session.user.table_label})` : req.session.user.display_name)
    : req.body.bidder;

  const lineItems = wonItems.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.title,
        description: item.description || undefined,
        images: [],
      },
      unit_amount: Number(item.current_bid) * 100,
    },
    quantity: 1,
  }));

  try {
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      customer_creation: "always",
      success_url: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/checkout/cancelled`,
      metadata: {
        bidder: bidderLabel,
        item_ids: wonItems.map((i) => i.id).join(","),
      },
      billing_address_collection: "auto",
    });

    for (const item of wonItems) {
      try {
        await dbQuery(
          `INSERT INTO payments (item_id, bidder, amount_cents, stripe_session_id, status, user_id)
           VALUES ($1,$2,$3,$4,'pending',$5)
           ON CONFLICT (stripe_session_id) DO NOTHING`,
          [item.id, item.bidder, Number(item.current_bid) * 100, stripeSession.id, userId]
        );
      } catch (e) {
        if (e.code === "42703") {
          await dbQuery(
            `INSERT INTO payments (item_id, bidder, amount_cents, stripe_session_id, status)
             VALUES ($1,$2,$3,$4,'pending')
             ON CONFLICT (stripe_session_id) DO NOTHING`,
            [item.id, item.bidder, Number(item.current_bid) * 100, stripeSession.id]
          );
        } else throw e;
      }
    }

    res.json({ url: stripeSession.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/checkout/status?bidder=Table+3
app.get("/api/checkout/status", async (req, res) => {
  const { bidder } = req.query;
  if (!bidder) return res.status(400).json({ error: "bidder required" });
  const { rows } = await dbQuery(
    `SELECT ai.id, ai.title, ai.emoji, ai.current_bid, p.status, p.paid_at
     FROM auction_items ai
     JOIN payments p ON p.item_id = ai.id
     WHERE p.bidder = $1
     ORDER BY p.created_at`,
    [bidder]
  );
  res.json(rows);
});

// ─── Stripe Webhook ───────────────────────────────────────────────────────────
app.post("/webhooks/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { bidder, item_ids } = session.metadata;

    await dbQuery(
      `UPDATE payments
       SET status='paid', paid_at=NOW(), stripe_payment_intent=$1
       WHERE stripe_session_id=$2`,
      [session.payment_intent, session.id]
    );

    console.log(`✅ Payment: ${bidder} paid for items [${item_ids}] — $${session.amount_total / 100}`);

    broadcast({
      type: "PAYMENT_RECEIVED",
      bidder,
      itemIds: item_ids.split(",").map(Number),
      amountTotal: session.amount_total / 100,
    });
  }

  if (event.type === "checkout.session.expired") {
    await dbQuery(
      "UPDATE payments SET status='failed' WHERE stripe_session_id=$1",
      [event.data.object.id]
    );
    broadcast({ type: "PAYMENT_FAILED", sessionId: event.data.object.id });
  }

  res.json({ received: true });
});

// ─── Catch-all ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/build/index.html"));
  });
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`✅ GalaBid running on :${PORT}`));
