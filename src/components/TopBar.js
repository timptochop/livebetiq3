import React, { useEffect, useState } from 'react';

const EVT_LIVE_COUNT = 'live-count';

export default function TopBar({
  initialLive = 0,
  notificationsOn = true,
  audioOn = true,
  onBellClick = () => {},
  onAudioToggle = () => {},
}) {
  const [live, setLive] = useState(initialLive);

  useEffect(() => {
    const h = (e) => {
      const n = typeof e?.detail === 'number' ? e.detail : (window.__LIVE_COUNT__ || 0);
      setLive(Number.isFinite(n) ? n : 0);
    };
    if (typeof window !== 'undefined') {
      setLive(Number.isFinite(window.__LIVE_COUNT__) ? window.__LIVE_COUNT__ : initialLive);
      window.addEventListener(EVT_LIVE_COUNT, h);
    }
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener(EVT_LIVE_COUNT, h);
    };
  }, [initialLive]);

  return (
    <div className="topbar">
      <div className="tb-left">
        <span className="brand">LIVEBET IQ</span>
      </div>

      <div className="tb-center">
        <div className="live-badge">
          <span className="dot" />
          <span className="txt">LIVE</span>
          <span className="count">{live}</span>
        </div>
      </div>

      <div className="tb-right">
        <button
          className={`icon bell ${notificationsOn ? 'on' : 'off'}`}
          onClick={onBellClick}
          aria-label="Notifications"
          type="button"
        >🔔</button>
        <button
          className={`icon audio ${audioOn ? 'on' : 'off'}`}
          onClick={onAudioToggle}
          aria-label="Audio"
          type="button"
        >{audioOn ? '🔊' : '🔇'}</button>
        <div className="safe-gap" />
      </div>
    </div>
  );
}