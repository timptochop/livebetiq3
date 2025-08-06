import React, { useState, useEffect } from 'react';
import { FaCog } from 'react-icons/fa';

function TopBar({ onLoginClick, onLogout, isLoggedIn, filters, setFilters }) {
  const [currentTime, setCurrentTime] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);

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
    <div style={{
      backgroundColor: '#1a1a1a',
      padding: '10px 16px 0',
      position: 'fixed',
      top: 0,
      width: '100%',
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px'
      }}>
        <img
          src="/logo192.png"
          alt="Logo"
          style={{ width: '40px', height: '40px', borderRadius: '50%', marginLeft: '-4px' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', transform: 'translateY(2px)' }}>
          <span style={{ color: '#fff', fontSize: '14px', transform: 'translateX(-20px)' }}>{currentTime}</span>

          <FaCog
            color="#ccc"
            size={20}
            style={{ cursor: 'pointer', transform: 'translateX(-28px)' }}
            onClick={() => setShowSettings(true)}
          />

          <div style={{ position: 'relative', cursor: 'pointer', transform: 'translateX(-36px)' }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill={isLoggedIn ? '#00C853' : '#ccc'}
              viewBox="0 0 24 24"
              onClick={() => {
                if (!isLoggedIn) onLoginClick();
                else setShowLogoutMenu(!showLogoutMenu);
              }}
            >
              <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 
                1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
            </svg>

            {isLoggedIn && showLogoutMenu && (
              <div style={{
                position: 'absolute',
                top: '26px',
                right: 0,
                backgroundColor: '#333',
                borderRadius: '6px',
                padding: '8px',
                color: 'white',
                fontSize: '14px',
                zIndex: 2000
              }}>
                <div
                  onClick={() => {
                    onLogout();
                    setShowLogoutMenu(false);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  Logout
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '14px', width: '100%' }}>
        <div style={{
          height: '2px',
          background: 'linear-gradient(to right, transparent, white, transparent)'
        }} />
      </div>

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
          <h3 style={{ color: '#fff', marginBottom: '20px' }}>Settings</h3>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#fff' }}>Min EV: {filters.ev}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={filters.ev}
              onChange={(e) => setFilters({ ...filters, ev: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#fff' }}>Min Confidence: {filters.confidence}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={filters.confidence}
              onChange={(e) => setFilters({ ...filters, confidence: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#fff' }}>Filter Label:</label>
            <select
              value={filters.label}
              onChange={(e) => setFilters({ ...filters, label: e.target.value })}
              style={{ width: '100%', padding: '6px', borderRadius: '4px', marginTop: '6px' }}
            >
              <option value="ALL">All</option>
              <option value="SAFE">SAFE</option>
              <option value="RISKY">RISKY</option>
              <option value="AVOID">AVOID</option>
              <option value="STARTS SOON">STARTS SOON</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px', color: '#fff' }}>
            <label>
              <input
                type="checkbox"
                checked={filters.notifications}
                onChange={(e) => setFilters({ ...filters, notifications: e.target.checked })}
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