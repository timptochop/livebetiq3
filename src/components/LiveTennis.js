// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';

// ----- helpers -----
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

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

// αν υπάρχουν σκορ, βρίσκουμε το τρέχον set
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

// νέο: εξαγωγή set από status ("Set 2", "SET3", "2nd set" κλπ)
function setFromStatus(status) {
  const s = String(status || '');
  let m = s.match(/set\s*([1-5])/i);
  if (m) return parseInt(m[1], 10);
  m = s.match(/([1-5])\s*(?:st|nd|rd|th)?\s*set/i);
  if (m) return parseInt(m[1], 10);
  m = s.match(/\bS\s*E?\s*T?\s*([1-5])\b/i); // καλύπτει "SET3"/"S3"
  if (m) return parseInt(m[1], 10);
  return null;
}

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

// ----- component -----
export default function LiveTennis({ onLiveCount = () => {} }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const matches = await fetchTennisLive();
      setRows(Array.isArray(matches) ? matches : []);
    } catch {
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

      // set από status > από σκορ > default
      const setByStatus = setFromStatus(status);
      const setByScores = currentSetFromScores(players) || null;
      const setNum = setByStatus || setByScores || (isUpcoming(status) ? 1 : 1);

      return {
        id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
        name1, name2,
        date, time, dt,
        status,
        setNum,
        categoryName: m.categoryName || m['@category'] || m.category || '',
        isLive: !isUpcoming(status) && !isFinishedLike(status),
      };
    });
  }, [rows]);

  const list = useMemo(() => {
    const keep = normalized.filter((m) => !isFinishedLike(m.status));
    return keep.sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;           // live πρώτα
      if (a.isLive) return (b.setNum || 0) - (a.setNum || 0);        // στα live: set desc
      const ta = a.dt ? a.dt.getTime() : Number.POSITIVE_INFINITY;   // μετά upcoming by time
      const tb = b.dt ? b.dt.getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }, [normalized]);

  useEffect(() => {
    onLiveCount(list.filter((x) => x.isLive).length);
  }, [list, onLiveCount]);

  // fonts μικρότερα
  const titleStyle = { fontSize: 16, fontWeight: 800, color: '#f2f6f9', lineHeight: 1.12 };
  const detailsStyle = { marginTop: 6, fontSize: 12, color: '#c7d1dc', lineHeight: 1.35 };

  // μικρότερο μοβ badge
  const setBadge = (m) => {
    const label = `SET ${m.setNum || 1}`;
    const bg = m.isLive ? '#6a3bd8' : '#5f4abf';
    return (
      <div
        style={{
          background: bg,
          color: '#fff',
          borderRadius: 16,
          padding: '6px 12px',
          fontWeight: 900,
          fontSize: 13,
          boxShadow: '0 8px 18px rgba(106,59,216,0.28)',
          minWidth: 64,
          textAlign: 'center',
        }}
      >
        {label}
      </div>
    );
  };

  const TOP_SPACER = 104; // ↑ μεγαλύτερο κενό να μη φαίνεται τίποτα από πίσω

  return (
    <div style={{ background: '#0a0c0e', minHeight: '100vh' }}>
      <div style={{ height: TOP_SPACER }} />
      {/* μικρό fade για να «χάνεται» οτιδήποτε ακουμπά το bar κατά το scroll */}
      <div style={{
        position: 'sticky', top: 96, height: 8, zIndex: 0,
        background: 'linear-gradient(#0a0c0e, rgba(10,12,14,0))'
      }}/>

      <div style={{ maxWidth: 1100, margin: '8px auto 40px', padding: '0 14px' }}>
        {list.map((m) => (
          <div
            key={m.id}
            style={{
              borderRadius: 18,
              background: '#121416',
              border: '1px solid #1d2126',
              boxShadow: '0 14px 28px rgba(0,0,0,0.45)',
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  title={m.isLive ? 'Live' : 'Upcoming'}
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: m.isLive ? '#1fdd73' : '#ff5d5d',
                    boxShadow: m.isLive ? '0 0 10px rgba(31,221,115,.8)' : '0 0 8px rgba(255,93,93,.6)',
                  }}
                />
                <div>
                  <div style={titleStyle}>
                    {m.name1} <span style={{ color: '#96a5b4', fontWeight: 600 }}>vs</span> {m.name2}
                  </div>
                  <div style={detailsStyle}>
                    {m.date} {m.time} • {m.categoryName}
                  </div>
                </div>
              </div>

              {setBadge(m)}
            </div>
          </div>
        ))}

        {list.length === 0 && !loading && (
          <div
            style={{
              marginTop: 12,
              padding: '14px 16px',
              borderRadius: 12,
              background: '#121416',
              border: '1px solid #22272c',
              color: '#c7d1dc',
              fontSize: 13,
            }}
          >
            Δεν βρέθηκαν αγώνες (live ή upcoming).
          </div>
        )}
      </div>
    </div>
  );
}