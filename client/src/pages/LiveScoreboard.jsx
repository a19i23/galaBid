import { useAuctionContext } from "../context/AuctionContext";
import AnnouncementBar from "../components/AnnouncementBar";
import { fmt } from "../utils";

export default function LiveScoreboard() {
  const { liveItems, settings } = useAuctionContext();
  const liveOpen = settings.live_open === "true";

  return (
    <>
      <AnnouncementBar message={settings.admin_message} />
      <div className="scoreboard">
        <div className="sboard-hdr">
          <div className="eyebrow">🎙️ Live Auction · {settings.event_name || "Annual Gala Auction"}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
            <div className="htitle serif" style={{ fontSize: "clamp(1.4rem,4vw,2.2rem)", marginBottom: 0 }}>
              Live Auction <em style={{ color: "#c9a84c" }}>Scoreboard</em>
            </div>
            {liveOpen
              ? <span className="lbadge" style={{ marginBottom: 0 }}><span className="ldot" />Live</span>
              : <span style={{ fontSize: "0.72rem", padding: "0.25rem 0.7rem", borderRadius: 10, background: "#1f1b14", border: "1px solid #2a2520", color: "#6b5f50" }}>Coming Up</span>
            }
          </div>
          <div style={{ fontSize: "0.82rem", color: "#6b5f50", marginTop: "0.4rem" }}>
            {liveOpen
              ? "Bids are placed live by the auctioneer · scores update in real time"
              : "Preview tonight's live auction items below — bidding opens soon"
            }
          </div>
        </div>

        {liveItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 2rem", color: "#6b5f50", background: "#181510", borderRadius: 12, border: "1px solid #2a2520" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎙️</div>
            <p style={{ fontSize: "1rem", marginBottom: "0.4rem", color: "#9a8e7e" }}>Live auction items coming soon</p>
            <p style={{ fontSize: "0.82rem" }}>Check back shortly — items will appear here before the live round begins.</p>
          </div>
        ) : (
          <div className="sboard-list">
            {liveItems.map((item, idx) => (
              <div key={item.id} className={`sboard-item${item.status === "closed" ? " closed" : ""}`}>
                <div className="sboard-rank">#{idx + 1}</div>
                <div className="sboard-emoji">{item.emoji}</div>
                <div className="sboard-info">
                  <div className="sboard-title serif">{item.title}</div>
                  <div className="sboard-desc">{item.description}</div>
                </div>
                <div className="sboard-bid">
                  {liveOpen ? (
                    <>
                      <div className="sboard-amt">{fmt(item.current_bid)}</div>
                      <div className="sboard-leader">
                        {item.bidder || "No bids yet"}
                        {Number(item.bid_count) > 0 && <span style={{ color: "#3a3025" }}> · {item.bid_count} bid{item.bid_count !== 1 ? "s" : ""}</span>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="sboard-amt" style={{ color: "#6b5f50", fontSize: "1rem" }}>{fmt(item.min_bid)}</div>
                      <div className="sboard-leader">Starting bid</div>
                    </>
                  )}
                </div>
                {liveOpen
                  ? <span className={`sboard-status ${item.status}`}>{item.status === "closed" ? "Sold" : "Active"}</span>
                  : <span className="sboard-status" style={{ background: "#1a2233", color: "#7eb8f7", border: "1px solid #2a3a5a" }}>Preview</span>
                }
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
