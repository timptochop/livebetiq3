// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';

const FINISHED = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);
const isFinishedLike = (s) => FINISHED.has(String(s||'').toLowerCase());
const isUpcoming     = (s) => String(s||'').toLowerCase() === 'not started';
const isLive         = (s) => !!s && !isUpcoming(s) && !isFinishedLike(s);

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
      const ai = analyzeMatch(m, setNum); // {label|null, pick, ...}

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

  useEffect(() => {
    const liveCount = normalized.reduce((n, m) => n + (m.live ? 1 : 0), 0);
    onLiveCount(liveCount);
  }, [normalized, onLiveCount]);

  // AI → set3 → set2 → set1 → soon (ίδια λογική, compact μόνο στο UI)
  const list = useMemo(() => {
    const keep = normalized.filter((m) => !isFinishedLike(m.status));
    const weight = (m) => {
      if (m.label === 'SAFE')  return 0;
      if (m.label === 'RISKY') return 1;
      if (m.label === 'AVOID') return 2;
      if (m.setNum === 3)      return 3;
      if (m.setNum === 2)      return 4;
      if (m.setNum === 1)      return 5;
      return 6;
    };
    return keep.sort((a, b) => {
      const wa = weight(a) - weight(b);
      if (wa !== 0) return wa;
      if (a.live !== b.live) return a.live ? -1 : 1;
      if ((b.setNum||0) !== (a.setNum||0)) return (b.setNum||0) - (a.setNum||0);
      const ta = a.dt ? a.dt.getTime() : Infinity;
      const tb = b.dt ? b.dt.getTime() : Infinity;
      return ta - tb;
    });
  }, [normalized]);

  const tipColor = (label) => (label === 'SAFE' ? '#19c96a' : label === 'RISKY' ? '#ff9900' : '#cfd3d7');

  return (
    <div style={{ padding: 12, minHeight: '100vh', background: '#0b0b0b', color: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {list.map((m) => (
            <div key={m.id}
              style={{
                borderRadius: 14,
                background:'#151515',
                border:'1px solid #222',
                boxShadow:'0 6px 16px rgba(0,0,0,0.32)',
                padding:10,
                display:'flex', alignItems:'center', gap:10
              }}
            >
              {/* live dot: πράσινο αν live, κόκκινο αν όχι */}
              <span
                aria-label={m.live ? 'live' : 'not-live'}
                style={{
                  width:10, height:10, borderRadius:999,
                  background: m.live ? '#19c96a' : '#e53935',
                  boxShadow: m.live ? '0 0 8px rgba(25,201,106,.7)' : '0 0 5px rgba(229,57,53,.6)',
                  flex:'0 0 10px'
                }}
              />
              {/* names + meta */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:800, lineHeight:1.2 }}>
                  <span>{m.name1}</span>
                  <span style={{ color:'#96a5b4', fontWeight:600 }}> &nbsp;vs&nbsp; </span>
                  <span>{m.name2}</span>
                </div>
                <div style={{ marginTop:4, color:'#cfd3d7', fontSize:12 }}>
                  {m.date} {m.time} • {m.categoryName}
                </div>

                {(m.label === 'SAFE' || m.label === 'RISKY') && m.ai?.pick && (
                  <div style={{ marginTop:4, fontSize:12, fontWeight:700, color: tipColor(m.label) }}>
                    TIP: {m.ai.pick}
                  </div>
                )}
              </div>

              {/* badge (AI label OR SET/SOON) */}
              <div style={{
                padding:'6px 10px',
                borderRadius:16,
                fontWeight:800,
                fontSize:11,
                letterSpacing:0.3,
                whiteSpace:'nowrap',
                ...m.badgeStyle
              }}>
                {m.badgeText}
              </div>
            </div>
          ))}

          {list.length === 0 && !loading && (
            <div style={{
              padding:12, borderRadius:10, background:'#151515',
              border:'1px solid #222', color:'#cfd3d7', fontSize:13
            }}>
              Δεν βρέθηκαν αγώνες.
            </div>
          )}
          {err && (
            <div style={{
              marginTop:8, padding:10, borderRadius:10,
              background:'#3a1b1b', border:'1px solid #5b2a2a', color:'#ffd7d7', fontSize:13
            }}>
              {err}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}