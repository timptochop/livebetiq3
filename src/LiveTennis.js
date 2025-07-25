import React, { useEffect, useState } from 'react';
import './components/PredictionCard.css';

function LiveTennis() {
  const [matches, setMatches] = useState([]);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    // Update the clock every 30 seconds
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch('/api/tennis/live')
      .then((res) => res.json())
      .then((data) => setMatches(data));
  }, []);

  const getLabelColor = (label) => {
    switch (label) {
      case 'SAFE':
        return '#00C853';
      case 'RISKY':
        return '#FFD600';
      case 'AVOID':
        return '#D50000';
      case 'STARTS SOON':
        return '#B0BEC5';
      default:
        return '#FFFFFF';
    }
  };

  const getDotColor = (label) => {
    return label === 'STARTS SOON' ? '#D50000' : '#00C853';
  };

  const isBlinking = (label) => {
    return label !== 'STARTS SOON';
  };

  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', padding: '0px 20px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '20px' }}>
        <img src="/logo192.png" alt="Logo" style={{ width: '40px', height: '40px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{currentTime}</span>
          <span className="settings-icon" style={{ fontSize: '22px', color: '#ffffff' }}>⚙️</span>
          <span className="login-icon" style={{ fontSize: '22px', color: '#ffffff' }}>👤</span>
        </div>
      </div>

      {/* White Line */}
      <hr style={{ borderTop: '1px solid white', marginTop: '12px', marginBottom: '25px' }} />

      {/* Match Cards */}
      {matches.map((match) => (
        <div key={match.id} className="prediction-card">
          <span
            className={`dot ${isBlinking(match.aiLabel) ? 'blinking' : ''}`}
            style={{ backgroundColor: getDotColor(match.aiLabel) }}
          ></span>
          <span className="match-name">{match.player1} vs {match.player2}</span>
          <span
            className="label"
            style={{ backgroundColor: getLabelColor(match.aiLabel) }}
          >
            {match.aiLabel}
          </span>
        </div>
      ))}
    </div>
  );
}

export default LiveTennis;