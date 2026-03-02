import { useState } from "react";
import { useAuctionContext } from "../context/AuctionContext";
import { fetchOpts } from "../utils";

export default function EditItemModal({ item, onClose }) {
  const { notify } = useAuctionContext();
  const [draft, setDraft] = useState({ ...item });

  const set = (key, val) => setDraft(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    const { id, title, category, description, emoji, min_bid, current_bid, increment, bidder, status, auction_type } = draft;
    const res = await fetch(`/api/admin/items/${id}`, {
      method: "PATCH",
      ...fetchOpts,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, category, description, emoji,
        min_bid: Number(min_bid),
        current_bid: Number(current_bid),
        increment: Number(increment),
        bidder: bidder || null,
        status,
        auction_type: auction_type || "silent",
      }),
    });
    if (res.ok) { onClose(); notify("Item updated!"); }
    else notify("Failed to save", "error");
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-title">
          <span>Edit Item</span>
          <button className="btn ghost" style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }} onClick={onClose}>✕</button>
        </div>

        <div className="modal-grid">
          <div className="full">
            <div className="modal-lbl">Title</div>
            <input className="full" value={draft.title} onChange={e => set("title", e.target.value)} />
          </div>
          <div>
            <div className="modal-lbl">Category</div>
            <input value={draft.category} onChange={e => set("category", e.target.value)} />
          </div>
          <div>
            <div className="modal-lbl">Emoji</div>
            <input value={draft.emoji} onChange={e => set("emoji", e.target.value)} />
          </div>
          <div className="full">
            <div className="modal-lbl">Description</div>
            <input className="full" value={draft.description || ""} onChange={e => set("description", e.target.value)} />
          </div>
          <div>
            <div className="modal-lbl">Starting bid ($)</div>
            <input type="number" value={draft.min_bid} onChange={e => set("min_bid", e.target.value)} />
          </div>
          <div>
            <div className="modal-lbl">Increment ($)</div>
            <input type="number" value={draft.increment} onChange={e => set("increment", e.target.value)} />
          </div>
          <div>
            <div className="modal-lbl">{draft.status === "closed" ? "Final bid ($)" : "Current bid ($)"}</div>
            <input type="number" value={draft.current_bid} onChange={e => set("current_bid", e.target.value)} />
          </div>
          <div>
            <div className="modal-lbl">{draft.status === "closed" ? "Winner" : "Current leader"}</div>
            <input value={draft.bidder || ""} placeholder="—" onChange={e => set("bidder", e.target.value)} />
          </div>
          <div>
            <div className="modal-lbl">Status</div>
            <select value={draft.status} onChange={e => set("status", e.target.value)}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <div className="modal-lbl">Auction Type</div>
            <select value={draft.auction_type || "silent"} onChange={e => set("auction_type", e.target.value)}>
              <option value="silent">Silent</option>
              <option value="live">Live</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.55rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn gold" onClick={handleSave}>Save changes</button>
        </div>
      </div>
    </div>
  );
}
