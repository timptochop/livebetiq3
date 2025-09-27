// src/components/TopBar.js
import React from 'react';

export default function TopBar({
  liveCount = 0,
  notificationsOn = false,
  onToggleNotifications = () => {},
  audioOn = false,
  onToggleAudio = () => {},
}) {
  const BAR_H = 52;      // visual bar height
  const OFFSET = 10;     // drop the bar a bit from the very top

  const S = {
    bar: {
      position: 'fixed',
      top: `calc(var(--safe-top, 0px) + ${OFFSET}px)`,
      // provide the CSS var so iOS can use the safe-area when available
      '--safe-top': 'env(safe-area-inset-top)',
      left: 0,
      right: 0,
      height: BAR_H,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 14px',
      background: '#000000',
      borderBottom: '1px solid #141414',
      zIndex: 1000
    },
    // spacer must account for the visual bar height + the offset
    spacer: { height: BAR_H + OFFSET },
    left: { display: 'flex', alignItems: 'center', gap: 10 },
    logo: { fontWeight: 800, color: '#e8f0ff', letterSpacing: 0.4, fontSize: 15, lineHeight: 1 },
    livePill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 10px',
      borderRadius: 999,
      background: '#0f1115',
      border: '1px solid #273142',
      color: '#c7d1dc',
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1
    },
    dot: {
      width: 8, height: 8, borderRadius: 999,
      background: '#2bd576',
      boxShadow: '0 0 0 2px rgba(43,213,118,0.15)'
    },
    right: { display: 'flex', alignItems: 'center', gap: 8 },
    iconBtn: (active) => ({
      width: 34, height: 34,
      display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 10,
      background: active ? 'rgba(43,213,118,0.12)' : '#0f1115',
      color: active ? '#2bd576' : '#9fb0c3',
      border: `1px solid ${active ? 'rgba(43,213,118,0.35)' : '#222c3a'}`,
      cursor: 'pointer',
      transition: 'all 120ms ease',
      userSelect: 'none'
    }),
    btnWrap: { position: 'relative' }
  };

  const IconBell = ({ filled=false }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0-6 6v3.1l-1.3 2.4A1 1 0 0 0 5.6 16h12.8a1 1 0 0 0 .9-1.5L18 12.1V9a6 6 0 0 0-6-6Z" stroke="currentColor" strokeWidth="1.6" fill={filled ? 'currentColor' : 'none'} />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );

  const IconSpeaker = ({ muted=false }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10v4h3l5 4V6L7 10H4Z" stroke="currentColor" strokeWidth="1.6" fill="none"/>
      {muted ? (
        <path d="M16 9l4 6M20 9l-4 6" stroke="currentColor" strokeWidth="1.6" />
      ) : (
        <>
          <path d="M16 8c1.5 1.5 1.5 6.5 0 8" stroke="currentColor" strokeWidth="1.6" />
          <path d="M18.5 6.5c2.6 2.6 2.6 8.4 0 11" stroke="currentColor" strokeWidth="1.6" />
        </>
      )}
    </svg>
  );

  return (
    <>
      <header style={S.bar}>
        <div style={S.left}>
          <div style={S.logo}>LIVE<span style={{color:'#2bd576'}}>BET</span> IQ</div>
          <div style={S.livePill} title="Live matches">
            <span style={S.dot} />
            <span style={{opacity:.85}}>LIVE</span>
            <span style={{fontWeight:800,color:'#e8f0ff'}}>{liveCount}</span>
          </div>
        </div>

        <div style={S.right}>
          <div style={S.btnWrap}>
            <button
              type="button"
              onClick={onToggleNotifications}
              style={S.iconBtn(notificationsOn)}
              aria-label={`Notifications ${notificationsOn ? 'on' : 'off'}`}
              title={`Notifications ${notificationsOn ? 'ON' : 'OFF'}`}
            >
              <IconBell filled={notificationsOn} />
            </button>
          </div>

          <div style={S.btnWrap}>
            <button
              type="button"
              onClick={onToggleAudio}
              style={S.iconBtn(audioOn)}
              aria-label={`Audio ${audioOn ? 'on' : 'off'}`}
              title={`Audio ${audioOn ? 'ON' : 'OFF'}`}
            >
              <IconSpeaker muted={!audioOn} />
            </button>
          </div>
        </div>
      </header>

      <div style={S.spacer} aria-hidden="true" />
    </>
  );
}