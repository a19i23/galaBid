import { useAuctionContext } from "../context/AuctionContext";
import { requestNotificationPermission } from "../hooks/useAuction";

export default function LoginSheet({ onClose }) {
  const { settings, table, setTable, setLoggedIn } = useAuctionContext();
  const googleHref = window.location.port === "3000" ? "http://localhost:8080/auth/google" : "/auth/google";

  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-title">Sign in to bid</div>
        <div className="sheet-sub">
          {settings.event_name || "Annual Gala Auction"}<br />
          Sign in with your Google account — each person can bid individually.
        </div>

        <a href={googleHref} className="social-btn">
          <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </a>

        <div className="divider">or continue as guest</div>

        <input
          type="text"
          placeholder="Your name (e.g. Jane Smith)"
          defaultValue={table}
          onChange={e => setTable(e.target.value.trim())}
          style={{ width: "100%", padding: "0.75rem 0.9rem", borderRadius: "10px", border: "1px solid #2a2520", background: "#0f0e0c", color: "#f0ece4", fontFamily: "'DM Sans',sans-serif", fontSize: "0.88rem", marginBottom: "0.65rem", outline: "none" }}
          autoComplete="name"
        />
        <button className="btn-enter" disabled={!table} onClick={async () => {
          await requestNotificationPermission();
          setLoggedIn(true);
          onClose();
        }}>
          Continue as {table || "guest"} →
        </button>

        <button className="btn ghost" style={{ width: "100%", marginTop: "0.75rem", padding: "0.6rem" }} onClick={onClose}>
          Just browsing →
        </button>
      </div>
    </div>
  );
}
