import { Link } from "react-router-dom";

export default function CheckoutCancelled() {
  return (
    <div className="page-center">
      <div className="page-box">
        <div className="big-icon">↩️</div>
        <div className="page-title serif">Payment Cancelled</div>
        <div className="page-sub">
          No worries — your won items are still reserved. You can complete payment any time before the end of the evening.
        </div>
        <Link to="/" className="btn-enter" style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
          ← Back to Auction
        </Link>
      </div>
    </div>
  );
}
