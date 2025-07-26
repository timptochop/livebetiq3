import React, { useEffect, useState } from 'react';
import './TopBar.css';
import logo from '../../public/logo192.png';

const TopBar = () => {
  const [serverTime, setServerTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setServerTime(`${hours}:${minutes}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="top-bar">
      <div className="left-section">
        <img src={logo} alt="Live Bet IQ Logo" className="logo" />
      </div>
      <div className="center-section">
        <div className="time">{serverTime}</div>
      </div>
      <div className="right-section">
        <span className="icon">⚙️</span>
        <span className="icon">🔐</span>
      </div>
    </div>
  );
};

export default TopBar;