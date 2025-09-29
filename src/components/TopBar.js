import React from "react";
import "./TopBar.css";

export default function TopBar({
  liveCount = 0,
  notificationsOn = true,
  onToggleNotifications = () => {},
  // Σκόπιμα αγνοούμε τυχόν audio props (ήχος παραμένει ενεργός από τη λογική σου)
}) {
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span>LIVE</span>
          <span className="bet">BET</span>
          <span className="muted"> IQ</span>
        </div>

        <div className="live-pill" aria-label={`Live ${liveCount}`}>
          <span className="dot" />
          <span style={{ fontWeight: 800 }}>LIVE</span>
          <span style={{ opacity: 0.85, marginLeft: 6 }}>{liveCount}</span>
        </div>

        <div className="actions">
          {/* ΜΟΝΟ το καμπανάκι – το εικονίδιο ήχου αφαιρέθηκε */}
          <button
            className={`btn ${notificationsOn ? "active" : ""}`}
            title={notificationsOn ? "Notifications: ON" : "Notifications: OFF"}
            onClick={onToggleNotifications}
            aria-label="Toggle notifications"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-5v-5.5A7 7 0 0 0 12 4a7 7 0 0 0-7 7.5V17l-1.8 1.8a1 1 0 0 0 .7 1.7h17.9a1 1 0 0 0 .7-1.7L19 17Z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* spacer για να μη σκεπάζει το περιεχόμενο */}
      <div className="top-spacer" />
    </>
  );
}