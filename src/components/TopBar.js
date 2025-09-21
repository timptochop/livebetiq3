// src/components/TopBar.js
import React from 'react';

// Μικρό SVG icon για μπάλα τένις (λεπτό, αθόρυβο)
function TennisBallIcon({ size = 14, style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      {/* σώμα μπάλας */}
      <circle cx="12" cy="12" r="10" fill="#D9FF3F" />
      {/* ραφές */}
      <path
        d="M3.5 9.5c3.6 0 5.1 1.5 7.1 3.5s3.5 3.5 7.1 3.5"
        stroke="#0e1116"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M20.5 14.5c-3.6 0-5.1-1.5-7.1-3.5s-3.5-3.5-7.1-3.5"
        stroke="#0e1116"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

export default function TopBar({
  liveCount = 0,
  notificationsOn = false,
  onToggleNotifications = () => {},
  audioOn = false,
  onToggleAudio = () => {},
}) {
  const S = {
    bar: {
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 14px',
      background: '#0f1115',
      borderBottom: '1px solid #1d222b',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    },
    left: { display: 'flex', alignItems: 'center', gap: 10 },
    // ΜΟΝΟ μικρή προσθήκη: display:flex για να χωρέσει ωραία το icon με τον τίτλο
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontWeight: 800,
      color: '#e8f0ff',
      letterSpacing: 0.4,
      fontSize: 16,
    },
    livePill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      borderRadius: 999,
      background: '#11161c',
      border: '1px solid #273142',
      color: '#c7d1dc',
      fontSize: 13,
      fontWeight: 600,
    },
    dot: {
      width: 8, height: 8, borderRadius: 999,
      background: '#2bd576',
      boxShadow: '0 0 0 2px rgba(43,213,118,0.15)',
    },
    right: { display: 'flex', alignItems: 'center', gap: 10 },
    iconBtn: (active) => ({
      width: 36, height: 36,
      display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 10,
      background: active ? 'rgba(43,213,118,0.12)' : '#12161c',
      color: active ? '#2bd576' : '#9fb0c3',
      border: `1px solid ${active ? 'rgba(43,213,118,0.35)' : '#222c3a'}`,
      cursor: 'pointer',
      transition: 'all 120ms ease',
      userSelect: 'none',
    }),
    tooltip: {
      position: 'absolute',
      transform: 'translateY(34px)',
      background: '#0e1217',
      border: '1px solid #1f2632',
      color: '#c7d1dc',
      padding: '4px 8px',
      borderRadius: 6,
      fontSize: 12,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      opacity: 0.95,
    },
    btnWrap: { position: 'relative' }
  };

  const IconBell = ({ filled=false }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3a6 6 0 0 0-6 6v3.1l-1.3 2.4A1 1 0 0 0 5.6 16h12.8a1 1 0 0 0 .9-1.5L18 12.1V9a6 6 0 0 0-6-6Z" stroke="currentColor" strokeWidth="1.6" fill={filled ? 'currentColor' : 'none'} />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );

  const IconSpeaker = ({ muted=false }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
    <header style={S.bar}>
      <div style={S.left}>
        <div style={S.logo}>
          <TennisBallIcon size={14} />
          <span>LIVE<span style={{color:'#2bd576'}}>BET</span> IQ</span>
        </div>

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
  );
}