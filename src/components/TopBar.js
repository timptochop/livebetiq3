import React, { useEffect, useState } from 'react';
import { FaCog } from 'react-icons/fa';

function TopBar({ onLoginClick, onSettingsChange }) {
  const [currentTime, setCurrentTime] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('loggedInUser'));
  const [showSettings, setShowSettings] = useState(false);

  // Settings state
  const [minEV, setMinEV] = useState(0);
  const [minConfidence, setMinConfidence] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

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

  useEffect(() => {
    onSettingsChange?.({ minEV, minConfidence, selectedLabel, notificationsEnabled });
  }, [minEV, minConfidence, selectedLabel, notificationsEnabled, onSettingsChange]);

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      padding: '10px 16px 0',
      position: 'fixed',
      top: 0,
      width: '100%',
      zIndex: 1000
    }}>
      {/* Top Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px'
      }}>
        {/* Logo */}
        <img
          src="/logo192.png"
          alt="Logo"
          style={{ width: '40px', height: '40px', borderRadius: '50%', marginLeft: '-4px' }}
        />

        {/* Time - Settings - Login */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', transform: 'translateY(2px)' }}>
          <span style={{ color: '#fff', fontSize: '14px', transform: 'translateX(10px)' }}>{currentTime}</span>

          <FaCog
            color="#ccc"
            size={20}
            style={{ cursor: 'pointer', transform: 'translateX(-6px)' }}
            onClick={() => setShowSettings(true)}
          />

          <div
            onClick={onLoginClick}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', transform: 'translateX(-8px)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
              fill={isLoggedIn ? '#00C853' : '#ccc'} viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 
              1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Gradient Divider */}
      <div style={{ marginBottom: '14px', width: '100%' }}>
        <div style={{
          height: '2px',
          background: 'linear-gradient(to right, transparent, white, transparent)'
        }} />
      </div>

      {/* Slide-in Settings Panel */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '100%',
          maxWidth: '360px',
          height: '100vh',
          backgroundColor: '#222',
          zIndex: 1100,
          padding: '20px',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.6)',
          overflowY: 'auto'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '20px' }}>⚙ Settings</h3>

          <div style={{ marginBottom: '20px' }}>
            <label>Min EV: {minEV}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={minEV}
              onChange={(e) => setMinEV(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label>Min Confidence: {minConfidence}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label>Filter Label:</label>
            <select
              value={selectedLabel}
              onChange={(e) => setSelectedLabel(e.target.value)}
              style={{ width: '100%', padding: '6px', borderRadius: '4px', marginTop: '6px' }}
            >
              <option value="">All</option>
              <option value="SAFE">SAFE</option>
              <option value="RISKY">RISKY</option>
              <option value="AVOID">AVOID</option>
              <option value="STARTS SOON">STARTS SOON</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Enable Notifications
            </label>
          </div>

          <button
            onClick={() => setShowSettings(false)}
            style={{
              marginTop: '10px',
              backgroundColor: '#00C853',
              color: '#000',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default TopBar;