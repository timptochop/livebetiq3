// src/components/TopBar.js
import React from 'react';

export default function TopBar({ liveCount, notificationsOn, onToggleNotifications }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: '#0b0b0b',
        borderBottom: '1px solid #1c1c1c',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
      }}
    >
      {/* Logo */}
      <img
        src="/logo192.png"
        alt="LiveBet IQ"
        style={{
          height: 36,
          width: 36,
          borderRadius: 8,
          objectFit: 'cover',
        }}
      />

      {/* LIVE counter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 20,
          background: '#111',
          border: '1px solid #222',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: liveCount > 0 ? '#24d06a' : '#5f6b75',
            boxShadow: liveCount > 0 ? '0 0 0 2px rgba(36,208,106,0.25)' : 'none',
          }}
        />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>LIVE</span>
        <span
          style={{
            background: '#24d06a',
            color: '#fff',
            borderRadius: 12,
            padding: '2px 10px',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {liveCount}
        </span>
      </div>

      {/* Right side: Notifications + Login */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Notifications toggle */}
        <button
          onClick={() => onToggleNotifications(!notificationsOn)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            border: '1px solid #222',
            background: '#111',
            cursor: 'pointer',
          }}
        >
          <span role="img" aria-label="bell" style={{ fontSize: 16 }}>
            🔔
          </span>
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: notificationsOn ? '#24d06a' : '#aaa',
            }}
          >
            {notificationsOn ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Login icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            background: '#222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span role="img" aria-label="user" style={{ fontSize: 18, color: '#9aa0a6' }}>
            👤
          </span>
        </div>
      </div>
    </div>
  );
}