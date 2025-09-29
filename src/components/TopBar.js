import React from "react";
import "./TopBar.css";

export default function TopBar({ liveCount = 0, onBellClick = () => {} }) {
  return (
    <header className="topbar" role="banner" aria-label="LiveBet IQ top bar">
      <div className="tb-left">
        <span className="logo">
          <strong>LIVE</strong>BET <span className="iq">IQ</span>
        </span>

        <span className="live-pill" aria-label={`Live ${liveCount}`}>
          <span className="dot" /> LIVE&nbsp;{liveCount}
        </span>
      </div>

      <div className="tb-right">
        <button
          className="icon-btn bell"
          aria-label="Notifications"
          title="Notifications"
          onClick={onBellClick}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M12 22a2.1 2.1 0 0 0 2.09-2h-4.18A2.1 2.1 0 0 0 12 22Zm6-6v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z"/>
          </svg>
        </button>
        {/* speaker icon REMOVED by design */}
      </div>
    </header>
  );
}