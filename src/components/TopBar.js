// src/components/TopBar.js
import React, { useEffect, useState } from 'react';

function TopBar({ onLoginClick }) {
  const [currentTime, setCurrentTime] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('loggedInUser'));

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hh}:${mm}`);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      setIsLoggedIn(!!localStorage.getItem('loggedInUser'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      padding: '10px 16px 0',
      position: 'fixed',
      top: 0,
      width: '100%',
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src="/logo192.png"
            alt="Logo"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              marginLeft: '-6px'
            }}
          />
        </div>

        {/* Time + Settings + Login */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          transform: 'translateX(-12px) translateY(6px)'
        }}>
          <span style={{ color: 'white', fontSize: '14px' }}>{currentTime}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="#ccc"
            viewBox="0 0 24 24"
          >
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94s-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.4,0.12-0.61l-1.92-3.32 c-0.11-0.21-0.36-0.3-0.58-0.22l-2.39,0.96c-0.5-0.38-1.05-0.7-1.65-0.94L14.5,2.5C14.47,2.22,14.24,2,13.96,2h-3.92 c-0.28,0-0.51,0.22-0.54,0.5l-0.36,2.51c-0.6,0.24-1.15,0.56-1.65,0.94L5.1,5.49C4.88,5.41,4.63,5.5,4.52,5.71L2.6,9.03 c-0.11,0.21-0.06,0.47,0.12,0.61l2.03,1.58C4.7,11.36,4.68,11.68,4.68,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.4-0.12,0.61l1.92,3.32c0.11,0.21,0.36,0.3,0.58,0.22l2.39-0.96c0.5,0.38,1.05,0.7,1.65,0.94l0.36,2.51 c0.03,0.28,0.26,0.5,0.54,0.5h3.92c0.28,0,0.51-0.22,0.54-0.5l0.36-2.51c0.6-0.24,1.15-0.56,1.65-0.94l2.39,0.96 c0.22,0.09,0.47-0.01,0.58-0.22l1.92-3.32c0.11-0.21,0.06-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.99,0-3.6-1.61-3.6-3.6 s1.61-3.6,3.6-3.6s3.6,1.61,3.6,3.6S13.99,15.6,12,15.6z" />
          </svg>
          <div
            onClick={onLoginClick}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill={isLoggedIn ? '#00C853' : '#ccc'}
              viewBox="0 0 24 24"
            >
              <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom line */}
      <div style={{ marginTop: '12px', marginBottom: '20px', width: '100%' }}>
        <div style={{
          height: '2px',
          background: 'linear-gradient(to right, transparent, white, transparent)',
          width: '100%'
        }} />
      </div>
    </div>
  );
}

export default TopBar;