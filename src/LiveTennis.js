import React from 'react';

const LiveTennis = ({ matches }) => {
  return (
    <div className="container">
      <img src="/logo512.png" alt="LiveBet IQ Logo" className="logo" />
      {matches.map((match, index) => (
        <div className="match" key={index}>
          <div className="match-title">{match.title}</div>
          <div className={`badge badge-${match.label.toLowerCase()}`}>
            {match.label}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LiveTennis;