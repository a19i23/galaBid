import { createContext, useContext, useState, useMemo, useEffect, useCallback } from "react";
import { useAuction, requestNotificationPermission } from "../hooks/useAuction";
import { fetchOpts } from "../utils";

const AuctionContext = createContext(null);

export function AuctionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [table, setTable] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [myBids, setMyBids] = useState({});
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const bidderDisplay = useMemo(() => {
    if (user) return user.display_name;
    return table;
  }, [user, table]);

  const { items, settings, payments, connected, notification, notify,
    placeBid, closeItem, liveBid, updateSetting } = useAuction(bidderDisplay);

  // Load user on mount; handle OAuth handoff token in query string
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error")) {
      window.history.replaceState({}, "", window.location.pathname);
      notify(params.get("auth_error") === "config" ? "Google login not configured" : "Login failed. Try again.", "error");
      setAuthLoading(false);
      return;
    }
    const sessionToken = params.get("session");
    if (sessionToken) {
      fetch("/auth/session", {
        method: "POST",
        ...fetchOpts,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: sessionToken }),
      })
        .then((r) => {
          if (!r.ok) return r.json().then((err) => { throw new Error(err.error || "Sign-in failed"); });
          return r.json();
        })
        .then((data) => {
          setUser(data);
          setLoggedIn(true);
          const u = new URL(window.location.href);
          u.searchParams.delete("session");
          window.history.replaceState({}, "", u.pathname + u.search);
        })
        .catch((err) => {
          notify(err.message || "Sign-in failed. Try again.", "error");
          const u = new URL(window.location.href);
          u.searchParams.delete("session");
          window.history.replaceState({}, "", u.pathname + u.search);
        })
        .finally(() => setAuthLoading(false));
      return;
    }
    fetch("/auth/me", fetchOpts)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setUser(data); if (data) setLoggedIn(true); })
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []); // eslint-disable-line

  const logout = useCallback(() => {
    fetch("/auth/logout", { method: "POST", ...fetchOpts }).then(() => {
      setUser(null);
      setTable("");
      setLoggedIn(false);
      setMyBids({});
    });
  }, []);

  const silentItems = useMemo(() => items.filter(i => i.auction_type === "silent"), [items]);
  const liveItems   = useMemo(() => items.filter(i => i.auction_type === "live"),   [items]);

  const totalRaised = useMemo(() => {
    const paidIds = new Set(payments.filter(p => p.status === "paid").map(p => p.item_id));
    return items.filter(i => paidIds.has(i.id)).reduce((s, i) => s + Number(i.current_bid), 0);
  }, [items, payments]);

  const myBidderIds = useMemo(() => {
    const ids = [];
    if (user) ids.push(user.display_name);
    if (table) ids.push(table);
    return ids;
  }, [user, table]);

  const myWonUnpaid = useMemo(() =>
    items.filter(i =>
      i.status === "closed" &&
      i.bidder && myBidderIds.includes(i.bidder) &&
      myBids[i.id] &&
      !payments.find(p => p.item_id === i.id && myBidderIds.includes(p.bidder) && p.status === "paid")
    ), [items, myBidderIds, myBids, payments]);

  const getPaymentStatus = useCallback((itemId) => {
    const p = payments.find(pm => pm.item_id === itemId && myBidderIds.includes(pm.bidder));
    return p?.status || null;
  }, [payments, myBidderIds]);

  const handleBid = useCallback((itemId) => {
    if (!loggedIn) { setShowLoginSheet(true); return; }
    if (user) {
      fetch("/api/bid", {
        method: "POST", ...fetchOpts,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      })
        .then((r) => r.json().then((d) => ({ ok: r.ok, ...d })))
        .then(({ ok, error }) => {
          if (ok) { setMyBids(prev => ({ ...prev, [itemId]: true })); notify("Bid placed! You're winning 🏆"); }
          else notify(error || "Bid failed", "error");
        })
        .catch(() => notify("Bid failed", "error"));
    } else {
      placeBid(itemId, table);
      setMyBids(prev => ({ ...prev, [itemId]: true }));
      notify("Bid placed! You're winning 🏆");
    }
  }, [loggedIn, user, table, placeBid, notify]);

  const handleCheckout = useCallback(async () => {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", ...fetchOpts,
        headers: { "Content-Type": "application/json" },
        body: user ? JSON.stringify({}) : JSON.stringify({ bidder: table }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else notify(data.error || "Checkout error", "error");
    } catch {
      notify("Could not connect to payment service", "error");
    } finally {
      setCheckingOut(false);
    }
  }, [user, table, notify]);

  return (
    <AuctionContext.Provider value={{
      user, setUser, authLoading, table, setTable, loggedIn, setLoggedIn, logout,
      showLoginSheet, setShowLoginSheet, myBids, setMyBids, checkingOut,
      items, settings, payments, connected, notification, notify,
      placeBid, closeItem, liveBid, updateSetting,
      bidderDisplay, silentItems, liveItems, myBidderIds, myWonUnpaid, totalRaised,
      handleBid, handleCheckout, getPaymentStatus,
    }}>
      {children}
    </AuctionContext.Provider>
  );
}

export const useAuctionContext = () => useContext(AuctionContext);
