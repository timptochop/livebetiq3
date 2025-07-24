import React from 'react';
import './PredictionCard.css';

function PredictionCard({ match, label }) {
  const labelColors = {
    SAFE: 'green',
    RISKY: 'yellow',
    AVOID: 'red',
    'STARTS SOON': 'gray'
  };

  return (
    <div className="card">
      <div className="indicator-and-text">
        <span className="blinking-dot"></span>
        <span className="match-name">{match}</span>
      </div>
      <div className={`label ${labelColors[label]}`}>{label}</div>
    </div>
  );
}

export default PredictionCard;