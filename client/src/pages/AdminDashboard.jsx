import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuctionContext } from "../context/AuctionContext";
import EditItemModal from "../components/EditItemModal";
import { fetchOpts, fmt } from "../utils";

const SectionCard = ({ children, style }) => (
  <div style={{
    background: "#181510", border: "1px solid #2a2520", borderRadius: 12,
    padding: "1.15rem 1.25rem", marginBottom: "1.4rem", ...style
  }}>
    {children}
  </div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#6b5f50", marginBottom: "0.85rem", fontWeight: 600 }}>
    {children}
  </div>
);

export default function AdminDashboard() {
  const {
    user, loggedIn, logout, items, liveItems, settings, payments,
    totalRaised, myBidderIds, notify, closeItem, updateSetting, setShowLoginSheet,
  } = useAuctionContext();
  const navigate = useNavigate();

  const [editItem, setEditItem] = useState(null);
  const [newItem, setNewItem] = useState({ title: "", category: "", description: "", emoji: "🎁", min_bid: "", increment: "25", auction_type: "silent" });

  const setField = (k, v) => setNewItem(prev => ({ ...prev, [k]: v }));

  const getPaymentStatus = (itemId) => {
    const p = payments.find(pm => pm.item_id === itemId && myBidderIds.includes(pm.bidder));
    return p?.status || null;
  };

  const handleAddItem = async () => {
    if (!newItem.title || !newItem.min_bid) return;
    try {
      const res = await fetch("/api/admin/items", {
        method: "POST", ...fetchOpts,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, min_bid: Number(newItem.min_bid), increment: Number(newItem.increment) }),
      });
      if (!res.ok) throw new Error("Unauthorized");
      setNewItem({ title: "", category: "", description: "", emoji: "🎁", min_bid: "", increment: "25", auction_type: "silent" });
      notify("Item added!");
    } catch (err) {
      notify(err.message === "Unauthorized" ? "Not authorized" : "Failed to add item", "error");
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset all bids? This cannot be undone.")) return;
    const res = await fetch("/api/admin/reset", { method: "POST", ...fetchOpts });
    if (!res.ok) notify("Not authorized", "error");
  };

  if (!user?.is_admin) {
    return (
      <div className="login-wrap">
        <div className="login-box">
          <div className="ltitle serif">Admin Access</div>
          {!loggedIn
            ? <>
                <div className="lsub">Sign in with an authorized admin account to manage the auction.</div>
                <button className="btn-enter" onClick={() => setShowLoginSheet(true)}>Sign in →</button>
              </>
            : <>
                <div className="lsub">Your account ({user?.email}) is not on the admin list. Contact the event organizer.</div>
                <button className="btn ghost" style={{ width: "100%", marginTop: "1rem" }} onClick={logout}>Sign out</button>
              </>
          }
        </div>
      </div>
    );
  }

  const silentOpen = settings.auction_open === "true";
  const liveOpen   = settings.live_open === "true";
  const openLiveItems = liveItems.filter(i => i.status === "open");

  return (
    <div className="aw">

      {/* ── Top bar: title + raised ── */}
      <div className="atop">
        <div>
          <div className="atitle serif">Admin Dashboard</div>
          <div className="asub">Manage items · close bidding · run live auction · track payments</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="rlbl">Collected via Stripe</div>
          <div className="raised">{fmt(totalRaised)}</div>
          <button className="btn ghost" style={{ marginTop: "0.5rem", fontSize: "0.75rem" }} onClick={handleReset}>↺ Reset all bids</button>
        </div>
      </div>

      {/* ── Broadcast ── */}
      <SectionCard>
        <SectionLabel>📢 Broadcast to all bidders</SectionLabel>
        {settings.admin_message ? (
          <div className="broadcast-live">
            <span className="broadcast-live-badge">Broadcasting</span>
            <span className="broadcast-live-msg">{settings.admin_message}</span>
            <button className="btn danger" style={{ fontSize: "0.78rem", whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => updateSetting("admin_message", "")}>✕ Dismiss</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.55rem", alignItems: "center" }}>
            <input
              id="broadcast"
              style={{ flex: 1, padding: "0.5rem 0.8rem", borderRadius: "7px", border: "1px solid #2a2520", background: "#0f0e0c", color: "#f0ece4", fontFamily: "'DM Sans',sans-serif", fontSize: "0.83rem", outline: "none" }}
              placeholder="Type a message to display to all bidders…"
              onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { updateSetting("admin_message", e.target.value); e.target.value = ""; } }}
            />
            <button className="btn gold" style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }} onClick={() => {
              const el = document.getElementById("broadcast");
              if (el?.value.trim()) { updateSetting("admin_message", el.value); el.value = ""; }
            }}>📢 Send</button>
          </div>
        )}
      </SectionCard>

      {/* ── Two columns: Silent | Live ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.4rem" }}>

        {/* Silent Auction */}
        <SectionCard style={{ marginBottom: 0 }}>
          <SectionLabel>🤫 Silent Auction</SectionLabel>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.83rem", color: "#f0ece4", fontWeight: 600 }}>
                Bidding is <span style={{ color: silentOpen ? "#6fcf97" : "#eb5757" }}>{silentOpen ? "open" : "paused"}</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "#6b5f50", marginTop: "0.15rem" }}>
                {silentOpen ? "Guests can place bids" : "Bids are blocked until you open"}
              </div>
            </div>
            <button
              className={`btn ${silentOpen ? "danger" : "gold"}`}
              onClick={() => updateSetting("auction_open", silentOpen ? "false" : "true")}
            >
              {silentOpen ? "⏸ Pause" : "▶ Open bidding"}
            </button>
          </div>

          <div style={{ borderTop: "1px solid #2a2520", paddingTop: "0.9rem" }}>
            <div style={{ fontSize: "0.68rem", color: "#6b5f50", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
              Automatic window (optional)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.72rem", color: "#6b5f50", minWidth: 42 }}>Opens</span>
                <input type="datetime-local" value={settings.silent_start || ""} onChange={e => updateSetting("silent_start", e.target.value)}
                  style={{ flex: 1, padding: "0.38rem 0.6rem", borderRadius: "7px", border: "1px solid #2a2520", background: "#0f0e0c", color: "#f0ece4", fontFamily: "'DM Sans',sans-serif", fontSize: "0.8rem", outline: "none" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.72rem", color: "#6b5f50", minWidth: 42 }}>Closes</span>
                <input type="datetime-local" value={settings.silent_end || ""} onChange={e => updateSetting("silent_end", e.target.value)}
                  style={{ flex: 1, padding: "0.38rem 0.6rem", borderRadius: "7px", border: "1px solid #2a2520", background: "#0f0e0c", color: "#f0ece4", fontFamily: "'DM Sans',sans-serif", fontSize: "0.8rem", outline: "none" }} />
              </div>
              {settings.silent_end && (
                <button className="btn ghost" style={{ fontSize: "0.72rem", alignSelf: "flex-start" }} onClick={() => updateSetting("silent_end", "")}>✕ Clear close time</button>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Live Auction */}
        <SectionCard style={{ marginBottom: 0 }}>
          <SectionLabel>🎙️ Live Auction</SectionLabel>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.83rem", color: "#f0ece4", fontWeight: 600 }}>
                Live auction is <span style={{ color: liveOpen ? "#eb5757" : "#6b5f50" }}>{liveOpen ? "active" : "not started"}</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "#6b5f50", marginTop: "0.15rem" }}>
                {liveOpen ? "Scoreboard is live for guests" : "Guests see a Coming Up screen"}
              </div>
            </div>
            <button
              className={`btn ${liveOpen ? "danger" : "gold"}`}
              onClick={() => updateSetting("live_open", liveOpen ? "false" : "true")}
            >
              {liveOpen ? "⏹ End live" : "▶ Start live"}
            </button>
          </div>

          <button className="btn ghost" style={{ width: "100%", marginBottom: "0.75rem" }} onClick={() => navigate("/admin/live")}>
            🎙️ Open Paddle →
          </button>

          {openLiveItems.length > 0 ? (
            <div style={{ borderTop: "1px solid #2a2520", paddingTop: "0.75rem" }}>
              <div style={{ fontSize: "0.68rem", color: "#6b5f50", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                {openLiveItems.length} item{openLiveItems.length !== 1 ? "s" : ""} active
              </div>
              {openLiveItems.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                  <span>{i.emoji} {i.title.split(" ").slice(0, 4).join(" ")}{i.title.split(" ").length > 4 ? "…" : ""}</span>
                  <span style={{ fontFamily: "'Playfair Display',serif", color: "#c9a84c" }}>{fmt(i.current_bid)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ borderTop: "1px solid #2a2520", paddingTop: "0.75rem", fontSize: "0.78rem", color: "#4a3f30" }}>
              No live items currently active
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Add Item ── */}
      <SectionCard>
        <SectionLabel>+ Add Item</SectionLabel>
        <div className="fgrid" style={{ marginBottom: 0 }}>
          <input className="full" placeholder="Title" value={newItem.title} onChange={e => setField("title", e.target.value)} />
          <input placeholder="Category" value={newItem.category} onChange={e => setField("category", e.target.value)} />
          <input placeholder="Emoji" value={newItem.emoji} onChange={e => setField("emoji", e.target.value)} />
          <input className="full" placeholder="Description" value={newItem.description} onChange={e => setField("description", e.target.value)} />
          <input type="number" placeholder="Starting bid ($)" value={newItem.min_bid} onChange={e => setField("min_bid", e.target.value)} />
          <input type="number" placeholder="Increment ($)" value={newItem.increment} onChange={e => setField("increment", e.target.value)} />
          <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "#6b5f50", whiteSpace: "nowrap" }}>Type:</span>
            <select value={newItem.auction_type} onChange={e => setField("auction_type", e.target.value)}
              style={{ flex: 1, padding: "0.45rem 0.55rem", borderRadius: "7px", border: "1px solid #2a2520", background: "#0f0e0c", color: "#f0ece4", fontFamily: "'DM Sans',sans-serif", fontSize: "0.83rem", outline: "none" }}>
              <option value="silent">Silent</option>
              <option value="live">Live</option>
            </select>
          </div>
          <button className="btn gold" onClick={handleAddItem}>+ Add Item</button>
        </div>
      </SectionCard>

      {/* ── Items table ── */}
      <table className="tbl">
        <thead>
          <tr><th>Item</th><th>Type</th><th>Bid</th><th>Leader</th><th>Bids</th><th>Status</th><th>Payment</th><th>Action</th></tr>
        </thead>
        <tbody>
          {items.map(item => {
            const payStatus = getPaymentStatus(item.id);
            return (
              <tr key={item.id}>
                <td>{item.emoji} {item.title}</td>
                <td><span className={`atype-badge ${item.auction_type || "silent"}`}>{item.auction_type || "silent"}</span></td>
                <td style={{ fontFamily: "'Playfair Display',serif", color: "#c9a84c" }}>{fmt(item.current_bid)}</td>
                <td style={{ color: item.bidder ? "#f0ece4" : "#4a3f30" }}>{item.bidder || "—"}</td>
                <td style={{ color: "#9a8e7e" }}>{item.bid_count}</td>
                <td><span className={`sbadge ${item.status}`}>{item.status}</span></td>
                <td>
                  {item.status === "closed" && item.bidder
                    ? <span className={`pay-status ${payStatus || "none"}`}>
                        {payStatus === "paid" ? "✓ Paid" : payStatus === "pending" ? "⏳ Pending" : "— Unpaid"}
                      </span>
                    : <span style={{ color: "#3a3025", fontSize: "0.7rem" }}>—</span>
                  }
                </td>
                <td style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  {item.status === "open" && (
                    <button className="btnsm danger" onClick={() => closeItem(item.id)}>Close</button>
                  )}
                  <button className="btnsm ghost" onClick={() => setEditItem({ ...item })}>Edit</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {editItem && <EditItemModal item={editItem} onClose={() => setEditItem(null)} />}
    </div>
  );
}
