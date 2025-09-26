// src/components/TopBar.js
import React from "react";
import "./TopBar.css";

export default function TopBar({ liveCount, notifyLabel, onNotifyClick, onBell, onRearm }) {
  return (
    <header className="topbar">
      <div className="brand">LIVEBET IQ</div>

      <div className="tray">
        <button className="pill" onClick={onNotifyClick}>Notify: {notifyLabel}</button>
        <button className="icon-btn" aria-label="Bell" onClick={onBell}>🔔</button>
        <button className="icon-btn" aria-label="Rearm" onClick={onRearm}>⟳</button>
      </div>
    </header>
  );
}