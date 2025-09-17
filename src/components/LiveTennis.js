// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';
import './LiveTennis.css';

const isUpcoming = (s) => String(s || '').toLowerCase() === 'not started';
const isFinishedLike = (s) => {
  const x = String(s || '').toLowerCase();
  return ['finished','cancelled','retired','abandoned','postponed','walk over'].includes(x);
};
const isLive = (s) => !!s && !isUpcoming(s) && !isFinishedLike(s);

export default function LiveTennis({ onLiveCount = () => {} }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true); setErr('');
    try {
      const data = await fetchTennisLive();
      setRows(Array.isArray(data) ? data : (data?.matches || []));
    } catch (e) {
      setErr(e?.message || 'Load failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  // Normalize + AI
  const normalized = useMemo(() => {
    return rows
      .filter((m) => !isFinishedLike(m.status))
      .map((m) => {
        const players = Array.isArray(m.players) ? m.players : (Array.isArray(m.player) ? m.player : []);
        const p1 = players[0] || {}, p2 = players[1] || {};
        const name1 = p1.name || p1['@name'] || m.home || '';
        const name2 = p2.name || p2['@name'] || m.away || '';
        const date = m.date || m['@date'] || '';
        const time = m.time || m['@time'] || '';
        const status = m.status || m['@status'] || '';
        const categoryName = m.categoryName || m['@category'] || m.category || '';

        const ai = analyzeMatch(m); // <— ΝΕΟ AI
        const label = ai.label || 'PENDING';

        return {
          id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
          name1, name2, date, time, status, categoryName,
          isLive: ai.isLive,
          setNum: ai.setNum,
          ai,
          // searchable blob
          blob: `${name1} ${name2} ${categoryName}`.toLowerCase(),
        };
      });
  }, [rows]);

  // search
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return normalized;
    return normalized.filter(x => x.blob.includes(term));
  }, [normalized, q]);

  // live counter to TopBar
  useEffect(() => {
    const liveCount = filtered.reduce((n, m) => n + (m.isLive ? 1 : 0), 0);
    onLiveCount(liveCount);
  }, [filtered, onLiveCount]);

  // sorting:
  // SAFE → RISKY → AVOID → SET 3 → SET 2 → SET 1 → STARTS SOON
  const prio = (m) => {
    const L = m.ai.label || '';
    if (L === 'SAFE') return 0;
    if (L === 'RISKY') return 1;
    if (L === 'AVOID') return 2;
    if (/^SET\s*3/i.test(L) || m.setNum === 3) return 3;
    if (/^SET\s*2/i.test(L) || m.setNum === 2) return 4;
    if (/^SET\s*1/i.test(L) || m.setNum === 1) return 5;
    if (L === 'STARTS SOON') return 6;
    return 9;
  };
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const pa = prio(a) - prio(b);
      if (pa !== 0) return pa;
      // tie-break: πιο προχωρημένο set &/or ώρα
      if (a.isLive && b.isLive) return (b.setNum || 0) - (a.setNum || 0);
      return String(a.time).localeCompare(String(b.time));
    });
  }, [filtered]);

  return (
    <div className="lt-page">
      <div className="lt-card">
        <div className="lt-header">
          <h2>Tennis — Live & Upcoming (AI Predictions)</h2>
          <div className="lt-searchrow">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Αναζήτηση παίκτη ή διοργάνωσης…"
            />
            {loading && <span className="muted">Φόρτωση…</span>}
            {err && <span className="error">{err}</span>}
          </div>
        </div>

        <div className="lt-list">
          {sorted.length === 0 ? (
            <div className="empty">Καμία εγγραφή.</div>
          ) : (
            sorted.map((m) => {
              const L = m.ai.label || '';
              const liveDot = m.isLive ? '#1fdd73' : '#e53935';
              let badgeClass = 'badgeSoon';
              let badgeText  = 'STARTS SOON';
              if (L === 'SAFE' || L === 'RISKY' || L === 'AVOID') {
                badgeClass = 'badgeLive';  // πράσινη για decider predictions
                badgeText  = L;
              } else if (m.isLive) {
                badgeClass = 'badgeDone';  // μωβ για SET n
                badgeText  = `SET ${m.setNum || 1}`;
              }

              return (
                <div key={m.id} className="matchRow">
                  <div className="statusDot" style={{ background: liveDot }} />
                  <div className="matchBody">
                    <div className="names">
                      <span className="pname">{m.name1}</span>
                      <span className="vs">vs</span>
                      <span className="pname">{m.name2}</span>
                    </div>
                    <div className="meta">
                      {m.date} {m.time} • {m.categoryName}
                      {m.ai.tip && <> &nbsp;•&nbsp; <strong>TIP:</strong> {m.ai.tip}</>}
                      {m.ai.reason && <> &nbsp;•&nbsp; <span title={m.ai.reason} style={{ opacity:.85 }}>({m.ai.reason})</span></>}
                    </div>
                  </div>
                  <div className={`badge ${badgeClass}`}>{badgeText}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}