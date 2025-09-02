import React from 'react';
import './TopBar.css';

export default function TopBar({ liveCount = 0, showAIBadges = true, onToggleAIBadges }) {
  return (
    <div className="tb-wrap">
      {/* Left: logo */}
      <div className="tb-left">
        <div className="tb-logo">LB</div>
      </div>

      {/* Center: LIVE counter */}
      <div className="tb-center">
        <div className="tb-pill">
          <span className="tb-dot" />
          <span className="tb-live">LIVE</span>
          <span className="tb-num">{liveCount}</span>
        </div>
      </div>

      {/* Right: settings + login (login inert for now) */}
      <div className="tb-right">
        <button
          className="tb-icon"
          aria-label="Settings"
          onClick={() => onToggleAIBadges && onToggleAIBadges(!showAIBadges)}
          title={showAIBadges ? 'Hide AI badges' : 'Show AI badges'}
        >
          {/* gear icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.7"/>
            <path d="M19 12a7 7 0 0 0-.09-1.1l2.01-1.56-2-3.46-2.36.95A7 7 0 0 0 14.1 5L13 3h-2l-1.1 2a7 7 0 0 0-2.46.83l-2.36-.95-2 3.46 2.01 1.56A7 7 0 0 0 5 12c0 .37.03.73.09 1.1l-2.01 1.56 2 3.46 2.36-.95c.77.51 1.6.9 2.46 1.07L11 21h2l1.1-2c.86-.17 1.7-.56 2.46-1.07l2.36.95 2-3.46-2.01-1.56c.06-.36.09-.72.09-1.1Z" stroke="currentColor" strokeWidth="1.7"/>
          </svg>
          <span className="tb-toggle">{showAIBadges ? 'AI ON' : 'AI OFF'}</span>
        </button>

        <button className="tb-icon" aria-label="Login" title="Login (coming soon)">
          {/* user icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7"/>
            <path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.7"/>
          </svg>
        </button>
      </div>
    </div>
  );
}