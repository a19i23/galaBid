import { useState, useMemo, useEffect } from "react";
import { useAuctionContext } from "../context/AuctionContext";
import AnnouncementBar from "../components/AnnouncementBar";
import { fmt } from "../utils";

function Countdown({ silentEnd }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!silentEnd) return null;
  const diff = new Date(silentEnd) - now;
  if (diff <= 0) return <div className="countdown ended" style={{ display: "inline-flex", marginTop: "0.6rem" }}>⏱ Silent auction ended</div>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <div className={`countdown${diff < 300_000 ? " urgent" : ""}`} style={{ display: "inline-flex", marginTop: "0.6rem" }}>
      ⏱ Closes in {h > 0 ? `${h}h ` : ""}{String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
    </div>
  );
}

export default function SilentAuction() {
  const {
    user, loggedIn, authLoading, bidderDisplay,
    silentItems, items, settings, connected,
    myBids, myBidderIds, myWonUnpaid, totalRaised,
    handleBid, handleCheckout, checkingOut, getPaymentStatus,
    setShowLoginSheet,
  } = useAuctionContext();

  const [filter, setFilter] = useState("All");

  const categories = useMemo(() => ["All", ...new Set(silentItems.map(i => i.category))], [silentItems]);
  const filtered = useMemo(
    () => filter === "All" ? silentItems : silentItems.filter(i => i.category === filter),
    [silentItems, filter]
  );

  return (
    <>
      <AnnouncementBar message={settings.admin_message} />
      <div className="hero">
        <div className="eyebrow">🤫 Silent Auction · {settings.event_name || "Annual Gala Auction"}</div>
        {loggedIn
          ? <div className="htitle serif">Bidding as <em>{bidderDisplay}</em></div>
          : <div className="htitle serif" style={{ fontSize: "clamp(1.4rem,4vw,2.2rem)" }}>Browse items · sign in to bid</div>
        }

        <Countdown silentEnd={settings.silent_end} />

        {!loggedIn && !authLoading && (
          <div style={{ marginTop: "0.75rem" }}>
            <button className="btn gold" onClick={() => setShowLoginSheet(true)}>Sign in to bid →</button>
          </div>
        )}

        {settings.auction_open !== "true" && (
          <div className="admin-msg" style={{ background: "#331a1a", borderColor: "#5a2a2a", color: "#eb5757", marginTop: "0.75rem" }}>
            ⏸ Bidding is paused. The auction will start when the host opens it.
          </div>
        )}
      </div>

      {myWonUnpaid.length > 0 && (
        <div className="checkout-banner">
          <div>
            <div className="title">🎉 You won {myWonUnpaid.length} item{myWonUnpaid.length !== 1 ? "s" : ""}!</div>
            <div className="sub">Total: {fmt(myWonUnpaid.reduce((s, i) => s + Number(i.current_bid), 0))} — complete payment to secure your items</div>
          </div>
          <button className="btn-checkout" onClick={handleCheckout} disabled={checkingOut}>
            {checkingOut ? "Loading…" : "Pay Now with Card →"}
          </button>
        </div>
      )}

      <div className="stats">
        <div className="stat"><div className="v">{silentItems.filter(i => i.status === "open").length}</div><div className="l">Items Open</div></div>
        <div className="stat"><div className="v">{silentItems.reduce((s, i) => s + Number(i.bid_count), 0)}</div><div className="l">Total Bids</div></div>
        <div className="stat"><div className="v">{Object.keys(myBids).length}</div><div className="l">My Bids</div></div>
        <div className="stat"><div className="v">{fmt(totalRaised)}</div><div className="l">Raised</div></div>
      </div>

      <div className="filters">
        {categories.map(c => (
          <button key={c} className={`chip${filter === c ? " on" : ""}`} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>

      <div className="grid">
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem 2rem", color: "#6b5f50", background: "#181510", borderRadius: 12, border: "1px solid #2a2520" }}>
            {silentItems.length === 0 ? (
              <>
                <p style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>No silent auction items yet</p>
                {items.length === 0 && <p style={{ fontSize: "0.8rem" }}>Make sure the server is running and the DB is seeded.</p>}
                {!connected && <p style={{ fontSize: "0.8rem", marginTop: "0.75rem", color: "#eb5757" }}>Not connected — start the backend on port 8080.</p>}
              </>
            ) : (
              <p style={{ fontSize: "0.9rem" }}>No items in category "{filter}"</p>
            )}
          </div>
        )}
        {filtered.map(item => {
          const isMine = item.bidder && myBidderIds.includes(item.bidder);
          const isPaid = getPaymentStatus(item.id) === "paid";
          return (
            <div key={item.id} className={`card${item.status === "closed" ? " closed" : ""}`}>
              <div className="cimg">{item.emoji}</div>
              <div className="cbody">
                <div className="ccat">{item.category}</div>
                <div className="ctitle serif">{item.title}</div>
                <div className="cdesc">{item.description}</div>
                <div className="spacer" />
                <div className="bidrow">
                  <div>
                    <div className="blbl">{Number(item.bid_count) === 0 ? "Starting Bid" : "Current Bid"}</div>
                    <div className="bamt">{fmt(item.current_bid)}</div>
                  </div>
                  <div>
                    <div className="bmeta">+{fmt(item.increment)}/bid</div>
                    {item.bidder && <div className="bleader">{isMine ? "🏆 You're winning!" : item.bidder + " leading"}</div>}
                    {Number(item.bid_count) > 0 && <div className="bmeta">{item.bid_count} bid{item.bid_count !== 1 ? "s" : ""}</div>}
                  </div>
                </div>
                {item.status === "closed"
                  ? isMine && isPaid
                    ? <button className="bidbtn done" style={{ color: "#27ae60", borderColor: "#27ae60" }}>✓ Paid</button>
                    : isMine
                      ? <button className="bidbtn go" onClick={handleCheckout} disabled={checkingOut}>{checkingOut ? "Loading…" : "💳 Pay Now"}</button>
                      : <button className="bidbtn done">Bidding Closed</button>
                  : settings.auction_open !== "true"
                    ? <button className="bidbtn done">Bidding paused</button>
                    : !loggedIn
                      ? <button className="bidbtn go" onClick={() => setShowLoginSheet(true)}>Sign in to bid</button>
                      : isMine
                        ? <button className="bidbtn win">✓ You're Winning</button>
                        : <button className="bidbtn go" onClick={() => handleBid(item.id)}>Bid {fmt(Number(item.current_bid) + Number(item.increment))}</button>
                }
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
