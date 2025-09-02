// src/components/TopBar.js
import React from 'react';

export default function TopBar({ liveCount, notificationsOn, onToggleNotifications }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2000,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: '#0b0b0b',
        borderBottom: '1px solid #1c1c1c',
      }}
    >
      {/* Logo λίγο μεγαλύτερο */}
      <img
        src="/logo192.png"
        alt="LiveBet IQ"
        style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }}
      />

      {/* LIVE counter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 24,
          background: '#111',
          border: '1px solid #222',
        }}
      >
        <span
          style={{
            width: 12, height: 12, borderRadius: '50%',
            background: liveCount > 0 ? '#24d06a' : '#5f6b75',
            boxShadow: liveCount > 0 ? '0 0 0 2px rgba(36,208,106,0.25)' : 'none',
          }}
        />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>LIVE</span>
        <span
          style={{
            background: '#24d06a', color: '#fff', borderRadius: 14,
            padding: '2px 12px', fontWeight: 700, fontSize: 15,
          }}
        >
          {liveCount}
        </span>
      </div>

      {/* Notifications toggle + Login icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={() => onToggleNotifications(!notificationsOn)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 20,
            border: '1px solid #222', background: '#111', cursor: 'pointer',
          }}
        >
          <span role="img" aria-label="bell" style={{ fontSize: 18 }}>🔔</span>
          <span
            style={{
              fontWeight: 700, fontSize: 14,
              color: notificationsOn ? '#24d06a' : '#aaa',
            }}
          >
            {notificationsOn ? 'ON' : 'OFF'}
          </span>
        </button>

        <div
          title="Login (coming soon)"
          style={{
            width: 36, height: 36, borderRadius: 18, background: '#222',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span role="img" aria-label="user" style={{ fontSize: 20, color: '#9aa0a6' }}>👤</span>
        </div>
      </div>
    </div>
  );
}