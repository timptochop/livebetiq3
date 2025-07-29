// src/components/TopBar.js
import React, { useState, useEffect } from 'react';
import { FaCog, FaUser } from 'react-icons/fa';
import './TopBar.css';

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

  return (
    <div className="topbar-container">
      <div className="topbar-inner">
        <img src="/logo192.png" alt="Logo" className="topbar-logo" />
        <span className="topbar-time">{currentTime}</span>
        <div className="topbar-icons">
          <FaCog className="topbar-icon" />
          <div className="topbar-user" onClick={onLoginClick}>
            <FaUser />
            <span className="username">{user}</span>
          </div>
        </div>
      </div>
      <hr className="topbar-divider" />
    </div>
  );
}

export default TopBar;