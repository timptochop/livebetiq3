import React from 'react';
import './TopBar.css';

function TopBar() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');

  return (
    <div className="top-bar">
      <img src="/logo192.png" alt="Logo" className="logo" />
      <div className="right-section">
        <span className="time">Server Time: {hours}:{minutes}</span>
        <span className="icon">⚙️</span>
        <span className="icon">👤</span>
      </div>
    </div>
  );
}

export default TopBar;