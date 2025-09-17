// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';

const FINISHED = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);
const isFinishedLike = (s) => FINISHED.has(String(s||'').toLowerCase());
const isUpcoming = (s) => String(s||'').toLowerCase() === 'not started';
const isLive = (s) => !!s && !isUpcoming(s) && !isFinishedLike(s);

const toNum = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players
          : Array.isArray(players?.player) ? players.player : players;
  const a = Array.isArray(p) ? (p[0] || {}) : {};
  const b = Array.isArray(p) ? (p[1] || {}) : {};
  const sA = [toNum(a.s1), toNum(a.s2), toNum(a.s3), toNum(a.s4), toNum(a.s5)];
  const sB = [toNum(b.s1), toNum(b.s2), toNum(b.s3), toNum(b.s4), toNum(b.s5)];
  let k = 0;
  for (let i=0;i<5;i++) if (sA[i] !== null || sB[i] !== null) k = i+1;
  return k || 0;
}

function parseDateTime(d, t) {
  const ds = String(d||'').trim();
  if (!ds) return null;
  const ts = String(t||'').trim();
  const [dd,mm,yyyy] = ds.split('.').map(Number);
  let HH=0, MM=0;
  if (ts.includes(':')) {
    const parts = ts.split(':').map(Number);
    HH = parts[0] || 0; MM = parts[1] || 0;
  }
  const dt = new Date(yyyy||1970, (mm||1)-1, dd||1, HH, MM, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// Badge colors strictly by AI label (fallback σε SET/SOON)
const BADGE = {
  SAFE:   { bg: '#1fdd73', fg: '#000000' },
  RISKY:  { bg: '#ff9900', fg: '#111'    },
  AVOID:  { bg: '#ff2e2e', fg: '#ffffff' },
  SET:    { bg: '#6d4c86', fg: '#ffffff' }, // purple
  SOON:   { bg: '#5f6b75', fg: '#eaeff4' }, // gray
};

export default function LiveTennis({ onLiveCount = () => {} }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true); setErr('');
    try {
      const matches = await fetchTennisLive();
      setRows(Array.isArray(matches) ? matches : []);
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

  const normalized = useMemo(() => {
    const now = new Date();
    return rows.map((m) => {
      const players = Array.isArray(m.players) ? m.players
                    : Array.isArray(m.player)  ? m.player  : [];
      const p1 = players[0] || {}, p2 = players[1] || {};
      const name1 = p1.name || p1['@name'] || '';
      const name2 = p2.name || p2['@name'] || '';

      const date = m.date || m['@date'] || '';
      const time = m.time || m['@time'] || '';
      const dt = parseDateTime(date, time);
      const status = m.status || m['@status'] || '';
      const live = isLive(status);

      const setNum = currentSetFromScores(players);

      // --- AI only from Set 3+ ---
      const ai = analyzeMatch(m, setNum); // {label|null, pick, reason, ev, ...}

      // Decide final label/text/color
      let label = ai?.label || null;
      let badgeText, badgeStyle;

      if (label === 'SAFE' || label === 'RISKY' || label === 'AVOID') {
        const { bg, fg } = BADGE[label];
        badgeText = label;
        badgeStyle = { background:bg, color:fg };
      } else if (setNum > 0) {
        const { bg, fg } = BADGE.SET;
        badgeText = `SET ${setNum}`;
        badgeStyle = { background:bg, color:fg };
      } else {
        const { bg, fg } = BADGE.SOON;
        let soon = 'STARTS SOON';
        if (dt && dt > now) {
          const mins = Math.max(0, Math.round((dt - now)/60000));
          if (mins <= 180) soon = `STARTS IN ${mins} MIN`;
        }
        badgeText = soon;
        badgeStyle = { background:bg, color:fg };
      }

      return {
        id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
        name1, name2,
        date, time, dt, status, live, setNum,
        categoryName: m.categoryName || m['@category'] || m.category || '',
        ai, label, badgeText, badgeStyle,
      };
    });
  }, [rows]);

  // Live count -> TopBar
  useEffect(() => {
    const liveCount = normalized.reduce((n, m) => n + (m.live ? 1 : 0), 0);
    onLiveCount(liveCount);
  }, [normalized, onLiveCount]);

  // φιλτράρισμα + ταξινόμηση
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const keep = normalized
      .filter((m) => !isFinishedLike(m.status))
      .filter((m) => {
        if (!term) return true;
        const blob = `${m.name1} ${m.name2} ${m.categoryName}`.toLowerCase();
        return blob.includes(term);
      });

    // weight: AI first, then set3>2>1, then upcoming
    const weight = (m) => {
      if (m.label === 'SAFE') return 0;
      if (m.label === 'RISKY') return 1;
      if (m.label === 'AVOID') return 2;
      if (m.setNum === 3) return 3;
      if (m.setNum === 2) return 4;
      if (m.setNum === 1) return 5;
      return 6; // SOON
    };

    return keep.sort((a, b) => {
      const wa = weight(a) - weight(b);
      if (wa !== 0) return wa;
      // Τie-break: live πρώτα, μετά μεγαλύτερο set, μετά κοντινότερη ώρα
      if (a.live !== b.live) return a.live ? -1 : 1;
      if ((b.setNum||0) !== (a.setNum||0)) return (b.setNum||0) - (a.setNum||0);
      const ta = a.dt ? a.dt.getTime() : Infinity;
      const tb = b.dt ? b.dt.getTime() : Infinity;
      return ta - tb;
    });
  }, [normalized, q]);

  return (
    <div style={{ padding: 16, minHeight: '100vh', background: '#0b0b0b', color: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* search + status */}
        <div style={{ display:'flex', gap:10, alignItems:'center', margin:'6px 0 12px 0' }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Αναζήτηση παίκτη ή διοργάνωσης…"
            style={{ padding:'10px 12px', minWidth:280, background:'#0f1113', color:'#fff', border:'1px solid #333', borderRadius:8, outline:'none' }}
          />
          {loading && <span style={{ color:'#cfd3d7' }}>Φόρτωση…</span>}
          {err && <span style={{ color:'#ff8a80' }}>{err}</span>}
        </div>

        {/* cards */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {list.map((m) => (
            <div key={m.id}
              style={{
                borderRadius: 16,
                background:'#151515',
                border:'1px solid #222',
                boxShadow:'0 6px 18px rgba(0,0,0,0.35)',
                padding:12,
                display:'flex', alignItems:'center', gap:12
              }}
            >
              {/* live dot */}
              <span aria-label={m.live ? 'live' : 'not-live'}
                style={{
                  width:12, height:12, borderRadius:999,
                  background: m.live ? '#1fdd73' : '#e53935',
                  boxShadow: m.live ? '0 0 10px rgba(31,221,115,.7)' : '0 0 6px rgba(229,57,53,.6)',
                  flex:'0 0 12px'
                }}
              />
              {/* names + meta */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:16, fontWeight:800, lineHeight:1.2 }}>
                  <span>{m.name1}</span>
                  <span style={{ color:'#96a5b4', fontWeight:600 }}> &nbsp;vs&nbsp; </span>
                  <span>{m.name2}</span>
                </div>
                <div style={{ marginTop:6, color:'#cfd3d7', fontSize:13 }}>
                  {m.date} {m.time} • {m.categoryName}
                </div>
                {(m.label === 'SAFE' || m.label === 'RISKY') && m.ai?.pick && (
                  <div style={{ marginTop:6, fontSize:13, fontWeight:700, color:'#1fdd73' }}>
                    TIP: {m.ai.pick} <span style={{ color:'#9fb5a7', fontWeight:600 }}>({m.ai.reason})</span>
                  </div>
                )}
              </div>
              {/* badge (AI label OR SET/SOON) */}
              <div style={{
                padding:'8px 12px',
                borderRadius:18,
                fontWeight:800,
                fontSize:12,
                letterSpacing:0.4,
                whiteSpace:'nowrap',
                ...m.badgeStyle
              }}>
                {m.badgeText}
              </div>
            </div>
          ))}

          {list.length === 0 && !loading && (
            <div style={{
              padding:14, borderRadius:12, background:'#151515',
              border:'1px solid #222', color:'#cfd3d7'
            }}>
              Δεν βρέθηκαν αγώνες.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}