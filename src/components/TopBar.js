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
          <span style={{ color: '#fff', fontSize: '14px', transform: 'translateX(6px)' }}>{currentTime}</span>

          <FaCog
            color="#ccc"
            size={20}
            style={{ cursor: 'pointer', transform: 'translateX(-12px)' }}
            onClick={() => setShowSettings(!showSettings)}
          />

          <div
            onClick={onLoginClick}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transform: 'translateX(-32px)'
            }}
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
    </div>
  );
}

export default TopBar;