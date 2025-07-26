import React, { useEffect, useState } from 'react';
import './TopBar.css';
import logo from '../../public/logo192.png'; // Ενδέχεται να αλλάξει αν το έχεις αλλού

const TopBar = () => {
  const [serverTime, setServerTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setServerTime(`${hours}:${minutes}`);
    };

    updateTime(); // αρχικό set
    const interval = setInterval(updateTime, 60000); // ανανέωση ανά λεπτό
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="top-bar">
      <img src={logo} alt="Live Bet IQ Logo" className="logo" />
      <div className="time">{serverTime}</div>
      <div className="icons">
        <span role="img" aria-label="settings" className="icon">⚙️</span>
        <span role="img" aria-label="login" className="icon">🔐</span>
      </div>
    </div>
  );
};

export default TopBar;