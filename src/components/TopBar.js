import React, { useEffect, useState } from 'react';
import './TopBar.css';
import { FaCog } from 'react-icons/fa';

export default function TopBar({ filters, setFilters }) {
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    };
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="topbar-container">
      <div className="topbar-inner">
        <img src="/logo192.png" alt="Logo" className="topbar-logo" />
        <span className="topbar-time">{currentTime}</span>
        <div className="topbar-icons">
          <FaCog className="topbar-icon" onClick={() => setShowSettings(true)} />
        </div>
      </div>
      <div className="topbar-divider" />

      {showSettings && (
        <div className="settings-panel">
          <h3 style={{ color:'#fff' }}>Settings</h3>

          <label style={{ color:'#fff' }}>Min EV: {filters.ev}%</label>
          <input type="range" min="0" max="100" value={filters.ev}
                 onChange={(e)=>setFilters({ ...filters, ev:Number(e.target.value) })} />

          <label style={{ color:'#fff' }}>Min Confidence: {filters.confidence}%</label>
          <input type="range" min="0" max="100" value={filters.confidence}
                 onChange={(e)=>setFilters({ ...filters, confidence:Number(e.target.value) })} />

          <label style={{ color:'#fff' }}>Filter Label:</label>
          <select value={filters.label}
                  onChange={(e)=>setFilters({ ...filters, label:e.target.value })}>
            <option value="ALL">All</option>
            <option value="SAFE">SAFE</option>
            <option value="RISKY">RISKY</option>
            <option value="AVOID">AVOID</option>
            <option value="STARTS SOON">STARTS SOON</option>
          </select>

          <label style={{ color:'#fff', display:'block', marginTop: 8 }}>
            <input type="checkbox" checked={filters.notifications}
                   onChange={(e)=>setFilters({ ...filters, notifications:e.target.checked })} />
            {' '}Enable Notifications
          </label>

          <button className="settings-close" onClick={()=>setShowSettings(false)}>Close</button>
        </div>
      )}
    </div>
  );
}