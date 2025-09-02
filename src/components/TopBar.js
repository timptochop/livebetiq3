// src/components/TopBar.js
import React from 'react';

const LOGO_URL = '/logo192.png'; // από /public

export default function TopBar({
  liveCount = 0,
  notificationsOn = false,
  onToggleNotifications = () => {},
  onLoginClick = () => {},
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#0b0b0b',
        padding: '10px 12px',
        borderBottom: '1px solid #171717',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Logo (μεγαλύτερο) */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: '#0f3d21',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
        }}
      >
        <img
          src={LOGO_URL}
          alt="LB"
          style={{ width: 30, height: 30, objectFit: 'contain' }}
        />
      </div>

      {/* LIVE pill */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#101414',
            border: '1px solid #1f2a25',
            padding: '8px 14px',
            borderRadius: 18,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35)',
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: '#2ee66b',
              boxShadow: '0 0 0 3px rgba(46,230,107,0.18)',
            }}
          />
          <span style={{ color: '#e7fff1', fontWeight: 700, letterSpacing: 0.5 }}>
            LIVE
          </span>
          <span
            style={{
              minWidth: 28,
              height: 22,
              padding: '0 10px',
              borderRadius: 999,
              background: '#00cc66',
              color: '#001d0e',
              fontWeight: 900,
              display: 'grid',
              placeItems: 'center',
              lineHeight: 1,
            }}
          >
            {liveCount}
          </span>
        </div>
      </div>

      {/* Actions: Notifications & Login */}
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Notifications */}
        <button
          type="button"
          onClick={() => onToggleNotifications(!notificationsOn)}
          aria-label="Notifications"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#111315',
            border: '1px solid #1c2227',
            padding: '8px 12px',
            borderRadius: 16,
            color: '#dce7ef',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
          }}
        >
          {/* Bell svg */}
          <span
            aria-hidden
            style={{
              width: 16,
              height: 16,
              display: 'inline-block',
              background:
                'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%23dce7ef" viewBox="0 0 16 16"><path d="M8 16a2 2 0 0 0 1.985-1.75H6.015A2 2 0 0 0 8 16m6-5c-.628 0-1-.5-1-3.5 0-2.717-1.485-4.61-3.5-5.084V2a1.5 1.5 0 0 0-3 0v.416C4.485 2.89 3 4.783 3 7.5 3 10.5 2.628 11 2 11H1v2h14v-2z"/></svg>) no-repeat center / contain',
            }}
          />
          <span
            style={{
              minWidth: 38,
              height: 22,
              padding: '0 10px',
              borderRadius: 999,
              background: notificationsOn ? '#00cc66' : '#3a474f',
              color: notificationsOn ? '#002413' : '#dfe7ec',
              fontWeight: 900,
              display: 'grid',
              placeItems: 'center',
              lineHeight: 1,
            }}
          >
            {notificationsOn ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Login (μόνο UI προς το παρόν) */}
        <button
          type="button"
          onClick={onLoginClick}
          aria-label="Login"
          style={{
            width: 64,
            height: 38,
            borderRadius: 16,
            background: '#111315',
            border: '1px solid #1c2227',
            display: 'grid',
            placeItems: 'center',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 18,
              height: 18,
              display: 'inline-block',
              background:
                'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="%23dce7ef" viewBox="0 0 16 16"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm4-3a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"/><path d="M14 14s-1-1.5-6-1.5S2 14 2 14s1-4 6-4 6 4 6 4z"/></svg>) no-repeat center / contain',
            }}
          />
        </button>
      </div>
    </div>
  );
}