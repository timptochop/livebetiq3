// src/components/TopBar.js
import React from 'react';

export default function TopBar({ liveCount, notificationsOn, onToggleNotifications }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 80,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid #111',
        zIndex: 1000,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src="/logo192.png"
          alt="LiveBetIQ"
          style={{ width: 64, height: 64, borderRadius: 12 }}
        />
      </div>

      {/* Live Counter */}
      <div
        style={{
          background: '#111',
          borderRadius: 30,
          padding: '8px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: liveCount > 0 ? '#00e676' : '#555',
          }}
        />
        <span style={{ color: '#fff' }}>LIVE</span>
        <span
          style={{
            background: '#00e676',
            color: '#000',
            borderRadius: 12,
            padding: '2px 8px',
            fontSize: 14,
            minWidth: 24,
            textAlign: 'center',
          }}
        >
          {liveCount}
        </span>
      </div>

      {/* Right icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Bell icon toggle */}
        <div
          onClick={() => onToggleNotifications(!notificationsOn)}
          style={{
            background: '#111',
            borderRadius: 30,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 18 }}>🔔</span>
          <span
            style={{
              background: notificationsOn ? '#00e676' : '#555',
              color: '#000',
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 14,
              fontWeight: 600,
              minWidth: 36,
              textAlign: 'center',
            }}
          >
            {notificationsOn ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* Login icon */}
        <div
          style={{
            background: '#111',
            borderRadius: 30,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 20, color: '#9aa0a6' }}>👤</span>
        </div>
      </div>
    </div>
  );
}