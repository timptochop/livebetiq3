// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import './LiveTennis.css';

// ---------- helpers ----------
function parseDateTime(d, t) {
  const ds = String(d || '').trim();
  const ts = String(t || '').trim();
  if (!ds) return null;
  const [dd, mm, yyyy] = ds.split('.').map(Number);
  let HH = 0, MM = 0;
  if (ts.includes(':')) {
    const [h, m] = ts.split(':').map(Number);
    HH = h || 0; MM = m || 0;
  }
  const dt = new Date(yyyy || 1970, (mm || 1) - 1, dd || 1, HH, MM, 0, 0);
  return Number.isFinite(dt.getTime()) ? dt : null;
}
const isUpcoming = s => String(s || '').toLowerCase() === 'not started';
const isFinishedLike = s => ['finished','cancelled','retired','abandoned','postponed','walk over']
  .includes(String(s || '').toLowerCase());
const num = v => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};
function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [num(a.s1), num(a.s2), num(a.s3), num(a.s4), num(a.s5)];
  const sB = [num(b.s1), num(b.s2), num(b.s3), num(b.s4), num(b.s5)];
  let k = 0; for (let i=0;i<5;i++) if (sA[i] !== null || sB[i] !== null) k = i+1;
  return k;
}
function labelClass(tag) {
  const t = String(tag || '').toUpperCase();
  if (t === 'SAFE') return 'badge safe';
  if (t === 'RISKY') return 'badge risky';
  if (t === 'AVOID') return 'badge avoid';
  return 'badge pending';
}
function statusDotClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'live' || s === 'in progress') return 'dot live';
  if (isUpcoming(s)) return 'dot upcoming';
  if (isFinishedLike(s)) return 'dot finished';
  return 'dot idle';
}
// ---------- /helpers ----------

export default function LiveTennis() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const matches = await fetchTennisLive();
      setRows(Array.isArray(matches) ? matches : []);
    } catch (e) {
      setErr(e.message || 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  // Normalization
  const normalized = useMemo(() => rows.map((m) => {
    const players = Array.isArray(m.players) ? m.players
      : Array.isArray(m.player) ? m.player : [];
    const p1 = players[0] || {}, p2 = players[1] || {};
    const name1 = p1.name || p1['@name'] || '';
    const name2 = p2.name || p2['@name'] || '';
    const date = m.date || m['@date'] || '';
    const time = m.time || m['@time'] || '';
    const dt = parseDateTime(date, time);
    const status = m.status || m['@status'] || '';
    const setNum = currentSetFromScores(players) || 0;
    const pr = m.prediction || {};
    let pickName = null;
    if (typeof pr.pick === 'number') pickName = pr.pick === 0 ? name1 : pr.pick === 1 ? name2 : null;
    else if (typeof pr.pick === 'string') pickName = pr.pick;
    return {
      id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
      date, time, dt, status, setNum,
      categoryName: m.categoryName || m['@category'] || m.category || '',
      name1, name2,
      prediction: {
        label: (pr.label || 'PENDING').toUpperCase(),
        pick: pickName,
        confidence: pr.confidence ?? 0,
        source: pr.source || 'fallback',
        detail: pr.detail || '',
      },
    };
  }), [rows]);

  // Filter + sort
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const keep = normalized.filter(m => {
      if (isFinishedLike(m.status)) return false;
      if (!term) return true;
      return (`${m.name1} ${m.name2} ${m.categoryName}`).toLowerCase().includes(term);
    });
    const priority = (lbl) => {
      const t = String(lbl || '').toUpperCase();
      if (t === 'SAFE') return 0;
      if (t === 'RISKY') return 1;
      if (t === 'AVOID') return 2;
      return 3; // PENDING/other
    };
    return [...keep].sort((a, b) => {
      const p = priority(a.prediction.label) - priority(b.prediction.label);
      if (p !== 0) return p;
      const s = (b.setNum || 0) - (a.setNum || 0);
      if (s !== 0) return s;
      const ta = a.dt ? a.dt.getTime() : Number.POSITIVE_INFINITY;
      const tb = b.dt ? b.dt.getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }, [normalized, q]);

  return (
    <div className="lt-root">
      <div className="lt-shell">
        <div className="lt-top">
          <h2 className="lt-title">Tennis — Live &amp; Upcoming (AI Predictions)</h2>
          <div className="lt-controls">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Αναζήτηση παίκτη ή διοργάνωσης…"
              className="lt-search"
            />
            {loading && <span className="lt-hint">Φόρτωση…</span>}
            {err && <span className="lt-err">HTTP 500</span>}
          </div>
        </div>

        <div className="lt-list">
          {list.length === 0 ? (
            <div className="lt-empty">Καμία εγγραφή.</div>
          ) : (
            list.map((m) => {
              const { label, pick, confidence } = m.prediction;
              return (
                <div key={m.id} className="card">
                  <div className="left">
                    <span className={statusDotClass(m.status)} />
                    <div className="logo">LB</div>
                    <div className="names">
                      <div className="players">
                        <strong>{m.name1}</strong>
                        <span className="vs"> vs </span>
                        <strong>{m.name2}</strong>
                      </div>
                      <div className="meta">
                        {m.date} {m.time} • {m.categoryName}
                      </div>
                    </div>
                  </div>

                  <div className="right">
                    <span className={labelClass(label)}>
                      {label === 'PENDING' ? 'STARTS SOON' : label}
                    </span>
                    {label !== 'PENDING' && (
                      <div className="pick">
                        Pick: <strong>{pick || '—'}</strong>
                        <span className="conf"> ({confidence ?? 0}% confidence)</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}