// src/components/TopBar.js
import React from 'react';
import './TopBar.css';

export default function TopBar({
  liveCount = 0,
  onBellClick,
  bellActive = false,
  onSoundClick,
  soundOn = true,
}) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__left">
          <div className="brand">LIVEBET IQ</div>

          <div className="live-pill" aria-label={`Live ${liveCount}`}>
            <span className="dot" />
            <span className="live-text">LIVE</span>
            <span className="count">{liveCount}</span>
          </div>
        </div>

        <div className="topbar__right">
          <button
            type="button"
            className={`icon-btn ${bellActive ? 'is-active' : ''}`}
            onClick={onBellClick}
            aria-label={bellActive ? 'Notifications on' : 'Notifications off'}
          >
            {/* Bell */}
            <svg viewBox="0 0 24 24" className="icon">
              <path
                d="M12 22a2.75 2.75 0 0 0 2.45-1.5.75.75 0 1 0-1.34-.7 1.25 1.25 0 0 1-2.22 0 .75.75 0 1 0-1.34.7A2.75 2.75 0 0 0 12 22Zm8-6.25c-1.69-1.64-2.5-3.48-2.5-6.25A5.5 5.5 0 1 0 6.5 9.5c0 2.77-.81 4.61-2.5 6.25a.75.75 0 0 0 .52 1.3H19.5a.75.75 0 0 0 .5-1.3Z"
                fill="currentColor"
              />
            </svg>
          </button>

          <button
            type="button"
            className={`icon-btn ${soundOn ? 'is-active' : ''}`}
            onClick={onSoundClick}
            aria-label={soundOn ? 'Sound on' : 'Sound off'}
          >
            {/* Speaker */}
            <svg viewBox="0 0 24 24" className="icon">
              <path
                d="M13 4.5a1 1 0 0 0-1.64-.77L7.7 6.5H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2.7l3.66 2.77A1 1 0 0 0 13 19.5v-15Zm4.2 2.05a.75.75 0 0 1 1.06 0A8 8 0 0 1 20.5 12a8 8 0 0 1-2.24 5.45.75.75 0 1 1-1.1-1.02A6.5 6.5 0 0 0 19 12a6.5 6.5 0 0 0-1.84-4.43.75.75 0 0 1 .04-1.02Zm-2.13 2.15a.75.75 0 0 1 1.06.02A5 5 0 0 1 17 12a5 5 0 0 1-1.87 3.28.75.75 0 1 1-.98-1.13A3.5 3.5 0 0 0 15.5 12c0-.95-.39-1.86-1.06-2.5a.75.75 0 0 1 .03-1.02Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}