import React, { useEffect, useMemo, useState } from 'react';
import { fetchTennisPredictions } from '../utils/fetchTennisLive';
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

function isUpcoming(s) {
  return String(s || '').toLowerCase() === 'not started';
}
function isFinishedLike(s) {
  const x = String(s || '').toLowerCase();
  return x === 'finished' || x === 'cancelled' || x === 'retired' || x === 'abandoned' || x === 'postponed' || x === 'walk over';
}

function labelToClass(tag) {
  const t = String(tag || '').toUpperCase();
  if (t === 'SAFE') return 'safe';
  if (t === 'RISKY') return 'risky';
  if (t === 'AVOID') return 'avoid';
  return 'pending';
}

function StatusPill({ status }) {
  const s = String(status || '');
  let cls = '';
  if (isUpcoming(s)) cls = 'upcoming';
  if (isFinishedLike(s)) cls = 'finished';
  return <span className={`lt-pill ${cls}`}>{s}</span>;
}

function num(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
}

function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {};
  const b = p[1] || {};
  const sA = [num(a.s1), num(a.s2), num(a.s3), num(a.s4), num(a.s5)];
  const sB = [num(b.s1), num(b.s2), num(b.s3), num(b.s4), num(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) {
    if (sA[i] !== null || sB[i] !== null) k = i + 1;
  }
  return k;
}

export default function LiveTennis() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const matches = await fetchTennisPredictions();
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

  const normalized = useMemo(() => {
    return rows.map((m) => {
      const players =
        Array.isArray(m.players) ? m.players : Array.isArray(m.player) ? m.player : [];
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
      let pickName = null;
      if (typeof pr.pick === 'number') {
        pickName = pr.pick === 0 ? name1 : pr.pick === 1 ? name2 : null;
      } else if (typeof pr.pick === 'string') {
        pickName = pr.pick;
      }
      return {
        id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
        date,
        time,
        dt,
        status,
        setNum,
        categoryName: m.categoryName || m['@category'] || m.category || '',
        name1,
        name2,
        prediction: {
          label: (pr.label || 'PENDING').toUpperCase(),
          pick: pickName,
          confidence: pr.confidence ?? 0,
          source: pr.source || 'fallback',
          detail: pr.detail || '',
        },
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

    const priority = (lbl) => {
      const t = String(lbl || '').toUpperCase();
      if (t === 'SAFE') return 0;
      if (t === 'RISKY') return 1;
      if (t === 'AVOID') return 2;
      return 3;
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
    <div className="lt-wrap">
      <div className="lt-card">
        <div className="lt-head">
          <h2 className="lt-title">Tennis — Live & Upcoming (AI Predictions)</h2>
          <div className="lt-search">
            <input
              className="lt-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Αναζήτηση παίκτη ή διοργάνωσης…"
            />
            {loading && <span className="lt-status">Φόρτωση…</span>}
            {err && <span className="lt-status" style={{ color: '#ff8a80' }}>{err}</span>}
          </div>
        </div>

        <div className="lt-body">

          <div className="lt-table-wrap">
            {filteredSorted.length === 0 ? (
              <div className="lt-empty">Καμία εγγραφή.</div>
            ) : (
              <table className="lt-table">
                <thead>
                  <tr>
                    <th className="lt-th">Ώρα</th>
                    <th className="lt-th">Αγώνας</th>
                    <th className="lt-th">Κατηγορία</th>
                    <th className="lt-th">AI Prediction</th>
                    <th className="lt-th">Κατάσταση</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map((m) => {
                    const { label, pick, confidence, source } = m.prediction;
                    const cls = labelToClass(label);
                    return (
                      <tr key={m.id}>
                        <td className="lt-td" style={{ whiteSpace: 'nowrap' }}>
                          {m.date} {m.time}
                        </td>
                        <td className="lt-td">
                          <span className="lt-row-title">{m.name1}</span>
                          <span className="lt-vs">vs</span>
                          <span className="lt-row-title">{m.name2}</span>
                        </td>
                        <td className="lt-td">{m.categoryName}</td>
                        <td className="lt-td" style={{ minWidth: 320 }}>
                          <div className="lt-sub">
                            source: {source} • set {m.setNum > 0 ? m.setNum : '—'}
                            <span className={`lt-badge ${cls}`}>{label}</span>
                          </div>
                          {label === 'PENDING' ? (
                            <div className="lt-pending">Pending…</div>
                          ) : (
                            <div style={{ fontSize: 13 }}>
                              Pick: <strong>{pick || '—'}</strong>{' '}
                              <span style={{ color: '#9aa0a6' }}>({confidence ?? 0}% confidence)</span>
                            </div>
                          )}
                        </td>
                        <td className="lt-td"><StatusPill status={m.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="lt-cards">
            {filteredSorted.length === 0 ? (
              <div className="lt-empty">Καμία εγγραφή.</div>
            ) : (
              filteredSorted.map((m) => {
                const { label, pick, confidence, source } = m.prediction;
                const cls = labelToClass(label);
                return (
                  <div className="lt-mcard" key={`m-${m.id}`}>
                    <div className="lt-mcol">
                      <div className="lt-mtop">
                        <div className="lt-mtime">{m.date} {m.time}</div>
                        <div className="lt-mstatus"><StatusPill status={m.status} /></div>
                      </div>
                      <div className="lt-mtitle">
                        {m.name1} <span className="lt-vs">vs</span> {m.name2}
                      </div>
                      <div className="lt-mcat">{m.categoryName}</div>
                      <div className="lt-mmeta">
                        <span>source: {source}</span>
                        <span>•</span>
                        <span>set {m.setNum > 0 ? m.setNum : '—'}</span>
                        <span className={`lt-badge ${cls}`}>{label}</span>
                      </div>
                      {label === 'PENDING' ? (
                        <div className="lt-pending">Pending…</div>
                      ) : (
                        <div className="lt-mpred">
                          Pick: <strong>{pick || '—'}</strong>{' '}
                          <span style={{ color: '#9aa0a6' }}>({confidence ?? 0}% confidence)</span>
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
    </div>
  );
}