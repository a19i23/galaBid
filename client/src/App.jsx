import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuctionProvider, useAuctionContext } from "./context/AuctionContext";
import Header from "./components/Header";
import LoginSheet from "./components/LoginSheet";
import SilentAuction from "./pages/SilentAuction";
import LiveScoreboard from "./pages/LiveScoreboard";
import MyBids from "./pages/MyBids";
import AdminDashboard from "./pages/AdminDashboard";
import LivePaddle from "./pages/LivePaddle";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import CheckoutCancelled from "./pages/CheckoutCancelled";
import "./styles.css";

function AppInner() {
  const { notification, showLoginSheet, setShowLoginSheet } = useAuctionContext();

  return (
    <div className="app">
      <Header />
      {notification && <div className={`notif ${notification.type}`}>{notification.msg}</div>}
      {showLoginSheet && <LoginSheet onClose={() => setShowLoginSheet(false)} />}
      <Routes>
        <Route path="/" element={<SilentAuction />} />
        <Route path="/live" element={<LiveScoreboard />} />
        <Route path="/my-bids" element={<MyBids />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/live" element={<LivePaddle />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancelled" element={<CheckoutCancelled />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuctionProvider>
        <AppInner />
      </AuctionProvider>
    </BrowserRouter>
  );
}
