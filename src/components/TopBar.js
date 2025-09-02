import React from 'react';

export default function TopBar({
  liveCount = 0,
  aiOnly = false,
  setAiOnly = () => {},
  onSettingsClick = () => {},
  onLoginClick = () => {},
  logoSrc = '/logo.png', // άλλαξέ το σε '/logo192.png' αν προτιμάς
}) {
  const chip = (children, extra = {}) => (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 14,
        background: '#141618',
        color: '#dfe5ea',
        border: '1px solid #263238',
        boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
        ...extra,
      }}
    >
      {children}
    </div>
  );

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#0b0b0b',
        borderBottom: '1px solid #111',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: '#0e5c2f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
          }}
          aria-label="logo"
        >
          <img
            src={logoSrc}
            alt="Logo"
            style={{ width: 26, height: 26, objectFit: 'contain', filter: 'brightness(1.05)' }}
            onError={(e) => {
              // fallback αν λείπει το /logo.png
              e.currentTarget.style.display = 'none';
            }}
          />
          {/* Αν δεν φορτώσει, κρατάμε ένα “LB” */}
          <span style={{ fontWeight: 800, color: '#e8f5e9', fontSize: 14 }}>LB</span>
        </div>

        {/* LIVE counter */}
        {chip(
          <>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: liveCount > 0 ? '#1db954' : '#546e7a',
                display: 'inline-block',
              }}
            />
            <span style={{ fontWeight: 700, letterSpacing: 0.5 }}>LIVE</span>
            <span
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: 999,
                background: '#0f2',
                color: '#001b06',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
              }}
            >
              {liveCount}
            </span>
          </>,
          { background: '#0d1b1e' }
        )}

        {/* Settings */}
        {chip(
          <>
            <span role="img" aria-label="settings">⚙️</span>
            <span style={{ opacity: 0.85, fontWeight: 700 }}>Settings</span>
          </>,
          { cursor: 'pointer' }
        )}
        <div
          onClick={onSettingsClick}
          style={{ position: 'relative', marginLeft: -76, width: 120, height: 38, cursor: 'pointer' }}
          aria-hidden
          title="Settings"
        />

        {/* AI toggle */}
        <div
          onClick={() => setAiOnly(!aiOnly)}
          title={aiOnly ? 'AI ON (tap to turn OFF)' : 'AI OFF (tap to turn ON)'}
          style={{ cursor: 'pointer' }}
        >
          {chip(
            <>
              <span style={{ fontWeight: 800 }}>AI</span>
              <span
                style={{
                  marginLeft: 4,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: aiOnly ? '#1db954' : '#37474f',
                  color: aiOnly ? '#001b06' : '#dfe5ea',
                  fontWeight: 800,
                }}
              >
                {aiOnly ? 'ON' : 'OFF'}
              </span>
            </>
          )}
        </div>

        {/* Login */}
        <div style={{ marginLeft: 'auto' }}>
          {chip(
            <>
              <span role="img" aria-label="login">👤</span>
            </>,
            { cursor: 'pointer', width: 44, justifyContent: 'center' }
          )}
          <div
            onClick={onLoginClick}
            style={{ position: 'relative', marginTop: -38, width: 44, height: 38, cursor: 'pointer' }}
            aria-hidden
            title="Login"
          />
        </div>
      </div>
    </div>
  );
}