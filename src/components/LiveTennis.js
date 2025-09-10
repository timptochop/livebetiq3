// File: src/components/LiveTennis.js

import React, { useEffect, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';
import '../styles/LiveTennis.css';

export default function LiveTennis() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { matches } = await fetchTennisLive();
        console.log('🎾 Raw matches from API:', matches);

        const analyzed = await Promise.all(
          matches.slice(0, 3).map(async (match) => {
            try {
              const result = await analyzeMatch(match);
              return { ...match, ...result };
            } catch (err) {
              console.warn(`⚠️ analyzeMatch failed for match ${match.id}:`, err.message);
              return {
                ...match,
                aiLabel: 'ERROR',
                aiNote: err.message || 'Analysis failed',
              };
            }
          })
        );

        console.table(analyzed);
        setRows(analyzed);
      } catch (err) {
        console.error('🔥 Error loading matches:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <div className="LiveTennis">Loading matches...</div>;

  return (
    <div className="LiveTennis">
      <h2>🎾 AI Tennis Predictions (Debug Mode)</h2>

      {rows.length === 0 && <div className="no-matches">No matches to display.</div>}

      {rows.map((m, i) => (
        <div key={i} className="match-card">
          <div className="match-header">
            <strong>
              {m?.home?.name || m?.player?.[0]?.name || 'Unknown'} vs{' '}
              {m?.away?.name || m?.player?.[1]?.name || 'Unknown'}
            </strong>
            <span className={`label ${m.aiLabel?.toLowerCase() || 'none'}`}>
              {m.aiLabel || 'No Label'}
            </span>
          </div>

          <div className="match-note">
            {m.aiNote || 'No AI Note'}
          </div>

          <div className="match-status">
            Status: {m.status || 'Unknown'}
          </div>
        </div>
      ))}
    </div>
  );
}