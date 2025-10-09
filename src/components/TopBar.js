import React, { useEffect, useState } from 'react';
import './TopBar.css';

const EVT_LIVE_COUNT = 'live-count';

function useNotifyToggle(key = 'lbq.notify', def = true) {
  const initial = (() => {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return def;
      return v === '1';
    } catch {
      return def;
    }
  })();
  const [val, setVal] = useState(initial);
  useEffect(() => {
    try {
      localStorage.setItem(key, val ? '1' : '0');
    } catch {}
  }, [val]);
  return [val, setVal];
}

export default function TopBar({ initialLiveCount = 0 }) {
  const [notifyOn, setNotifyOn] = useNotifyToggle();
  const [liveCount, setLiveCount] = useState(
    Number.isFinite(window?.__LIVE_COUNT__) ? window.__LIVE_COUNT__ : initialLiveCount
  );

  // sync από event bus
  useEffect(() => {
    const onCount = (e) => {
      const n = Number(e?.detail ?? 0);
      if (Number.isFinite(n)) setLiveCount(n);
    };
    window.addEventListener(EVT_LIVE_COUNT, onCount);
    return () => window.removeEventListener(EVT_LIVE_COUNT, onCount);
  }, []);

  return (
    <div className="topbar" role="banner">
      <div className="tb-left">
        <div className="brand-text">
          <span className="b1">LIVE</span>
          <span className="b2">BET</span>
          <span className="b3"> IQ</span>
        </div>

        <div className="live-chip" aria-label="Live matches">
          <span className="dot" />
          <span className="label">LIVE</span>
          <span className="count">{liveCount}</span>
        </div>
      </div>

      <div className="tb-right">
        <button
          className={'icon-btn ' + (notifyOn ? 'on' : 'off')}
          title={notifyOn ? 'Notifications: ON' : 'Notifications: OFF'}
          aria-pressed={notifyOn}
          onClick={() => setNotifyOn((v) => !v)}
        >
          {/* bell */}
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5L4 18v2h16v-2l-2-2Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}