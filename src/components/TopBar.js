// src/components/TopBar.js
import React from 'react';

// Μικρά βοηθητικά "pill" κουμπάκια
function Pill({ children, style }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: '#121416',
        border: '1px solid #24282d',
        borderRadius: 22,
        color: '#e6f6ee',
        fontWeight: 700,
        fontSize: 15,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function TopBar({
  liveCount = 0,
  notificationsOn = false,
  onToggleNotifications = () => {},
}) {
  const SPACER_HEIGHT = 76; // κρατάμε reference και στο LiveTennis

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: '#0b0d0f',
        borderBottom: '1px solid #1a1e22',
        boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
      }}
    >
      <div
        style={{
          // αυξήσαμε συνολικό ύψος μπάρας
          minHeight: SPACER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 14px',
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        {/* LOGO (μεγαλύτερο) */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            background: '#0f3d2b',
            border: '1px solid #1b3f32',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src="/logo192.png"
            alt="LiveBetIQ"
            style={{ width: 46, height: 46, objectFit: 'contain' }}
          />
        </div>

        {/* LIVE counter */}
        <Pill>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#1fdd73',
              boxShadow: '0 0 6px rgba(31,221,115,.7)',
            }}
          />
          <span style={{ letterSpacing: 0.5 }}>LIVE</span>
          <div
            style={{
              marginLeft: 4,
              minWidth: 40,
              height: 28,
              borderRadius: 14,
              background: '#0fd35f',
              color: '#062313',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 16,
              padding: '0 10px',
            }}
          >
            {liveCount}
          </div>
        </Pill>

        {/* Notifications bell + ON/OFF */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Pill>
            <span style={{ fontSize: 20 }}>🔔</span>
            <button
              onClick={() => onToggleNotifications(!notificationsOn)}
              style={{
                cursor: 'pointer',
                border: 'none',
                background: notificationsOn ? '#0fd35f' : '#2a2f35',
                color: notificationsOn ? '#062313' : '#c7d1dc',
                minWidth: 64,
                height: 32,
                borderRadius: 16,
                fontWeight: 900,
                fontSize: 14,
              }}
              aria-label="Notifications toggle"
            >
              {notificationsOn ? 'ON' : 'OFF'}
            </button>
          </Pill>

          {/* Login icon (placeholder) */}
          <div
            title="Login"
            style={{
              width: 60,
              height: 44,
              borderRadius: 22,
              background: '#121416',
              border: '1px solid #24282d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9fb6cc',
              fontSize: 22,
            }}
          >
            {/* απλό εικονίδιο χρήστη */}
            <span style={{ transform: 'translateY(-1px)' }}>👤</span>
          </div>
        </div>
      </div>
    </div>
  );
}