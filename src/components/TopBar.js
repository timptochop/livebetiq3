import React, { useEffect, useState } from 'react';
import { FaCog, FaUser } from 'react-icons/fa';

function TopBar({ onLoginClick, user }) {
  const [currentTime, setCurrentTime] = useState('');
  const isLoggedIn = !!user;

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hh}:${mm}`);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        backgroundColor: '#1a1a1a',
        padding: '10px 20px',
        position: 'fixed',
        top: 0,
        width: '100%',
        zIndex: 1000
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <img
          src="/logo192.png"
          alt="Logo"
          style={{ width: '42px', height: '42px' }}
        />
        <span style={{ color: 'white', fontSize: '14px' }}>{currentTime}</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <FaCog color="#ccc" size={20} />
          <div
            style={{
              color: isLoggedIn ? '#00C853' : '#ccc',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            onClick={onLoginClick}
          >
            <FaUser />
          </div>
        </div>
      </div>
      <hr
        style={{
          borderTop: '1px solid white',
          marginTop: '12px',
          marginBottom: '20px'
        }}
      />
    </div>
  );
}

export default TopBar;