// src/components/TopBar.js
import React, { useEffect, useState } from 'react';
import './TopBar.css';

const EVT_LIVE_COUNT = 'live-count';

export default function TopBar({ onBell = () => {} }) {
  const [liveCount, setLiveCount] = useState(
    typeof window !== 'undefined' ? (window.__LIVE_COUNT__ || 0) : 0
  );
  const [notifyOn, setNotifyOn] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('lbq_notify') !== '0';
  });

  // Ακούμε το global event για live counter
  useEffect(() => {
    const handler = (e) => {
      const n = typeof e?.detail === 'number' ? e.detail : (window.__LIVE_COUNT__ || 0);
      setLiveCount(n);
    };
    window.addEventListener(EVT_LIVE_COUNT, handler);
    return () => window.removeEventListener(EVT_LIVE_COUNT, handler);
  }, []);

  const toggleBell = () => {
    const next = !notifyOn;
    setNotifyOn(next);
    try { localStorage.setItem('lbq_notify', next ? '1' : '0'); } catch {}
    try { onBell(next); } catch {}
  };

  return (
    <header className="topbar" role="banner">
      <div className="tb-left">
        <span className="brand-text">
          <span className="b1">LIVE</span><span className="b2">BET</span> <span className="b3">IQ</span>
        </span>

        <span className="live-chip" aria-live="polite">
          <span className="dot" />
          <span className="count">LIVE&nbsp;{liveCount}</span>
        </span>
      </div>

      <div className="tb-right">
        <button
          className={`icon-btn ${notifyOn ? '' : 'off'}`}
          aria-label={notifyOn ? 'Disable notifications' : 'Enable notifications'}
          onClick={toggleBell}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z"/>
          </svg>
        </button>
      </div>
    </header>
  );
}