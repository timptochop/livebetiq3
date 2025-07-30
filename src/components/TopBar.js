import React, { useEffect, useState } from 'react';
import { FaCog } from 'react-icons/fa';

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
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap'
      }}>
        {/* Logo and time on the left */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <img
            src="/logo192.png"
            alt="Logo"
            style={{ width: '40px', height: '40px', marginLeft: '-6px' }}
          />
          <span style={{ color: 'white', fontSize: '13px', marginTop: '4px', marginLeft: '2px' }}>
            {currentTime}
          </span>
        </div>

        {/* Settings + Login on the right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <FaCog color="#ccc" size={20} />
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

      {/* Elegant Full-Width Line */}
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