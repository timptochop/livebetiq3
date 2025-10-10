import React from 'react';
import './TopBar.css';

export default function TopBar({ liveCount = 0, onBell = () => {} }) {
  return (
    <header className="topbar" role="banner">
      <div className="topbar__inner">
        <div className="tb-left">
          <span className="brand-text">
            LIVE<span className="brand-bet">BET</span> IQ
          </span>

          <span className="live-chip">
            <span className="dot" />
            <span className="count">LIVE&nbsp;{liveCount}</span>
          </span>
        </div>

        <div className="tb-right">
          <button className="icon-btn" aria-label="Notifications" onClick={onBell}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}