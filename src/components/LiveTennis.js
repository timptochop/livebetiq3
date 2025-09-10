import React, { useEffect, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';

function LiveTennis() {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchTennisLive();
        const analyzed = await Promise.all(
          data.map(async (match) => {
            const analysis = await analyzeMatch(match);
            return { ...match, ...analysis };
          })
        );
        setMatches(analyzed);
      } catch (err) {
        console.error('Error loading matches:', err);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {matches.map((match) => (
        <div key={match.id} style={{ border: '1px solid #444', padding: '10px', marginBottom: '10px' }}>
          <strong>{match.player1} vs {match.player2}</strong>
          <div>Status: {match.status}</div>
          <div>Label: {match.label}</div>
          <div>EV: {match.ev}</div>
          <div>Confidence: {match.confidence}%</div>
          {match.tip && <div>TIP: {match.tip}</div>}
        </div>
      ))}
    </div>
  );
}

export default LiveTennis;U