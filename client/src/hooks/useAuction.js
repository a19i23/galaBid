import { useEffect, useRef, useState, useCallback } from "react";

// ─── Browser Notification Helper ─────────────────────────────────────────────
// Fires a native OS notification even when the tab is backgrounded.
// Silently does nothing if permission wasn't granted.
function pushNotify(title, body, { onClick } = {}) {
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "galabid-outbid",   // replaces previous notification instead of stacking
    renotify: true,          // still vibrates/sounds even if replacing same tag
  });
  if (onClick) n.onclick = () => { window.focus(); onClick(); n.close(); };
}

// Call this once at login — shows the browser permission prompt.
// Returns true if granted, false if denied/dismissed.
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// myTable: the current bidder's table name, e.g. "Table 3"
// Pass null/empty until logged in — hook will still connect, just won't fire
// personal notifications.
export function useAuction(myTable = "") {
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({});
  const [payments, setPayments] = useState([]);
  const [connected, setConnected] = useState(false);
  const [notification, setNotification] = useState(null);

  const wsRef = useRef(null);
  const notifTimer = useRef(null);
  const myTableRef = useRef(myTable);

  // Keep ref in sync so the WS message handler always sees the latest table
  useEffect(() => { myTableRef.current = myTable; }, [myTable]);

  // In-app toast notification
  const notify = useCallback((msg, type = "success") => {
    clearTimeout(notifTimer.current);
    setNotification({ msg, type });
    notifTimer.current = setTimeout(() => setNotification(null), 4500);
  }, []);

  const connect = useCallback(() => {
    const wsUrl =
      process.env.REACT_APP_WS_URL ||
      (window.location.protocol === "https:" ? "wss://" : "ws://") +
        window.location.host;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const me = myTableRef.current;

      switch (msg.type) {

        case "INIT":
          setItems(msg.items);
          setSettings(msg.settings || {});
          setPayments(msg.payments || []);
          break;

        case "BID_PLACED":
          setItems((prev) => {
            const updated = prev.map((i) =>
              i.id === msg.itemId
                ? { ...i, current_bid: msg.newBid, bidder: msg.bidder, bid_count: msg.bidCount }
                : i
            );

            // Fire outbid notification if I just got knocked off
            if (me && msg.prevBidder === me && msg.bidder !== me) {
              const item = prev.find((i) => i.id === msg.itemId);
              pushNotify(
                "🔔 You've been outbid!",
                `${item?.title || "An item"} — new bid: $${Number(msg.newBid).toLocaleString()}. Tap to bid back.`,
                { onClick: () => window.focus() }
              );
              notify(`You were outbid on "${item?.title}"! Bid back now.`, "warning");
            }

            return updated;
          });
          break;

        case "LIVE_BID_UPDATE":
          setItems((prev) =>
            prev.map((i) =>
              i.id === msg.itemId
                ? { ...i, current_bid: msg.newBid, bidder: msg.bidder, bid_count: msg.bidCount }
                : i
            )
          );
          break;

        case "ITEM_CLOSED":
          setItems((prev) => {
            const updated = prev.map((i) =>
              i.id === msg.itemId ? { ...i, status: "closed" } : i
            );

            if (me && msg.winner === me) {
              // I won!
              const item = prev.find((i) => i.id === msg.itemId);
              pushNotify(
                "🏆 You won!",
                `${item?.title || "An item"} — $${Number(msg.amount).toLocaleString()}. Head to the Bid tab to pay.`
              );
              notify(`🏆 You won "${item?.title}"! Complete payment in your Bid tab.`, "success");
            } else if (msg.winner) {
              notify(`Bidding closed — winner: ${msg.winner} at $${Number(msg.amount).toLocaleString()}`, "warning");
            }

            return updated;
          });
          break;

        case "ITEM_ADDED":
          setItems((prev) => [...prev, msg.item]);
          break;

        case "ITEM_UPDATED":
          setItems((prev) => prev.map((i) => i.id === msg.item.id ? msg.item : i));
          break;

        case "AUCTION_RESET":
          setItems(msg.items);
          setPayments([]);
          notify("Auction has been reset", "warning");
          break;

        case "SETTING_UPDATED":
          setSettings((prev) => ({ ...prev, [msg.key]: msg.value }));
          break;

        case "PAYMENT_RECEIVED":
          setPayments((prev) =>
            prev.map((p) =>
              msg.itemIds.includes(p.item_id) && p.bidder === msg.bidder
                ? { ...p, status: "paid" }
                : p
            )
          );
          notify(`💳 Payment received from ${msg.bidder} — $${Number(msg.amountTotal).toLocaleString()}`, "success");
          break;

        case "PAYMENT_FAILED":
          notify("A payment session expired", "warning");
          break;

        case "BID_ERROR":
          notify(msg.message, "error");
          break;

        default:
          break;
      }
    };
  }, [notify]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  // If we're connected but have no items, fetch from REST (e.g. INIT was empty or missed)
  useEffect(() => {
    if (!connected || items.length > 0) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/items");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) setItems(data);
        }
      } catch (_) {}
    }, 1500);
    return () => clearTimeout(t);
  }, [connected, items.length]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return {
    items,
    settings,
    payments,
    connected,
    notification,
    notify,
    placeBid:      (itemId, bidder) => send({ type: "PLACE_BID",      itemId, bidder }),
    closeItem:     (itemId)        => send({ type: "CLOSE_ITEM",     itemId }),
    liveBid:       (itemId, bidder) => send({ type: "LIVE_BID",      itemId, bidder }),
    updateSetting: (key, value)    => send({ type: "UPDATE_SETTING", key, value }),
  };
}
