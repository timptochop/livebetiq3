import React, { useEffect, useState } from 'react';
import './TopBar.css';

// Events
const EVT_LIVE_COUNT = 'live-count';
const EVT_NOTIFY = 'lbq-notify-toggle';

// Persistent toggle hook
function useToggle(key, def = true) {
  const initial = (() => {
    try { const v = localStorage.getItem(key); return v === null ? def : v === '1'; }
    catch { return def; }
  })();
  const [val, setVal] = useState(initial);
  useEffect(() => { try { localStorage.setItem(key, val ? '1' : '0'); } catch {} }, [val]);
  return [val, setVal];
}

export default function TopBar({ initialLiveCount = 0 }) {
  const [liveCount, setLiveCount] = useState(Number.isFinite(window?.__LIVE_COUNT__) ? window.__LIVE_COUNT__ : initialLiveCount);
  const [notifyOn, setNotifyOn] = useToggle('lbq.notify', true);

  // listen live-count
  useEffect(() => {
    const onCount = (e) => { const n = Number(e?.detail ?? 0); if (Number.isFinite(n)) setLiveCount(n); };
    window.addEventListener(EVT_LIVE_COUNT, onCount);
    return () => window.removeEventListener(EVT_LIVE_COUNT, onCount);
  }, []);

  // broadcast notify toggle
  useEffect(() => { window.dispatchEvent(new CustomEvent(EVT_NOTIFY, { detail: notifyOn })); }, [notifyOn]);

  return (
    <div className="topbar" role="banner">
      <div className="topbar-left">
        <img className="brand-mark" src="/brand/mark.png" alt="Logo" />
        <div className="live-chip" aria-label="Live matches">
          <span className="dot" />
          <span className="label">LIVE</span>
          <span className="count">{liveCount}</span>
        </div>
      </div>

      <div className="topbar-actions" aria-label="controls">
        <button
          className={"icon-btn " + (notifyOn ? 'on' : 'off')}
          title={notifyOn ? 'Notifications: ON' : 'Notifications: OFF'}
          onClick={() => setNotifyOn(v => !v)}
          aria-pressed={notifyOn}
        >
          {/* Bell icon */}
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5L4 18v2h16v-2l-2-2Z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
