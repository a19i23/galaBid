import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuctionContext } from "../context/AuctionContext";
import { fmt } from "../utils";

export default function LivePaddle() {
  const { user, items, liveItems, closeItem, liveBid, notify } = useAuctionContext();
  const navigate = useNavigate();

  const firstOpen = liveItems.find(i => i.status === "open");
  const [liveItemId, setLiveItemId] = useState(firstOpen?.id || null);

  const liveItem = useMemo(() => items.find(i => i.id === liveItemId), [items, liveItemId]);

  const handleSold = () => {
    closeItem(liveItemId);
    notify(`SOLD! ${liveItem?.bidder} wins "${liveItem?.title}" for ${fmt(liveItem?.current_bid)}`);
    setLiveItemId(null);
    navigate("/admin");
  };

  if (!user?.is_admin) {
    return (
      <div className="live-wrap">
        <div style={{ color: "#eb5757", marginBottom: "1rem" }}>Admin access required.</div>
        <button className="btn-back" onClick={() => navigate("/admin")}>← Admin</button>
      </div>
    );
  }

  return (
    <div className="live-wrap">
      {liveItem ? (
        <>
          <div className="lbadge"><span className="ldot" />Live Auction</div>
          <div className="lemoji">{liveItem.emoji}</div>
          <div className="ltitle2 serif">{liveItem.title}</div>
          <div className="ldesc">{liveItem.description}</div>
          <div className="lamt">{fmt(liveItem.current_bid)}</div>
          <div className="lleader">
            {liveItem.bidder ? `Current leader: ${liveItem.bidder}` : `Opening at ${fmt(liveItem.min_bid)}`}
            {Number(liveItem.bid_count) > 0 && <span style={{ marginLeft: "0.75rem", color: "#3a3025" }}>• {liveItem.bid_count} bids</span>}
          </div>
          <div className="hint">
            Click a name to record their bid of <strong style={{ color: "#c9a84c" }}>{fmt(Number(liveItem.current_bid) + Number(liveItem.increment))}</strong>
          </div>

          <div className="pgrid">
            {[...new Set(items.filter(i => i.bidder).map(i => i.bidder))].map(name => (
              <button key={name} className={`pbtn${liveItem.bidder === name ? " winner" : ""}`} onClick={() => liveBid(liveItemId, name)}>
                {name}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", maxWidth: 360, width: "100%" }}>
            <input
              id="live-new-bidder"
              type="text"
              placeholder="New bidder name…"
              style={{ flex: 1, padding: "0.55rem 0.8rem", borderRadius: "8px", border: "1px solid #2a2520", background: "#181510", color: "#f0ece4", fontFamily: "'DM Sans',sans-serif", fontSize: "0.84rem", outline: "none" }}
              onKeyDown={e => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  liveBid(liveItemId, e.target.value.trim());
                  e.target.value = "";
                }
              }}
            />
            <button className="btn gold" style={{ whiteSpace: "nowrap" }} onClick={() => {
              const el = document.getElementById("live-new-bidder");
              if (el?.value.trim()) { liveBid(liveItemId, el.value.trim()); el.value = ""; }
            }}>+ Bid</button>
          </div>

          {liveItems.filter(i => i.status === "open" && i.id !== liveItemId).length > 0 && (
            <div style={{ marginBottom: "1.25rem", display: "flex", gap: "0.45rem", flexWrap: "wrap", justifyContent: "center" }}>
              {liveItems.filter(i => i.status === "open" && i.id !== liveItemId).map(i => (
                <button key={i.id} className="btn ghost" style={{ fontSize: "0.75rem" }} onClick={() => setLiveItemId(i.id)}>
                  {i.emoji} {i.title.split(" ").slice(0, 3).join(" ")}…
                </button>
              ))}
            </div>
          )}

          <div className="live-footer">
            <button className="btn-sold" disabled={!liveItem.bidder} onClick={handleSold}>
              🔨 SOLD — {liveItem.bidder || "No bidder"} — {fmt(liveItem.current_bid)}
            </button>
            <button className="btn-back" onClick={() => navigate("/admin")}>← Admin</button>
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#6b5f50", marginBottom: "1rem" }}>Select a live auction item:</div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center", marginBottom: "2rem" }}>
            {liveItems.filter(i => i.status === "open").map(i => (
              <button key={i.id} className="btn gold" onClick={() => setLiveItemId(i.id)}>{i.emoji} {i.title}</button>
            ))}
            {liveItems.filter(i => i.status === "open").length === 0 && (
              <div style={{ color: "#6b5f50", fontSize: "0.85rem" }}>No open live auction items. Add items with type "Live" in the admin dashboard.</div>
            )}
          </div>
          <button className="btn-back" onClick={() => navigate("/admin")}>← Back</button>
        </div>
      )}
    </div>
  );
}
