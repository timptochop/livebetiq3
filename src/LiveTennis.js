import React from 'react';
import PredictionCard from './components/PredictionCard';

function LiveTennis() {
  const demoPredictions = [
    { match: "Alexander Zverev vs Roberto Bautista Agut", label: "SAFE" },
    { match: "Taro Daniel vs Luca Nardi", label: "RISKY" },
    { match: "Denis Shapovalov vs Taro Daniel", label: "AVOID" },
    { match: "Linda Noskova vs Katie Boulter", label: "STARTS SOON" }
  ];

  return (
    <div>
      <h2 style={{ color: 'white' }}>Live Tennis Matches</h2>
      {demoPredictions.map((pred, index) => (
        <PredictionCard key={index} match={pred.match} label={pred.label} />
      ))}
    </div>
  );
}

export default LiveTennis;