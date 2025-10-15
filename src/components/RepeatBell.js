// src/components/RepeatBell.js
import React from 'react';
import { isRepeatEnabled, toggleRepeatEnabled } from '../utils/notifyControl';
import './RepeatBell.css';

export default function RepeatBell() {
  const [on, setOn] = React.useState(isRepeatEnabled());
  return (
    <button
      type="button"
      className={`icon-btn repeat-btn ${on ? 'active' : ''}`}
      aria-label={on ? 'Repeat alerts: ON' : 'Repeat alerts: OFF'}
      title={on ? 'Repeat alerts: ON' : 'Repeat alerts: OFF'}
      onClick={() => setOn(toggleRepeatEnabled())}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm6-6V11a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v5l-1.8 2.7a.8.8 0 0 0 .67 1.3h14.26a.8.8 0 0 0 .67-1.3L18 16Z" fill="currentColor"/>
        <g transform="translate(12,0)">
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M8.1 5.9a2.6 2.6 0 1 0-1.3 2.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M7.9 3.4v2.1l-1.9-1.1" fill="currentColor"/>
        </g>
      </svg>
    </button>
  );
}