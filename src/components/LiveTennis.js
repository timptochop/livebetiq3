// src/components/LiveTennis.js
import React, { useEffect, useState, useMemo, useRef } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';
import './LiveTennis.css'; // ✅ Το CSS παραμένει στο components folder

const isUpcoming = (s) => String(s || '').toLowerCase() === 'not started';
const isFinishedLike = (s) => {
  const x = String(s || '').toLowerCase();
  return ['finished', 'cancelled', 'retired', 'abandoned', 'postponed', 'walk over'].includes(x);
};

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function setFromStatus(status) {
  const s = String(status || '');
  let m = s.match(/set\s*([1-5])/i);
  if (m) return parseInt(m[1], 10);
  if (/1st/i.test(s)) return 1;
  if (/2nd/i.test(s)) return 2;
  if (/3rd/i.test(s)) return 3;
  return null;
}

function currentSetFromScores(score1, score2) {
  const s1 = Array.isArray(score1) ? score1.length : 0;
  const s2 = Array.isArray(score2) ? score2.length : 0;
  const max = Math.max(s1, s2);
  return max > 0 ? max : null;
}

function LiveTennis() {
  const [rows, setRows] = useState([]);
  const notifiedRef = useRef({});

  const load = async () => {
    try {
      const data = await fetchTennisLive();
      const filtered = data.filter((m) => !isFinishedLike(m.status));
      const analyzed = await Promise.all(
        filtered.map(async (match) => {
          const ai = await analyzeMatch(match);
          const setNum =
            setFromStatus(match.status) || currentSetFromScores(match.score1, match.score2) || null;

          return {
            ...match,
            ai,
            setNum,
          };
        })
      );
      setRows(analyzed);
    } catch (err) {
      console.error('Error loading matches:', err);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const sortedRows = useMemo(() => {
    const labelPriority = {
      SAFE: 1,
      RISKY: 2,
      AVOID: 3,
      'SET 3': 4,
      'SET 2': 5,
      'SET 1': 6,
      SOON: 7,
    };

    return [...rows]
      .map((row) => {
        const { ai, setNum } = row;
        let label = ai?.label;

        if (!label || label === 'PENDING') {
          if (setNum === 3) label = 'SET 3';
          else if (setNum === 2) label = 'SET 2';
          else if (setNum === 1) label = 'SET 1';
          else if (isUpcoming(row.status)) label = 'SOON';
          else label = 'SET 1'; // fallback
        }

        return {
          ...row,
          label,
          labelOrder: labelPriority[label] || 99,
        };
      })
      .sort((a, b) => a.labelOrder - b.labelOrder);
  }, [rows]);

  return (
    <div className="live-tennis-container">
      <h2>🎾 Live Tennis AI Predictions</h2>
      {sortedRows.map((match, i) => (
        <div className={`match-card ${match.label.toLowerCase()}`} key={i}>
          <div className="match-header">
            <span>{match.player1} vs {match.player2}</span>
            <span className="match-status">{match.status}</span>
          </div>
          <div className="match-body">
            <div className="score">
              {match.score1?.join('-')} : {match.score2?.join('-')}
            </div>
            <div className={`label label-${match.label.toLowerCase()}`}>{match.label}</div>
            {match.ai?.tip && (
              <div className="tip">
                <strong>TIP:</strong> {match.ai.tip}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default LiveTennis;