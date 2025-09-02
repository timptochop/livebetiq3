// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import './LiveTennis.css';

function parseDateTime(d, t) {
  const ds = String(d || '').trim();
  const ts = String(t || '').trim();
  if (!ds) return null;
  const [dd, mm, yyyy] = ds.split('.').map(Number);
  let HH = 0, MM = 0;
  if (ts.includes(':')) {
    const parts = ts.split(':').map(Number);
    HH = parts[0] || 0;
    MM = parts[1] || 0;
  }
  const dt = new Date(yyyy || 1970, (mm || 1) - 1, dd || 1, HH, MM, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}
function isUpcoming(s) { return String(s || '').toLowerCase() === 'not started'; }
function isFinishedLike(s) {
  const x = String(s || '').toLowerCase();
  return (
    x === 'finished' || x === 'cancelled' || x === 'retired' ||
    x === 'abandoned' || x === 'postponed' || x === 'walk over'
  );
}
function num(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim(); if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
}
function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [num(a.s1), num(a.s2), num(a.s3), num(a.s4), num(a.s5)];
  const sB = [num(b.s1), num(b.s2), num(b.s3), num(b.s4), num(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k;
}

export default function LiveTennis() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const matches = await fetchTennisLive();
      setRows(Array.isArray(matches) ? matches : []);
    } catch (e) {
      setErr(e.message || 'Failed to load'); setRows([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const normalized = useMemo(() => {
    return rows.map((m) => {
      const players =
        Array.isArray(m.players) ? m.players :
        Array.isArray(m.player)  ? m.player  : [];
      const p1 = players[0] || {};
      const p2 = players[1] || {};
      const name1 = p1.name || p1['@name'] || '';
      const name2 = p2.name || p2['@name'] || '';
      const date = m.date || m['@date'] || '';
      const time = m.time || m['@time'] || '';
      const dt = parseDateTime(date, time);
      const status = m.status || m['@status'] || '';
      const setNum = currentSetFromScores(players) || 0;

      const pr = m.prediction || {};
      const label = String((pr.label || 'PENDING')).toUpperCase();

      return {
        id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
        date, time, dt, status, setNum,
        categoryName: m.categoryName || m['@category'] || m.category || '',
        name1, name2,
        label
      };
    });
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const term = q.trim().toLowerCase();
    const keep = normalized.filter((m) => {
      if (isFinishedLike(m.status)) return false;
      if (!term) return true;
      const blob = `${m.name1} ${m.name2} ${m.categoryName}`.toLowerCase();
      return blob.includes(term);
    });
    return [...keep].sort((a, b) => {
      const liveA = !isUpcoming(a.status) && !isFinishedLike(a.status);
      const liveB = !isUpcoming(b.status) && !isFinishedLike(b.status);
      if (liveA !== liveB) return liveA ? -1 : 1;
      const s = (b.setNum || 0) - (a.setNum || 0);
      if (s !== 0) return s;
      const ta = a.dt ? a.dt.getTime() : Number.POSITIVE_INFINITY;
      const tb = b.dt ? b.dt.getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }, [normalized, q]);

  const badgeClass = (m) => {
    if (isUpcoming(m.status)) return 'badgeSoon';
    if (isFinishedLike(m.status)) return 'badgeHidden';

    if (m.label === 'SAFE') return 'badgeSafe';
    if (m.label === 'RISKY') return 'badgeRisky';
    if (m.label === 'AVOID') return 'badgeAvoid';
    return 'badgeIdle';
  };

  const badgeText = (m) => {
    if (isUpcoming(m.status)) return 'STARTS SOON';
    if (m.setNum > 0) return `SET ${m.setNum}`;
    if (m.label === 'SAFE' || m.label === 'RISKY' || m.label === 'AVOID')
      return m.label;
    return 'LIVE';
  };

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
          {filteredSorted.length === 0 ? (
            <div className="empty">Καμία εγγραφή.</div>
          ) : (
            filteredSorted.map((m) => {
              const live = !isUpcoming(m.status) && !isFinishedLike(m.status);
              return (
                <div key={m.id} className="matchRow">
                  <div
                    className="statusDot"
                    style={{ background: live ? '#2ecc71' : '#e53935' }}
                  />
                  <div className="matchBody">
                    <div className="names">
                      <span className="pname">{m.name1}</span>
                      <span className="vs">vs</span>
                      <span className="pname">{m.name2}</span>
                    </div>
                    <div className="meta">
                      {m.date} {m.time} • {m.categoryName}
                    </div>
                  </div>
                  <div className={`badge ${badgeClass(m)}`}>{badgeText(m)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}