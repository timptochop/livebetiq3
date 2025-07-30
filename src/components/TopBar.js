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
      padding: '10px 16px',
      position: 'fixed',
      top: 0,
      width: '100%',
      zIndex: 1000,
      borderBottom: '1px solid #333'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Left Side - Logo & Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo192.png" alt="Logo" style={{ width: '38px', height: '38px' }} />
          <span style={{
            fontSize: '13px',
            color: '#ccc',
            backgroundColor: '#2a2a2a',
            padding: '4px 10px',
            borderRadius: '12px',
            fontWeight: '500'
          }}>{currentTime}</span>
        </div>

        {/* Right Side - Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <FaCog color="#ccc" size={20} style={{ marginRight: '6px' }} />
          <div
            onClick={onLoginClick}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
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
    </div>
  );
}

export default TopBar;