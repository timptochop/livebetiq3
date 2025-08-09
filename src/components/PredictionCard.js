// src/components/PredictionCard.js
import React from 'react';
import './PredictionCard.css';

function PredictionCard({ match }) {
  return (
    <div className="prediction-card">
      <div className="top-row">
        <span className="match-name">
          {match.player1} vs {match.player2}
        </span>
        <span className="label">{match.aiLabel}</span>
      </div>
      <div className="info-row">
        <span className="info-item">EV: {Number(match.ev).toFixed(1)}%</span>
        <span className="info-item">Conf: {Number(match.confidence).toFixed(0)}%</span>
      </div>
      <div className="note">
        <em>{match.aiNote}</em>
      </div>
    </div>
  );
}

export default PredictionCard;