// src/components/TopBar.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import './TopBar.css';
import { enableNotifications, disableNotifications, isSubscribed } from '../utils/notifyControl';

const EVT_LIVE_COUNT = 'live-count';

export default function TopBar() {
  const [count, setCount] = useState(() => (typeof window !== 'undefined' && window.__LIVE_COUNT__) || 0);
  const [bellOn, setBellOn] = useState(false);
  const hdrRef = useRef(null);

  // keep --tb-offset synced (fallback to 56px)
  const syncOffset = useCallback(() => {
    const h = Math.ceil(hdrRef.current?.getBoundingClientRect?.().height || 56);
    document.documentElement.style.setProperty('--tb-offset', `${h}px`);
  }, []);

  useEffect(() => {
    let mounted = true;
    isSubscribed().then(v => mounted && setBellOn(!!v)).catch(() => {});
    syncOffset();
    const ro = new ResizeObserver(syncOffset);
    if (hdrRef.current) ro.observe(hdrRef.current);
    const onLoad = () => syncOffset();
    window.addEventListener('load', onLoad);
    window.addEventListener('resize', syncOffset);
    window.addEventListener('orientationchange', syncOffset);
    return () => {
      mounted = false;
      window.removeEventListener('load', onLoad);
      window.removeEventListener('resize', syncOffset);
      window.removeEventListener('orientationchange', syncOffset);
      ro.disconnect();
    };
  }, [syncOffset]);

  // listen global live-count bus
  useEffect(() => {
    const on = (e) => setCount(Number(e?.detail ?? 0));
    window.addEventListener(EVT_LIVE_COUNT, on);
    return () => window.removeEventListener(EVT_LIVE_COUNT, on);
  }, []);

  const onBellClick = async () => {
    try {
      const on = await isSubscribed();
      if (on) {
        await disableNotifications();
        setBellOn(false);
      } else {
        await enableNotifications();
        setBellOn(true);
      }
    } catch (_) {}
  };

  return (
    <header ref={hdrRef} className="topbar">
      <div className="tb-left">
        <span className="brand">LIVEBET <span className="brand-em">IQ</span></span>
      </div>

      <div className="tb-center">
        <span className="live-pill">
          <span className="dot" />
          <span className="txt">LIVE</span>
          <span className="cnt">{count}</span>
        </span>
      </div>

      <div className="tb-right">
        <button
          type="button"
          className={`bell ${bellOn ? 'on' : 'off'}`}
          aria-label="Notifications"
          onClick={onBellClick}
        >
          🔔
        </button>
      </div>
    </header>
  );
}