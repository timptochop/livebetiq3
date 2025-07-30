import React, { useState, useEffect } from 'react';
import { FaCog, FaUser, FaUserCheck } from 'react-icons/fa';

function TopBar({ onLoginClick }) {
  const [currentTime, setCurrentTime] = useState('');
  const [user, setUser] = useState(localStorage.getItem('loggedInUser') || '');

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
    const handleStorageChange = () => {
      setUser(localStorage.getItem('loggedInUser') || '');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div
      style={{
        backgroundColor: '#1a1a1a',
        padding: '10px 20px',
        position: 'fixed',
        top: 0,
        width: '100%',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <img src="/logo192.png" alt="Logo" style={{ width: '42px', height: '42px' }} />
        <span style={{ color: 'white', fontSize: '14px' }}>{currentTime}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FaCog color="#ccc" size={20} />
          <div
            style={{
              color: user ? '#00C853' : '#ccc',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={onLoginClick}
          >
            {user ? <FaUserCheck /> : <FaUser />}
            {!user && 'user'}
          </div>
        </div>
      </div>
      <hr
        style={{
          borderTop: '1px solid white',
          marginTop: '12px',
          marginBottom: '20px',
        }}
      />
    </div>
  );
}

export default TopBar;