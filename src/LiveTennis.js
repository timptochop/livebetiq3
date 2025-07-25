import React, { useState, useEffect } from 'react';
import './components/PredictionCard.css';

function LiveTennis() {
  const [matches, setMatches] = useState([
    {
      id: 1,
      player1: 'Nadal',
      player2: 'Federer',
      aiLabel: 'SAFE'
    },
    {
      id: 2,
      player1: 'Djokovic',
      player2: 'Zverev',
      aiLabel: 'RISKY'
    },
    {
      id: 3,
      player1: 'Tsitsipas',
      player2: 'Alcaraz',
      aiLabel: 'AVOID'
    },
    {
      id: 4,
      player1: 'Sinner',
      player2: 'Medvedev',
      aiLabel: 'STARTS SOON'
    }
  ]);

  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hh}:${mm}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 10000); // κάθε 10s
    return () => clearInterval(interval);
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

  const isBlinking = (label) => label !== 'STARTS SOON';

  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', padding: '0 20px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '20px' }}>
        <img src="/logo192.png" alt="Logo" style={{ width: '40px', height: '40px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'white', fontSize: '13px' }}>{currentTime}</span>
          <span style={{ fontSize: '22px', color: '#ffffff' }}>⚙️</span>
          <span style={{ fontSize: '22px', color: '#ffffff' }}>👤</span>
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