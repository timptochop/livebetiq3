import React from "react";
import "./TopBar.css";

export default function TopBar({ liveCount = 0, onBell = () => {} }) {
  return (
    <header className="topbar" role="banner" aria-label="LiveBet IQ top bar">
      <div className="topbar__inner">
        <div className="topbar__brand">
          <span>LIVE</span><span className="g">BET</span> <span>IQ</span>
        </div>

        <div className="topbar__pill" aria-label={`Live ${liveCount}`}>
          <span className="topbar__pill-dot" />
          <span>LIVE</span>
          <span>{liveCount}</span>
        </div>

        <div className="topbar__actions">
          <button
            type="button"
            className="topbar__btn topbar__btn--bell"
            aria-label="Notifications"
            onClick={onBell}
          />
        </div>
      </div>
    </header>
  );
}