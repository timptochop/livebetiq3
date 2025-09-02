// src/components/TopBar.js
import React from 'react';

export default function TopBar({
  liveCount = 0,
  notificationsOn = false,
  onToggleNotifications = () => {},
}) {
  return (
    <header className="topbar" role="banner" aria-label="LiveBetIQ top bar">
      <div className="tb-inner">
        {/* Logo */}
        <div className="tb-logo">
          <img src="/logo192.png" alt="LiveBetIQ" />
        </div>

        {/* LIVE counter */}
        <div className="tb-badge">
          <span className="dot" />
          <span className="lbl">LIVE</span>
          <span className="cnt">{liveCount}</span>
        </div>

        {/* Notifications bell + ON/OFF */}
        <button
          className={`tb-toggle ${notificationsOn ? 'on' : 'off'}`}
          onClick={() => onToggleNotifications(!notificationsOn)}
          aria-label={`Notifications ${notificationsOn ? 'on' : 'off'}`}
        >
          <span className="bell" aria-hidden>🔔</span>
          <span className="state">{notificationsOn ? 'ON' : 'OFF'}</span>
        </button>

        {/* Login icon (placeholder for later) */}
        <button className="tb-icon" aria-label="Login">
          <span className="avatar" />
        </button>
      </div>
    </header>
  );
}