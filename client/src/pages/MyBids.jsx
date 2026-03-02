import { useAuctionContext } from "../context/AuctionContext";
import { fmt } from "../utils";

export default function MyBids() {
  const { loggedIn, items, myBids, myBidderIds, myWonUnpaid, handleCheckout, checkingOut, getPaymentStatus, setShowLoginSheet } = useAuctionContext();

  if (!loggedIn) {
    return (
      <div className="login-wrap">
        <div className="login-box">
          <div className="ltitle serif">My Bids</div>
          <div className="lsub">Sign in to see your bids and pay for items you've won.</div>
          <button className="btn-enter" onClick={() => setShowLoginSheet(true)}>Sign in to view →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="stitle serif">My Bids</div>

      {myWonUnpaid.length > 0 && (
        <div className="checkout-banner" style={{ marginBottom: "1.5rem", marginLeft: 0, marginRight: 0 }}>
          <div>
            <div className="title">💳 {myWonUnpaid.length} item{myWonUnpaid.length !== 1 ? "s" : ""} awaiting payment</div>
            <div className="sub">Total: {fmt(myWonUnpaid.reduce((s, i) => s + Number(i.current_bid), 0))}</div>
          </div>
          <button className="btn-checkout" onClick={handleCheckout} disabled={checkingOut}>
            {checkingOut ? "Loading…" : "Pay Now →"}
          </button>
        </div>
      )}

      {Object.keys(myBids).length === 0
        ? <p style={{ color: "#6b5f50" }}>No bids yet — head to the Silent tab!</p>
        : (
          <div className="blist">
            {items.filter(i => myBids[i.id]).map(item => {
              const winning = item.bidder && myBidderIds.includes(item.bidder);
              const closed = item.status === "closed";
              const payStatus = getPaymentStatus(item.id);
              let badgeClass = "outbid", badgeText = "Outbid";
              if (!closed && winning)                              { badgeClass = "winning"; badgeText = "Winning"; }
              else if (closed && winning && payStatus === "paid") { badgeClass = "paid";    badgeText = "Paid ✓"; }
              else if (closed && winning)                         { badgeClass = "won";     badgeText = "Won 🏆"; }
              else if (closed && !winning)                        { badgeClass = "lost";    badgeText = "Lost"; }
              return (
                <div key={item.id} className="bitem">
                  <div>
                    <div className="bname serif">{item.emoji} {item.title}</div>
                    <div className="bamt2">Current: {fmt(item.current_bid)}</div>
                  </div>
                  <span className={`badge ${badgeClass}`}>{badgeText}</span>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
