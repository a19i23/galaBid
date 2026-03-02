#!/usr/bin/env node
/**
 * Seed the database with 10 auction items.
 * Run: node scripts/seed.js
 * Uses DATABASE_URL from .env (same as server).
 *
 * This clears existing bids and payments (due to FK), then auction_items,
 * and inserts 10 new items so you get a clean set of 10.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Items with auction_type: "silent" go in the self-serve bidding tab.
// Items with auction_type: "live" are run by the auctioneer and shown as a read-only scoreboard.
const ITEMS = [
  { auction_type: "silent", title: "Weekend Getaway – Big Bear Cabin", category: "Travel", description: "2-night stay for up to 8 guests in a luxury mountain setting.", emoji: "🏔️", min_bid: 500, increment: 25 },
  { auction_type: "silent", title: "Chef's Table Dinner for 6", category: "Dining", description: "Private 5-course dinner prepared by Chef Marco at your home.", emoji: "🍽️", min_bid: 350, increment: 25 },
  { auction_type: "silent", title: "Disneyland 4-Pack", category: "Entertainment", description: "4 one-day park hopper tickets. Valid through Dec 2025.", emoji: "🎢", min_bid: 600, increment: 25 },
  { auction_type: "silent", title: "Principal for a Day", category: "School", description: "Your child runs the school for a day — morning news, lunch pick & more!", emoji: "🏫", min_bid: 150, increment: 10 },
  { auction_type: "silent", title: "Private Surf Lesson (4 ppl)", category: "Experiences", description: "2-hour surf lesson with pro instructor at Malibu. Boards included.", emoji: "🏄", min_bid: 200, increment: 10 },
  { auction_type: "silent", title: "Spa Day for Two", category: "Wellness", description: "Full day at Spa Montage — facials, massages, and all amenities.", emoji: "🧖", min_bid: 400, increment: 25 },
  { auction_type: "silent", title: "Art Class Package", category: "School", description: "10-week private art lessons with our school's beloved art teacher.", emoji: "🎨", min_bid: 100, increment: 10 },
  { auction_type: "silent", title: "Wine Tasting for 8", category: "Dining", description: "Private tasting at a local vineyard with charcuterie. Weekend date TBD.", emoji: "🍷", min_bid: 300, increment: 25 },
  { auction_type: "live", title: "Lakers Floor Seats (2)", category: "Sports", description: "Two floor seats to a home Lakers game. Row 3, center court.", emoji: "🏀", min_bid: 800, increment: 50 },
  { auction_type: "live", title: "Hot Air Balloon Ride (2)", category: "Experiences", description: "Sunrise balloon flight for two over Napa Valley. Champagne included.", emoji: "🎈", min_bid: 550, increment: 50 },
  { auction_type: "live", title: "Private Yacht Day (8 ppl)", category: "Experiences", description: "Full-day charter on a 50-ft yacht departing Marina del Rey. Catering included.", emoji: "⛵", min_bid: 1500, increment: 100 },
  { auction_type: "live", title: "Celebrity Chef Cooking Class", category: "Dining", description: "Hands-on cooking class for 10 with a James Beard–nominated chef.", emoji: "👨‍🍳", min_bid: 1000, increment: 100 },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM payments");
    await client.query("DELETE FROM bids");
    await client.query("DELETE FROM auction_items");
    // Reset all auction settings to a clean starting state
    await client.query(`
      INSERT INTO settings (key,value) VALUES
        ('auction_open','false'),
        ('live_open','false'),
        ('admin_message','')
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`);

    for (const item of ITEMS) {
      await client.query(
        `INSERT INTO auction_items (title, category, description, emoji, min_bid, current_bid, increment, auction_type)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7)`,
        [item.title, item.category, item.description, item.emoji, item.min_bid, item.increment, item.auction_type]
      );
    }
    console.log(`Seeded ${ITEMS.length} auction items.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
