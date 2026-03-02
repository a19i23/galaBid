export default function AnnouncementBar({ message }) {
  if (!message) return null;
  return (
    <div className="announce-bar">
      <span className="announce-pulse">📢 Announcement</span>
      <span className="announce-text">{message}</span>
    </div>
  );
}
