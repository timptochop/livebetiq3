import React, { useEffect, useState } from 'react';
import './TopBar.css';

function TopBar() {
  const [serverTime, setServerTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setServerTime(`${hours}:${minutes}`);
    };

    updateTime(); // Run once on load
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="top-bar">
      <img src="/logo192.png" alt="LiveBet IQ" className="top-bar-logo" />
      <div className="top-bar-right">
        <span className="server-time">Server Time: {serverTime}</span>
        <span className="top-bar-icon">⚙️</span>
        <span className="top-bar-icon">🔐</span>
      </div>
    </div>
  );
}

export default TopBar;