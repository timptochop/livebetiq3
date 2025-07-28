// src/components/TopBar.js
import React, { useEffect, useState } from 'react';
import LoginModal from './LoginModal';
import './TopBar.css';

function TopBar() {
  const [currentTime, setCurrentTime] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('loggedInUser');
    if (savedUser) setUser(savedUser);

    const interval = setInterval(() => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hh}:${mm}`);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLoginClick = () => setShowLogin(true);
  const handleLogin = (username) => setUser(username);

  return (
    <div style={{ backgroundColor: '#1a1a1a', padding: '10px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src="/logo192.png" alt="Logo" style={{ width: '36px', height: '36px' }} />
        <span style={{ color: 'white' }}>{currentTime}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px', color: '#ccc' }}>⚙️</span>
          <span
            style={{ fontSize: '22px', color: '#ccc', cursor: 'pointer' }}
            onClick={handleLoginClick}
          >
            👤 {user}
          </span>
        </div>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}
      <hr style={{ borderTop: '1px solid white', marginTop: '12px', marginBottom: '20px' }} />
    </div>
  );
}

export default TopBar;