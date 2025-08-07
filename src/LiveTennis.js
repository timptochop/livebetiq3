import React, { useEffect, useState, useRef } from 'react';
import './PredictionCard.css';

const LiveTennis = ({ filters, notificationsEnabled }) => {
  const [matches, setMatches] = useState([]);
  const notifiedMatchesRef = useRef(new Set());

  const fetchData = async () => {
    const res = await fetch('/api/live-matches');
    const data = await res.json();
    setMatches(data);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const playNotification = () => {
    const audio = new Audio('/notification.mp3');
    audio.play();
  };

  const filteredMatches = matches.filter(match => {
    const ev = match.ev;
    const conf = match.confidence;
    const label = match.label;
    const evPass = ev >= filters.minEV;
    const confPass = conf >= filters.minConfidence;
    const labelPass = filters.label === 'All' || filters.label === label;
    return evPass && confPass && labelPass;
  });

  useEffect(() => {
    filteredMatches.forEach((match) => {
      if (
        (match.label === 'SAFE' || match.label === 'RISKY') &&
        match.ev > 5 &&
        notificationsEnabled &&
        !notifiedMatchesRef.current.has(match.id)
      ) {
        playNotification();
        notifiedMatchesRef.current.add(match.id);
      }
    });
  }, [filteredMatches, notificationsEnabled]);

  return (
    <div>
      {filteredMatches.map((match) => (
        <div key={match.id} className={`prediction-card ${match.label.toLowerCase()}`}>
          <div><strong>{match.player1} vs {match.player2}</strong></div>
          <div>EV: {match.ev.toFixed(2)}%</div>
          <div>Confidence: {match.confidence.toFixed(2)}%</div>
          <div>Label: <span className="label">{match.label}</span></div>
          <div className="note">{match.note}</div>
          {match.label !== 'STARTS SOON' && <span className="blinking-dot"></span>}
        </div>
      ))}
    </div>
  );
};

export default LiveTennis;