import React from "react";
import "./TopBar.css";
import TopBarPortal from "./TopBarPortal";

export default function TopBar({
  liveCount = 0,
  notificationsOn = true,
  audioOn = true,
  onToggleNotifications = () => {},
  onToggleAudio = () => {},
}) {
  return (
    <TopBarPortal>
      <div className="TopBar" role="banner">
        <div className="topbar-inner">
          <div className="brand">
            LIVE<span className="bet">BET</span> <span>IQ</span>
          </div>

          <div className="live-pill" aria-label={`Live ${liveCount}`}>
            <span className="live-dot" />
            <span>LIVE</span>
            <span className="live-num">{liveCount}</span>
          </div>

          <div className="actions">
            <button
              className={`icon-btn ${notificationsOn ? "on" : ""}`}
              onClick={onToggleNotifications}
              aria-label={notificationsOn ? "Disable notifications" : "Enable notifications"}
              title="Notifications"
            >
              {/* bell */}
              <svg className="icon" viewBox="0 0 24 24">
                <path d="M12 22a2 2 0 0 0 1.98-1.75h-3.96A2 2 0 0 0 12 22Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z"/>
              </svg>
            </button>

            <button
              className={`icon-btn ${audioOn ? "on" : ""}`}
              onClick={onToggleAudio}
              aria-label={audioOn ? "Mute sounds" : "Enable sounds"}
              title="Sound"
            >
              {/* speaker */}
              <svg className="icon" viewBox="0 0 24 24">
                <path d="M3 10v4h3l4 3V7L6 10H3zM16.5 12a4.5 4.5 0 0 0-2.25-3.897v7.794A4.5 4.5 0 0 0 16.5 12zm2.5 0a7 7 0 0 1-3.5 6.062V5.938A7 7 0 0 1 19 12z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </TopBarPortal>
  );
}