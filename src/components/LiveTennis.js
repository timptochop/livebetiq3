import React, { useEffect, useMemo, useState } from 'react';

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
  return (
    x === 'finished' ||
    x === 'cancelled' ||
    x === 'retired' ||
    x === 'abandoned' ||
    x === 'postponed' ||
    x === 'walk over'
  );
}

function labelColor(tag) {
  const t = String(tag || '').toUpperCase();
  if (t === 'SAFE') return { bg: '#2e7d32', fg: '#fff' };
  if (t === 'RISKY') return { bg: '#ffb300', fg: '#000' };
  if (t === 'AVOID') return { bg: '#c62828', fg: '#fff' };
  return { bg: '#546e7a', fg: '#fff' };
}

function statusPill(status) {
  const s = String(status || '');
  let bg = '#2962ff';
  if (isUpcoming(s)) bg = '#2e7d32';
  if (isFinishedLike(s)) bg = '#8e24aa';
  return (
    <span
      style={{
        background: bg,
        color: '#fff',
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 12,
        display: 'inline-block',
        lineHeight: 1,
      }}
    >
      {s}
    </span>
  );
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
      const res = await fetch('/api/gs/tennis-predictions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const matches = Array.isArray(data?.matches) ? data.matches : [];
      setRows(matches);
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
    <div style={{ padding: 16, background: '#0b0b0b', color: '#fff', minHeight: '100vh' }}>
      <div
        style={{
          margin: '16px auto',
          maxWidth: 1100,
          background: '#151515',
          borderRadius: 10,
          boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
          border: '1px solid #222',
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #222', color: '#fff' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>Tennis — Live & Upcoming (AI Predictions)</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Αναζήτηση παίκτη ή διοργάνωσης…"
              style={{
                padding: '10px 12px',
                minWidth: 280,
                background: '#0f1113',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: 8,
                outline: 'none',
              }}
            />
            {loading && <span style={{ color: '#cfd3d7' }}>Φόρτωση…</span>}
            {err && <span style={{ color: '#ff8a80' }}>{err}</span>}
          </div>
        </div>

        <div style={{ padding: '6px 10px 16px 10px', color: '#fff' }}>
          {filteredSorted.length === 0 ? (
            <div style={{ color: '#cfd3d7', padding: 16 }}>Καμία εγγραφή.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #222' }}>
                  <th style={{ padding: '12px 10px', color: '#cfd3d7' }}>Ώρα</th>
                  <th style={{ padding: '12px 10px', color: '#cfd3d7' }}>Αγώνας</th>
                  <th style={{ padding: '12px 10px', color: '#cfd3d7' }}>Κατηγορία</th>
                  <th style={{ padding: '12px 10px', color: '#cfd3d7' }}>AI Prediction</th>
                  <th style={{ padding: '12px 10px', color: '#cfd3d7' }}>Κατάσταση</th>
                </tr>
              </thead>
              <tbody>
                {filteredSorted.map((m) => {
                  const { label, pick, confidence, source } = m.prediction;
                  const { bg, fg } = labelColor(label);
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #1f1f1f' }}>
                      <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                        {m.date} {m.time}
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: 600, color: '#fff' }}>
                        {m.name1} <span style={{ color: '#9aa0a6', fontWeight: 400 }}>vs</span> {m.name2}
                      </td>
                      <td style={{ padding: '12px 10px' }}>{m.categoryName}</td>
                      <td style={{ padding: '12px 10px', minWidth: 320 }}>
                        <div style={{ fontSize: 12, color: '#cfd3d7', marginBottom: 6 }}>
                          source: {source} • set {m.setNum > 0 ? m.setNum : '—'}
                          <span
                            style={{
                              background: bg,
                              color: fg,
                              borderRadius: 8,
                              padding: '2px 8px',
                              fontSize: 11,
                              marginLeft: 8,
                            }}
                          >
                            {label}
                          </span>
                        </div>
                        {label === 'PENDING' ? (
                          <div style={{ fontSize: 13, color: '#ffa726' }}>Pending…</div>
                        ) : (
                          <div style={{ fontSize: 13 }}>
                            Pick: <strong>{pick || '—'}</strong>{' '}
                            <span style={{ color: '#9aa0a6' }}>({confidence ?? 0}% confidence)</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px' }}>{statusPill(m.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}