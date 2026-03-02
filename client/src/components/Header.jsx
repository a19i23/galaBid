import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuctionContext } from "../context/AuctionContext";

export default function Header() {
  const { user, authLoading, loggedIn, connected, myBids, setShowLoginSheet, logout } = useAuctionContext();
  const navigate = useNavigate();
  const location = useLocation();

  const myBidsCount = Object.keys(myBids).length;

  return (
    <div className="hdr">
      <div className="logo">Gala<span>Bid</span></div>

      <nav className="nav">
        <NavLink to="/" end className={({ isActive }) => `nb${isActive ? " on" : ""}`}>
          🤫 Silent
        </NavLink>
        <NavLink to="/live" className={({ isActive }) => `nb${isActive ? " on" : ""}`}>
          🎙️ Live
        </NavLink>
        <button
          className={`nb${location.pathname === "/my-bids" ? " on" : ""}`}
          onClick={() => loggedIn ? navigate("/my-bids") : setShowLoginSheet(true)}
        >
          📋 My Bids{myBidsCount > 0 ? ` (${myBidsCount})` : ""}
        </button>
        <NavLink to="/admin" className={({ isActive }) => `nb${isActive ? " on" : ""}`}>
          ⚙️ Admin
        </NavLink>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        {!authLoading && (
          loggedIn && user
            ? <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                {user.avatar_url && (
                  <img src={user.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #2a2520" }} />
                )}
                <span style={{ fontSize: "0.75rem", color: "#9a8e7e", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.display_name}
                </span>
                <button className="btn ghost" style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }} onClick={logout}>
                  Sign out
                </button>
              </div>
            : <button className="btn gold" style={{ fontSize: "0.75rem", padding: "0.35rem 0.8rem" }} onClick={() => setShowLoginSheet(true)}>
                Sign in
              </button>
        )}
        <div className="conn">
          <span className={`dot ${connected ? "live" : "dead"}`} />
          {connected ? "Live" : "Reconnecting…"}
        </div>
      </div>
    </div>
  );
}
