import React, { useEffect, useState } from 'react';
import './components/PredictionCard.css';

function LiveTennis() {
  const [matches, setMatches] = useState([]);

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
    return label === 'STARTS SOON' ? '#D50000' : '#00C853'; // Κόκκινο αν δεν έχει ξεκινήσει
  };

  const isBlinking = (label) => {
    return label !== 'STARTS SOON';
  };

  return (
    <div>
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