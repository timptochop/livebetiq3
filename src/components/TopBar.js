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
    <div
      style={{
        backgroundColor: '#1a1a1a',
        padding: '10px 16px 0',
        position: 'fixed',
        top: 0,
        width: '100%',
        zIndex: 1000
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap'
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <img
            src="/logo192.png"
            alt="Logo"
            style={{ width: '40px', height: '40px', marginLeft: '-6px' }}
          />
        </div>

        {/* Right side: Settings + Time + Login */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginRight: '30px' // ⬅⬅⬅ 5 βήματα αριστερά
          }}
        >
          {/* Settings Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="#ccc"
            viewBox="0 0 24 24"
          >
            <path d="M12 8.6c-1.9 0-3.4 1.5-3.4 3.4s1.5 3.4 3.4 3.4 3.4-1.5 3.4-3.4-1.5-3.4-3.4-3.4zm10.3 2.8l-1.1-.9c.1-.5.2-1 .2-1.5s-.1-1-.2-1.5l1.1-.9c.3-.3.3-.8.1-1.2l-1.9-3.3c-.2-.4-.7-.5-1.1-.3l-1.3.5c-.8-.6-1.7-1-2.6-1.3l-.2-1.4c0-.4-.4-.7-.8-.7H9.6c-.4 0-.8.3-.8.7l-.2 1.4c-1 .3-1.8.7-2.6 1.3L4.7.7c-.4-.2-.9-.1-1.1.3L1.7 4.3c-.2.4-.1.9.1 1.2l1.1.9c-.1.5-.2 1-.2 1.5s.1 1 .2 1.5l-1.1.9c-.3.3-.3.8-.1 1.2l1.9 3.3c.2.4.7.5 1.1.3l1.3-.5c.8.6 1.7 1 2.6 1.3l.2 1.4c0 .4.4.7.8.7h4.7c.4 0 .8-.3.8-.7l.2-1.4c1-.3 1.8-.7 2.6-1.3l1.3.5c.4.2.9.1 1.1-.3l1.9-3.3c.2-.4.1-.9-.1-1.2z" />
          </svg>

          {/* Current Time */}
          <span style={{ color: 'white', fontSize: '14px' }}>{currentTime}</span>

          {/* Login Icon */}
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

      {/* Gradient underline */}
      <div style={{ marginTop: '12px', marginBottom: '20px', width: '100%' }}>
        <div
          style={{
            height: '2px',
            background: 'linear-gradient(to right, transparent, white, transparent)',
            width: '100%'
          }}
        />
      </div>
    </div>
  );
}

export default TopBar;