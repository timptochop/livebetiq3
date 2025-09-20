// src/components/TopBar.js
import React from "react";

export default function TopBar({
  liveCount = 0,
  notificationsOn = false,
  onToggleNotifications = () => {},
  pushOn = false,
  onTogglePush = () => {},
}) {
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: 64,
      background: "#121416",
      borderBottom: "1px solid #22272c",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      zIndex: 1000
    }}>
      <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>
        🎾 Live Matches: {liveCount}
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button
          onClick={() => onToggleNotifications(!notificationsOn)}
          style={{
            background: notificationsOn ? "#1fdd73" : "#444",
            color: "#000",
            padding: "8px 16px",
            fontWeight: 700,
            border: "none",
            borderRadius: 8,
            cursor: "pointer"
          }}
        >
          {notificationsOn ? "🔔 Audio On" : "🔕 Audio Off"}
        </button>

        <button
          onClick={() => onTogglePush(!pushOn)}
          style={{
            background: pushOn ? "#1f8dd6" : "#444",
            color: "#000",
            padding: "8px 16px",
            fontWeight: 700,
            border: "none",
            borderRadius: 8,
            cursor: "pointer"
          }}
          title="Web Push Notifications (lock screen capable)"
        >
          {pushOn ? "📬 Push On" : "📭 Push Off"}
        </button>
      </div>
    </div>
  );
}