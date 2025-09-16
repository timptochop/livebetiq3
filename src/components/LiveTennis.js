// LiveTennis.js — v0.97.7 set-priority & ai-after-set3
import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';

/* ---------------- helpers ---------------- */
const FINISHED_SET = new Set([
  'finished','cancelled','retired','abandoned','postponed','walk over','walkover',
]);
const isFinishedLike = (s) => FINISHED_SET.has(String(s||'').toLowerCase());
const isNotStarted = (s) => String(s||'').toLowerCase() === 'not started';

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

const currentSetFromScores = (players) => {
  const p = Array.isArray(players) ? players
          : Array.isArray(players?.player) ? players.player : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [num(a.s1), num(a.s2), num(a.s3), num(a.s4), num(a.s5)];
  const sB = [num(b.s1), num(b.s2), num(b.s3), num(b.s4), num(b.s5)];
  let k = 0;
  for (let i=0;i<5;i++) if (sA[i] !== null || sB[i] !== null) k = i+1;
  return k || 0;
};

const parseDateTime = (d, t) => {
  const ds = String(d || '').trim();
  const ts = String(t || '').trim();
  if (!ds) return null;
  const [dd, mm, yyyy] = ds.split('.').map(Number);
  const [HH=0, MM=0] = ts.includes(':') ? ts.split(':').map(Number) : [0,0];
  const dt = new Date(yyyy || 1970, (mm||1)-1, dd||1, HH, MM, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const looksLiveFromStatus = (s) => {
  const x = String(s||'').toLowerCase();
  return /set|game|in\s?progress|1st|2nd|3rd/.test(x);
};

const predictionChip = (label) => {
  const t = String(label||'').toUpperCase();
  if (t === 'SAFE')   return { bg:'#20b954', fg:'#fff', text:'SAFE' };
  if (t === 'RISKY')  return { bg:'#ffbf0a', fg:'#151515', text:'RISKY' };
  if (t === 'AVOID')  return { bg:'#e53935', fg:'#fff', text:'AVOID' };
  return null;
};

/* ---------------- component ---------------- */
export default function LiveTennis({ onLiveCount = () => {} }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const matches = await fetchTennisLive();
      setRows(Array.isArray(matches) ? matches : []);
    } catch (e) {
      console.error('[LiveTennis] fetch error:', e);
      setErr(e?.message || 'Load failed');
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

  const normalized = useMemo(() => rows.map((m) => {
    const players = Array.isArray(m.players) ? m.players
                    : Array.isArray(m.player)  ? m.player  : [];
    const p1 = players[0] || {}, p2 = players[1] || {};
    const name1 = p1.name || p1['@name'] || '';
    const name2 = p2.name || p2['@name'] || '';
    const date = m.date || m['@date'] || '';
    const time = m.time || m['@time'] || '';
    const dt = parseDateTime(date, time);
    const status = m.status || m['@status'] || '';
    const setNum = currentSetFromScores(players);

    const live = (setNum > 0) || looksLiveFromStatus(status);

    const pr = m.prediction || {};
    const prChip = predictionChip(pr.label);

    // δείχνουμε AI μόνο στο Set 3 (και μόνο αν είναι live)
    const showAI = !!(live && setNum >= 3 && prChip);

    let badgeText = '';
    let badgeBG = '#6e42c1', badgeFG = '#fff';

    if (showAI) {
      badgeText = prChip.text; badgeBG = prChip.bg; badgeFG = prChip.fg;
    } else if (live) {
      badgeText = `SET ${setNum || 1}`;
      badgeBG = '#6e42c1'; badgeFG = '#fff';
    } else {
      if (dt && dt.getTime() > Date.now()) {
        const mins = Math.max(1, Math.round((dt.getTime() - Date.now())/60000));
        badgeText = `STARTS IN ${mins} MIN`;
      } else {
        badgeText = 'STARTS SOON';
      }
      badgeBG = '#7a6fde'; badgeFG = '#fff';
    }

    return {
      id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
      name1, name2, date, time, dt, status,
      categoryName: m.categoryName || m['@category'] || m.category || '',
      setNum, live,
      badgeText, badgeBG, badgeFG,
    };
  }), [rows]);

  // ενημέρωση top bar με live count
  useEffect(() => {
    const n = normalized.reduce((acc, m) => acc + (m.live ? 1 : 0), 0);
    onLiveCount(n);
  }, [normalized, onLiveCount]);

  // προτεραιότητα set: 3 -> 2 -> 1
  const setPriority = (s) => (s >= 3 ? 0 : s === 2 ? 1 : s === 1 ? 2 : 3);

  const list = useMemo(() => {
    return [...normalized].sort((a,b) => {
      if (a.live !== b.live) return a.live ? -1 : 1;           // live πρώτα
      if (a.live && b.live) {
        const pa = setPriority(a.setNum), pb = setPriority(b.setNum);
        if (pa !== pb) return pa - pb;                          // Set3 > Set2 > Set1
      }
      const ta = a.dt ? a.dt.getTime() : Infinity;             // μετά κοντινότερη ώρα
      const tb = b.dt ? b.dt.getTime() : Infinity;
      return ta - tb;
    });
  }, [normalized]);

  return (
    <div style={{ background:'#0b0b0b', minHeight:'100vh' }}>
      <div style={{ maxWidth:1100, margin:'12px auto 40px', padding:'0 14px' }}>
        {err && (
          <div style={{
            background:'#3a1b1b', border:'1px solid #5b2a2a', color:'#ffd7d7',
            borderRadius:10, padding:'10px 12px', marginBottom:12
          }}>{err}</div>
        )}

        {list.map((m) => (
          <div key={m.id} style={{
            borderRadius:18, background:'#151718', border:'1px solid #202428',
            boxShadow:'0 14px 28px rgba(0,0,0,0.45)', padding:16, marginBottom:12
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
                <span aria-hidden style={{
                  width:12, height:12, borderRadius:999,
                  background: m.live ? '#1fdd73' : '#e53935',
                  boxShadow: m.live
                    ? '0 0 10px rgba(31,221,115,.8)'
                    : '0 0 8px rgba(229,57,53,.6)'
                }}/>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:'#f2f6f9', lineHeight:1.12, overflow:'hidden', textOverflow:'ellipsis' }}>
                    {m.name1} <span style={{ color:'#96a5b4', fontWeight:600 }}>vs</span> {m.name2}
                  </div>
                  <div style={{ marginTop:6, fontSize:12, color:'#c7d1dc' }}>
                    {m.date} {m.time} • {m.categoryName}
                  </div>
                </div>
              </div>

              <span style={{
                padding:'10px 14px', borderRadius:14, fontWeight:800, letterSpacing:.5,
                boxShadow:'0 6px 18px rgba(0,0,0,0.25)', display:'inline-block',
                minWidth:(m.badgeText||'').startsWith('STARTS') ? 140 : 84, textAlign:'center',
                background:m.badgeBG, color:m.badgeFG
              }}>
                {m.badgeText}
              </span>
            </div>
          </div>
        ))}

        {!loading && list.length === 0 && (
          <div style={{
            marginTop:12, padding:'14px 16px', borderRadius:12,
            background:'#121416', border:'1px solid #22272c', color:'#c7d1dc', fontSize:13
          }}>
            Δεν βρέθηκαν αγώνες (live ή upcoming).
          </div>
        )}
      </div>
    </div>
  );
}