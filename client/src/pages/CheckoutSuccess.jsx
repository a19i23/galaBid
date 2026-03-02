import { Link } from "react-router-dom";

export default function CheckoutSuccess() {
  return (
    <div className="page-center">
      <div className="page-box">
        <div className="big-icon">🎉</div>
        <div className="page-title serif">Payment Received!</div>
        <div className="page-sub">
          Thank you! Your payment was successful. You'll receive a receipt from Stripe shortly.
          Collect your items at the pickup table at the end of the evening.
        </div>
        <Link to="/" className="btn-enter" style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
          ← Back to Auction
        </Link>
      </div>
    </div>
  );
}
