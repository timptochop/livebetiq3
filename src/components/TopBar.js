import React, { useEffect, useState } from 'react';
import './TopBar.css';
import { FaCog } from 'react-icons/fa';

function TopBar({ filters, setFilters }) {
  const [time, setTime] = useState(() => new Date());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="topbar-container">
      <div className="topbar-inner">
        <img className="topbar-logo" src="/logo192.png" alt="LiveBet IQ" />
        <div className="topbar-time">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>

        <div
          className="topbar-icons"
          aria-label="Settings"
          onClick={() => setOpen((v) => !v)}
        >
          <FaCog className="topbar-icon" />
        </div>
      </div>

      <div className="topbar-divider" />

      {open && (
        <div className="settings-panel">
          <div className="setting-row">
            <label>Min EV %: {filters.ev}</label>
            <input
              type="range" min="0" max="20" step="1"
              value={filters.ev}
              onChange={(e) =>
                setFilters((f) => ({ ...f, ev: Number(e.target.value) }))
              }
            />
          </div>

          <div className="setting-row">
            <label>Min Confidence %: {filters.confidence}</label>
            <input
              type="range" min="0" max="100" step="1"
              value={filters.confidence}
              onChange={(e) =>
                setFilters((f) => ({ ...f, confidence: Number(e.target.value) }))
              }
            />
          </div>

          <div className="setting-row">
            <label>Label</label>
            <select
              value={filters.label}
              onChange={(e) => setFilters((f) => ({ ...f, label: e.target.value }))}
            >
              <option value="ALL">ALL</option>
              <option value="SAFE">SAFE</option>
              <option value="RISKY">RISKY</option>
              <option value="AVOID">AVOID</option>
              <option value="STARTS SOON">STARTS SOON</option>
            </select>
          </div>

          <div className="setting-row checkbox">
            <label>
              <input
                type="checkbox"
                checked={filters.notifications}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, notifications: e.target.checked }))
                }
              />
              Notifications
            </label>
          </div>

          <button className="close-btn" onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
}

export default TopBar;