import React, { useEffect, useState } from 'react';
import {
  calculateEV,
  estimateConfidence,
  generateLabel,
  generateNote
} from './ai/aiEngine';
import AIControlPanel from './components/AIControlPanel';
import './components/PredictionCard.css';

function LiveTennis() {
  const [matches, setMatches] = useState([]);
  const [filters, setFilters] = useState({
    ev: 0,
    confidence: 0,
    label: 'ALL'
  });

  useEffect(() => {
    fetch('/api/tennis/live')
      .then((res) => res.json())
      .then((data) => {
        const enriched = data.map((match) => {
          const ev = calculateEV(match.oddsPlayer1, match.oddsPlayer2);
          const confidence = estimateConfidence(match.oddsPlayer1, match.oddsPlayer2);
          const aiLabel = generateLabel(ev, confidence);
          const aiNote = generateNote(aiLabel, ev, confidence);
          return { ...match, ev, confidence, aiLabel, aiNote };
        });
        setMatches(enriched);
      });
  }, []);

  const getLabelColor = (label) => {
    switch (label) {
      case 'SAFE': return '#00C853';
      case 'RISKY': return '#FFD600';
      case 'AVOID': return '#D50000';
      case 'STARTS SOON': return '#B0BEC5';
      default: return '#FFFFFF';
    }
  };

  const getDotColor = (label) => {
    return label === 'STARTS SOON' ? '#D50000' : '#00C853';
  };

  const isBlinking = (label) => label !== 'STARTS SOON';

  const filteredMatches = matches.filter((match) => {
    if (match.ev * 100 < filters.ev) return false;
    if (match.confidence < filters.confidence) return false;
    if (filters.label !== 'ALL' && match.aiLabel !== filters.label) return false;
    return true;
  });

  return (
    <div style={{ backgroundColor: '#121212', padding: '80px 16px 20px', minHeight: '100vh' }}>
      <AIControlPanel filters={filters} setFilters={setFilters} />
      {filteredMatches.map((match) => (
        <div key={match.id} className="prediction-card">
          <div className="top-row">
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
          <div className="info-row">
            <span className="info-item">EV: {(match.ev * 100).toFixed(1)}%</span>
            <span className="info-item">Conf: {match.confidence}%</span>
          </div>
          <div className="note">
            <em>{match.aiNote}</em>
          </div>
        </div>
      ))}
    </div>
  );
}

export default LiveTennis;