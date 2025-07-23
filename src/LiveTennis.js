import React from 'react';
import './styles.css';

function LiveTennis() {
  const matches = [
    { players: 'Alexander Zverev vs Roberto Bautista Agut', status: 'SAFE', live: true },
    { players: 'Taro Daniel vs Luca Nardi', status: 'RISKY', live: true },
    { players: 'Denis Shapovalov vs Taro Daniel', status: 'AVOID', live: true },
    { players: 'Linda Noskova vs Katie Boulter', status: 'STARTS SOON', live: false },
  ];

  return (
    <div className="app-container">
      {/* Fixed Header */}
      <div className="fixed-header">
        <img src="/logo512.png" alt="LiveBet IQ Logo" className="main-logo" />
        <div className="separator-line"></div>
      </div>

      {/* Match List */}
      <div className="match-list">
        {matches.map((match, index) => (
          <div key={index} className="match-card">
            <div className="left-section">
              <span className={`status-dot ${match.live ? 'live' : 'not-live'}`}></span>
            </div>
            <div className="players">{match.players}</div>
            <div className={`status-badge ${match.status.replace(' ', '-').toLowerCase()}`}>
              {match.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LiveTennis;