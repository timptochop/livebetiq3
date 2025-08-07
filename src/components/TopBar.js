import React, { useState, useEffect } from 'react';
import { FaCog, FaUser } from 'react-icons/fa';
import './TopBar.css';

const TopBar = ({ onLoginClick, loggedInUser, filters, setFilters }) => {
  const [currentTime, setCurrentTime] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setCurrentTime(timeString);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const iconStyle = {
    fontSize: 22,
    marginLeft: 18,
    marginRight: 8,
    cursor: 'pointer',
    verticalAlign: 'middle',
    transform: 'translateY(3px)',
  };

  const loginIconStyle = {
    ...iconStyle,
    color: loggedInUser ? 'limegreen' : 'white',
    marginLeft: 28, // extra left space as ζητήθηκε
  };

  const panelStyle = {
    position: 'fixed',
    top: 0,
    right: settingsOpen ? 0 : '-300px',
    width: 300,
    height: '100%',
    backgroundColor: '#1c1c1c',
    padding: 20,
    boxShadow: '-2px 0 5px rgba(0,0,0,0.3)',
    transition: 'right 0.3s ease-in-out',
    zIndex: 999,
    color: '#fff',
    overflowY: 'auto',
  };

  const labelStyle = { display: 'block', marginTop: 15, fontSize: 14 };

  return (
    <>
      <div style={styles.topBar}>
        <img
          src="/logo192.png"
          alt="Logo"
          style={{ height: 32, width: 32, borderRadius: '50%', marginLeft: 10 }}
        />
        <span style={styles.time}>{currentTime}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', marginRight: 20 }}>
          <FaCog style={iconStyle} onClick={() => setSettingsOpen(!settingsOpen)} />
          <FaUser style={loginIconStyle} onClick={onLoginClick} />
        </div>
      </div>

      <div style={panelStyle}>
        <h3 style={{ marginTop: 0 }}>⚙ Ρυθμίσεις AI</h3>
        <label style={labelStyle}>Min EV %</label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={filters.minEV}
          onChange={(e) => setFilters({ ...filters, minEV: Number(e.target.value) })}
          style={styles.slider}
        />
        <div style={styles.value}>{filters.minEV}%</div>

        <label style={labelStyle}>Min Confidence %</label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={filters.minConfidence}
          onChange={(e) => setFilters({ ...filters, minConfidence: Number(e.target.value) })}
          style={styles.slider}
        />
        <div style={styles.value}>{filters.minConfidence}%</div>

        <label style={labelStyle}>Label Filter</label>
        <select
          value={filters.label}
          onChange={(e) => setFilters({ ...filters, label: e.target.value })}
          style={styles.select}
        >
          <option value="All">All</option>
          <option value="SAFE">SAFE</option>
          <option value="RISKY">RISKY</option>
          <option value="AVOID">AVOID</option>
          <option value="STARTS SOON">STARTS SOON</option>
        </select>

        <label style={labelStyle}>🔔 Ειδοποιήσεις</label>
        <label className="switch">
          <input
            type="checkbox"
            checked={filters.notificationsEnabled}
            onChange={(e) =>
              setFilters({ ...filters, notificationsEnabled: e.target.checked })
            }
          />
          <span className="sliderRound"></span>
        </label>

        <button style={styles.closeButton} onClick={() => setSettingsOpen(false)}>
          Κλείσιμο
        </button>
      </div>
    </>
  );
};

const styles = {
  topBar: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: '8px 0',
    color: 'white',
    position: 'fixed',
    top: 0,
    width: '100%',
    zIndex: 999,
  },
  time: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
    color: '#ccc',
  },
  slider: {
    width: '100%',
    marginTop: 6,
  },
  select: {
    width: '100%',
    padding: 6,
    borderRadius: 4,
    border: '1px solid #444',
    backgroundColor: '#222',
    color: '#fff',
    marginTop: 5,
  },
  closeButton: {
    marginTop: 30,
    padding: '8px 16px',
    backgroundColor: '#444',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    width: '100%',
  },
  value: {
    textAlign: 'right',
    fontSize: 13,
    marginBottom: 6,
    color: '#aaa',
  },
};

export default TopBar;