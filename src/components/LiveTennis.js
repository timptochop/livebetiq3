// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';

// ------ helpers ------
const parseDateTime = (d, t) => {
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
};
const isUpcoming = (s) => String(s || '').toLowerCase() === 'not started';
const isFinishedLike = (s) => {
  const x = String(s || '').toLowerCase();
  return (
    x === 'finished' ||
    x === 'cancelled' ||
    x === 'retired' ||
    x === 'abandoned' ||
    x === 'postponed' ||
    x === 'walk over'
  );
};
const n = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};
const currentSetFromScores = (players) => {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {};
  const b = p[1] || {};
  const sA = [n(a.s1), n(a.s2), n(a.s3), n(a.s4), n(a.s5)];
  const sB = [n(b.s1), n(b.s2), n(b.s3), n(b.s4), n(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k;
};
const labelColor = (tag) => {
  const t = String(tag || '').toUpperCase();
  if (t === 'SAFE') return { bg: '#2e7d32', fg: '#fff' };
  if (t === 'RISKY') return { bg: '#ffb300', fg: '#000' };
  if (t === 'AVOID') return { bg: '#c62828', fg: '#fff' };
  if (t === 'PENDING') return { bg: '#546e7a', fg: '#fff' };
  return { bg: '#546e7a', fg: '#fff' };
};
// ---------------------

export default function LiveTennis({ onLiveCount = () => {} }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      // Δέχεται είτε array είτε {matches:[...]}
      const resp = await fetchTennisLive();
      const data = Array.isArray(resp) ? resp : resp?.matches || [];
      setRows(Array.isArray(data) ? data : []);
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

  const normalized = useMemo(
    () =>
      rows.map((m) => {
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
        if (typeof pr.pick === 'number') pickName = pr.pick === 0 ? name1 : pr.pick === 1 ? name2 : null;
        else if (typeof pr.pick === 'string') pickName = pr.pick;

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
      }),
    [rows]
  );

  // ταξινόμηση: live+AI -> live pending -> upcoming, κρύψε finished
  const filteredSorted = useMemo(() => {
    const keep = normalized.filter((m) => !isFinishedLike(m.status));
    const rank = (m) => {
      const live = !isUpcoming(m.status);
      const hasAI = m.prediction?.label && m.prediction.label !== 'PENDING';
      if (live && hasAI) return 0;
      if (live && !hasAI) return 1;
      return 2;
    };
    const prio = (lbl) => {
      const t = String(lbl || '').toUpperCase();
      if (t === 'SAFE') return 0;
      if (t === 'RISKY') return 1;
      if (t === 'AVOID') return 2;
      return 3;
    };
    return [...keep].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      const p = prio(a.prediction.label) - prio(b.prediction.label);
      if (p !== 0) return p;
      const s = (b.setNum || 0) - (a.setNum || 0);
      if (s !== 0) return s;
      const ta = a.dt ? a.dt.getTime() : Number.POSITIVE_INFINITY;
      const tb = b.dt ? b.dt.getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }, [normalized]);

  // ενημέρωση μετρητή στο top bar
  useEffect(() => {
    const live = filteredSorted.filter((m) => !isUpcoming(m.status)).length;
    onLiveCount(live);
  }, [filteredSorted, onLiveCount]);

  const Card = ({ m }) => {
    const { label, pick, confidence, source } = m.prediction;
    const { bg, fg } = labelColor(label);
    const live = !isUpcoming(m.status);
    const rightBadge = live ? (
      <div
        style={{
          background: '#6f42c1',
          color: '#fff',
          borderRadius: 14,
          padding: '6px 10px',
          fontWeight: 700,
          fontSize: 12,
          minWidth: 64,
          textAlign: 'center',
        }}
      >
        {`SET ${m.setNum || 1}`}
      </div>
    ) : (
      <div
        style={{
          background: '#525b63',
          color: '#e6edf3',
          borderRadius: 14,
          padding: '6px 10px',
          fontWeight: 700,
          fontSize: 12,
          minWidth: 92,
          textAlign: 'center',
        }}
      >
        STARTS SOON
      </div>
    );

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          background: '#17191b',
          border: '1px solid #222',
          borderRadius: 14,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: live ? '#2ee66b' : '#ff5757',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>
            {m.name1} <span style={{ color: '#9aa0a6', fontWeight: 400 }}>vs</span> {m.name2}
          </div>
          <div style={{ color: '#c9d1d9', fontSize: 12, marginTop: 4 }}>
            {m.date} {m.time} • {m.categoryName}
          </div>

          {label !== 'PENDING' && (
            <div style={{ marginTop: 8, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span
                style={{
                  background: bg,
                  color: fg,
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontWeight: 900,
                  letterSpacing: 0.5,
                  fontSize: 12,
                }}
              >
                {label}
              </span>
              <span style={{ color: '#9aa0a6', fontSize: 12 }}>
                Pick: <strong style={{ color: '#fff' }}>{pick || '—'}</strong> • {confidence ?? 0}%
              </span>
              <span style={{ color: '#667' }}>|</span>
              <span style={{ color: '#8fa3ad', fontSize: 11 }}>src: {source}</span>
            </div>
          )}
        </div>
        {rightBadge}
      </div>
    );
  };

  return (
    <div style={{ padding: 12 }}>
      {err && (
        <div
          style={{
            marginBottom: 12,
            color: '#ff8a80',
            background: '#2a1111',
            border: '1px solid #4a1a1a',
            padding: 10,
            borderRadius: 8,
          }}
        >
          {err}
        </div>
      )}

      {loading && <div style={{ color: '#cfd3d7', padding: 12 }}>Φόρτωση…</div>}

      <div style={{ display: 'grid', gap: 12 }}>
        {filteredSorted.map((m) => (
          <Card key={m.id} m={m} />
        ))}
      </div>

      {/* Μικρό empty state για να μη φαίνεται «μαύρη τρύπα» */}
      {!loading && filteredSorted.length === 0 && (
        <div
          style={{
            marginTop: 16,
            color: '#cfd3d7',
            background: '#141618',
            border: '1px solid #222',
            padding: 12,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Δεν βρέθηκαν αγώνες (live ή upcoming).</span>
          <button
            onClick={load}
            style={{
              background: '#00cc66',
              color: '#001d0e',
              border: 'none',
              padding: '8px 12px',
              borderRadius: 8,
              fontWeight: 800,
            }}
          >
            Ανανέωση
          </button>
        </div>
      )}
    </div>
  );
}