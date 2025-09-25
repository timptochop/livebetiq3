import React from 'react';

export default function TopBar({
  liveCount = 0,
  notificationsOn = false,
  onToggleNotifications = () => {},
  audioOn = false,
  onToggleAudio = () => {},
  // NEW:
  notifyMode = 'ONCE',
  onCycleNotifyMode = () => {},
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
    logoRow: { display: 'flex', alignItems: 'center', gap: 8 },
    logo: { fontWeight: 800, color: '#e8f0ff', letterSpacing: 0.4, fontSize: 16 },
    ball: {
      width: 16,
      height: 16,
      borderRadius: 999,
      background: '#E6FF4F', // tennis-ball yellow
      boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.7)',
      position: 'relative',
    },
    seamA: {
      position: 'absolute',
      left: 2, right: 2, top: '50%',
      height: 2, transform: 'translateY(-50%)',
      borderRadius: 2, background: '#ffffff',
      opacity: 0.7,
    },
    seamB: {
      position: 'absolute',
      top: 2, bottom: 2, left: '50%',
      width: 2, transform: 'translateX(-50%)',
      borderRadius: 2, background: '#ffffff',
      opacity: 0.7,
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
    modeBtn: (active) => ({
      height: 36,
      padding: '0 10px',
      display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 10,
      background: active ? 'rgba(43,213,118,0.12)' : '#12161c',
      color: active ? '#2bd576' : '#9fb0c3',
      border: `1px solid ${active ? 'rgba(43,213,118,0.35)' : '#222c3a'}`,
      cursor: 'pointer',
      transition: 'all 120ms ease',
      userSelect: 'none',
      fontWeight: 800,
      fontSize: 12,
    }),
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
        <div style={S.logoRow}>
          <div style={S.ball}><span style={S.seamA}/><span style={S.seamB}/></div>
          <div style={S.logo}>LIVE<span style={{color:'#2bd576'}}>BET</span> IQ</div>
        </div>
        <div style={S.livePill} title="Live matches">
          <span style={S.dot} />
          <span style={{opacity:.85}}>LIVE</span>
          <span style={{fontWeight:800,color:'#e8f0ff'}}>{liveCount}</span>
        </div>
      </div>

      <div style={S.right}>
        {/* Notify mode toggle */}
        <button
          type="button"
          onClick={onCycleNotifyMode}
          style={S.modeBtn(notifyMode === 'ON_CHANGE')}
          title={`Notify mode: ${notifyMode}`}
        >
          {notifyMode === 'ONCE' ? 'Notify: Once' : 'Notify: Re-Arm'}
        </button>

        {/* Notifications toggle */}
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

        {/* Audio toggle */}
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