// src/components/TopBar.js
import React from 'react';

function TennisBallIcon({ size = 18 }) {
  // simple yellow tennis ball with white seams (inline SVG)
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="10" fill="#FFD54A" />
      {/* seams */}
      <path d="M3.5 9.5c3.5 0 5 1.5 7 3.5s3.5 3.5 7 3.5" stroke="#FFFFFF" strokeWidth="2" fill="none" opacity="0.85"/>
      <path d="M20.5 14.5c-3.5 0-5-1.5-7-3.5s-3.5-3.5-7-3.5" stroke="#FFFFFF" strokeWidth="2" fill="none" opacity="0.85"/>
    </svg>
  );
}

export default function TopBar({
  liveCount = 0,
  notificationsOn = true,
  onToggleNotifications,
  setNotificationsOn, // fallback prop name used in some versions
}) {
  const handleToggle = () => {
    if (typeof onToggleNotifications === 'function') {
      onToggleNotifications(!notificationsOn);
    } else if (typeof setNotificationsOn === 'function') {
      // support older signature setNotificationsOn(prev => !prev)
      try {
        setNotificationsOn((prev) => !prev);
      } catch {
        setNotificationsOn(!notificationsOn);
      }
    }
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: '#0f1317',
        borderBottom: '1px solid #1e242b',
        boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
        color: '#e8edf2',
      }}
    >
      {/* Left: logo + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, letterSpacing: 0.3 }}>
        <TennisBallIcon size={18} />
        <span style={{ fontSize: 16 }}>LiveBet IQ</span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Live count pill */}
      <div
        title="Live matches right now"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 999,
          fontWeight: 800,
          fontSize: 13,
          background: '#122017',
          color: '#25df7a',
          border: '1px solid rgba(37,223,122,0.25)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
          minWidth: 72,
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: '#25df7a',
            display: 'inline-block',
            boxShadow: '0 0 0 2px rgba(37,223,122,0.25)',
          }}
        />
        <span>LIVE</span>
        <span>•</span>
        <span>{liveCount}</span>
      </div>

      {/* Notifications toggle */}
      <button
        onClick={handleToggle}
        type="button"
        style={{
          marginLeft: 12,
          padding: '8px 12px',
          borderRadius: 10,
          background: notificationsOn ? '#1b2a1f' : '#2a1b1b',
          color: notificationsOn ? '#25df7a' : '#ff7d7d',
          border: `1px solid ${notificationsOn ? 'rgba(37,223,122,0.25)' : 'rgba(255,125,125,0.25)'}`,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        }}
        title={notificationsOn ? 'Notifications: ON' : 'Notifications: OFF'}
      >
        {notificationsOn ? '🔔 ON' : '🔕 OFF'}
      </button>
    </div>
  );
}