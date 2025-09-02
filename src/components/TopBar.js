// src/components/TopBar.js
import React from 'react';

const pill = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 16,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 6px 18px rgba(0,0,0,0.25)',
    userSelect: 'none',
  },
  dot: (on) => ({
    width: 10,
    height: 10,
    borderRadius: 999,
    background: on ? '#1ed760' : '#3b4b58',
    boxShadow: on ? '0 0 0 2px rgba(30,215,96,0.25)' : 'none',
  }),
  count: {
    minWidth: 36,
    height: 28,
    borderRadius: 14,
    padding: '0 10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    background: '#00d26a',
    color: '#00140c',
  },
  toggle: (on) => ({
    minWidth: 64,
    height: 32,
    borderRadius: 16,
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    color: on ? '#00140c' : '#cfd3d7',
    background: on ? '#00d26a' : 'rgba(255,255,255,0.06)',
    border: on ? '1px solid rgba(0,0,0,0.0)' : '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
  }),
};

const IconBell = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Z" fill="#cfd3d7"/>
    <path d="M19 16v-5a7 7 0 1 0-14 0v5l-1.5 1.5a1 1 0 0 0 .7 1.7h16.6a1 1 0 0 0 .7-1.7L19 16Z"
          fill="#cfd3d7"/>
  </svg>
);

const IconUser = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" fill="#9fb4c2"/>
    <path d="M4 20a8 8 0 0 1 16 0v1H4v-1Z" fill="#758a98"/>
  </svg>
);

const IconLogo = ({ size = 28 }) => (
  // Μικρό “LB” σήμα σε σκούρο πράσινο, για να ταιριάζει με το δικό σου
  <div style={{
    width: size, height: size, borderRadius: 8,
    background: '#0e3b2c', display: 'grid', placeItems: 'center',
    boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.05), 0 6px 18px rgba(0,0,0,0.25)'
  }}>
    <span style={{fontWeight: 900, color: '#eafff5', fontSize: 14, letterSpacing: 0.5}}>LB</span>
  </div>
);

export default function TopBar({
  liveCount = 0,
  notificationsOn = true,
  onToggleNotifications = () => {},
  onLogoClick = () => {},
  onLoginClick = () => {},
}) {
  // Υψος μπάρας: το γράφουμε και ως CSS variable για να το χρησιμοποιήσει η σελίδα ως padding-top
  const TOPBAR_H = 64;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: '#0b0b0b',
        backdropFilter: 'saturate(120%) blur(6px)',
        borderBottom: '1px solid #151a1e',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      }}
    >
      <div
        style={{
          // εκθέτουμε το ύψος προς χρήση στο υπόλοιπο layout
          '--topbar-h': `${TOPBAR_H}px`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          height: TOPBAR_H,
          padding: '10px 14px',
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        {/* LOGO (μεγαλύτερο για συμμετρία) */}
        <button
          onClick={onLogoClick}
          aria-label="Home"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <IconLogo size={34} />
        </button>

        {/* LIVE + COUNT */}
        <div style={{ ...pill.base, gap: 12 }}>
          <span style={pill.dot(liveCount > 0)} />
          <span style={{ fontWeight: 800, color: '#eafff5', letterSpacing: 1 }}>LIVE</span>
          <span style={pill.count}>{liveCount}</span>
        </div>

        {/* Notifications toggle με καμπανάκι (ΧΩΡΙΣ κείμενο “Settings”) */}
        <div style={{ ...pill.base, gap: 10 }}>
          <IconBell />
          <button
            onClick={() => onToggleNotifications(!notificationsOn)}
            style={pill.toggle(notificationsOn)}
          >
            {notificationsOn ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* LOGIN ICON (placeholder προς το παρόν) */}
        <button
          onClick={onLoginClick}
          aria-label="Login"
          style={{
            ...pill.base,
            padding: '8px 14px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 40,
          }}
        >
          <IconUser />
        </button>
      </div>
    </div>
  );
}