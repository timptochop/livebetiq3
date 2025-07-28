import React, { useEffect, useState } from 'react';
import './components/PredictionCard.css';

function LiveTennis() {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    fetch('/api/tennis/live')
      .then((res) => res.json())
      .then((data) => setMatches(data))
      .catch((err) => console.error('Error fetching matches:', err));
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
    <div style={{ backgroundColor: '#121212', padding: '80px 16px 20px', minHeight: '100vh' }}>
      {matches.map((match) => (
        <div key={match.id} className="prediction-card">
          <div className="top-row">
            <span
              className={`dot ${isBlinking(match.aiLabel) ? 'blinking' : ''}`}
              style={{ backgroundColor: getDotColor(match.aiLabel) }}
            ></span>
            <span className="match-name">
              {match.player1} vs {match.player2}
            </span>
            <span
              className="label"
              style={{ backgroundColor: getLabelColor(match.aiLabel) }}
            >
              {match.aiLabel}
            </span>
          </div>

          {match.ev !== null && match.confidence !== null && (
            <div className="info-row">
              <span className="info-item">EV: {(match.ev * 100).toFixed(1)}%</span>
              <span className="info-item">Conf: {match.confidence}%</span>
            </div>
          )}

          {match.aiNote && (
            <div className="note">
              <em>{match.aiNote}</em>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default LiveTennis;