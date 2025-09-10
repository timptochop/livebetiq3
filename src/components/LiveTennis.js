// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState, useRef } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';

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
  const s = String(status || '').toLowerCase();
  let m = s.match(/set\s*([1-5])/i);
  if (m) return parseInt(m[1]);
  if (s.includes('set 3')) return 3;
  if (s.includes('set 2')) return 2;
  if (s.includes('set 1')) return 1;
  if (s.includes('in progress')) return 1;
  return 0;
}

export default function LiveTennis() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const notifiedRef = useRef({});

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const raw = await fetchTennisLive();

      console.log('[LiveTennis] ✅ Total matches from API:', raw.length);

      const filtered = raw.filter((m) => !isFinishedLike(m.status));
      console.log('[LiveTennis] ⏩ After filter (not finished):', filtered.length);

      const analyzed = await Promise.all(
        filtered.map(async (match, index) => {
          const safeId = match.id || `${match.home}-${match.away}-${index}`;
          try {
            const result = await analyzeMatch(match);
            return {
              id: safeId,
              ...result,
            };
          } catch (err) {
            console.warn(`⚠️ analyzeMatch failed for match ${safeId}:`, err.message);
            return {
              id: safeId,
              ...match,
              ev: 0,
              confidence: 0,
              kelly: 0,
              label: 'SAFE',
              note: 'Fallback: analyzeMatch failed',
            };
          }
        })
      );

      const final = analyzed.filter(Boolean);
      console.log('[LiveTennis] ✅ Final rows after analysis:', final.length);

      setRows(final);
    } catch (err) {
      console.error('[LiveTennis] ❌ Load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const sortedRows = useMemo(() => {
    const priority = {
      SAFE: 1,
      RISKY: 2,
      AVOID: 3,
      SET: 4,
      SOON: 5,
    };
    return [...rows].sort((a, b) => {
      const prioA = priority[getLabelGroup(a.label)] || 99;
      const prioB = priority[getLabelGroup(b.label)] || 99;
      return prioA - prioB;
    });
  }, [rows]);

  const getLabelGroup = (label) => {
    if (label === 'SAFE') return 'SAFE';
    if (label === 'RISKY') return 'RISKY';
    if (label === 'AVOID') return 'AVOID';
    if (label?.startsWith('SET')) return 'SET';
    if (label?.startsWith('START')) return 'SOON';
    return 'OTHER';
  };

  return (
    <main style={{ padding: '16px', paddingTop: '104px', minHeight: '100vh' }}>
      <h2>Live Tennis Matches</h2>

      {loading && <p>Loading...</p>}
      {!loading && rows.length === 0 && (
        <p style={{ color: 'orange' }}>
          ⚠️ No matches found. Possible issues:
          <ul>
            <li>GoalServe API returned empty or failed</li>
            <li>fetchTennisLive.js blocked by CORS</li>
            <li>analyzeMatch failed / filters too strict</li>
          </ul>
        </p>
      )}

      {sortedRows.map((m) => (
        <div key={m.id} style={{ marginBottom: '16px', border: '1px solid #ccc', padding: '8px' }}>
          <strong>{m.home} vs {m.away}</strong>
          <div>Status: {m.status}</div>
          <div>Label: <strong>{m.label}</strong></div>
          {m.tip && <div style={{ color: 'green' }}>{m.tip}</div>}
          <div>EV: {(m.ev * 100).toFixed(2)}%</div>
          <div>Confidence: {Math.round(m.confidence)}%</div>
          {m.note && <div style={{ fontStyle: 'italic', fontSize: '0.9em' }}>{m.note}</div>}
        </div>
      ))}
    </main>
  );
}