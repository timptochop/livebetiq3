import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';

// -------- helpers --------
const FINISHED_SET = new Set([
  'finished','cancelled','retired','abandoned','postponed','walk over','walkover'
]);
const isFinishedLike = (s) => FINISHED_SET.has(String(s||'').toLowerCase());
const isNotStarted  = (s) => String(s||'').toLowerCase() === 'not started';

// μετατρέπει σε int, μη αριθμητικά -> 0
const toInt = (v) => {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(n) ? n : 0;
};

// Επιστρέφει τα games ανά σετ και αν έχει ξεκινήσει έστω 1 game
function extractScore(players) {
  const p = Array.isArray(players) ? players
          : Array.isArray(players?.player) ? players.player : [];
  const A = p[0] || {}, B = p[1] || {};
  const a = [toInt(A.s1), toInt(A.s2), toInt(A.s3), toInt(A.s4), toInt(A.s5)];
  const b = [toInt(B.s1), toInt(B.s2), toInt(B.s3), toInt(B.s4), toInt(B.s5)];
  const totals = a.map((v,i) => v + b[i]);
  const anyGame = totals.some(t => t > 0);
  let currentSet = 0;
  for (let i=0;i<totals.length;i++) if (totals[i] > 0) currentSet = i+1; // μετράμε μόνο σετ με παιχνίδι (>0)
  return { a, b, totals, anyGame, currentSet };
}

const parseDateTime = (d, t) => {
  const ds = String(d || '').trim();
  const ts = String(t || '').trim();
  if (!ds) return null;
  const [dd, mm, yyyy] = ds.split('.').map(Number);
  const [HH=0, MM=0] = ts.includes(':') ? ts.split(':').map(Number) : [0,0];
  const dt = new Date(yyyy || 1970, (mm||1)-1, dd||1, HH, MM, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

// μόνο για “ρητό” live από status
const liveFromStatus = (s) => {
  const x = String(s||'').toLowerCase();
  if (isNotStarted(x) || isFinishedLike(x)) return false;
  return /(?:^|\s)(in\s?progress|live|1st|2nd|3rd|set\s?\d|tiebreak|tb)(?:\s|$)/.test(x);
};

const AI_LABELS = new Set(['SAFE','RISKY','AVOID']);

// -------- component --------
export default function LiveTennis({ onLiveCount = () => {} }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
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
    const dt   = parseDateTime(date, time);
    const status = m.status || m['@status'] || '';

    const { anyGame, currentSet } = extractScore(players);

    // LIVE μόνο αν έχει παιχτεί τουλάχιστον 1 game ή status δηλώνει live,
    // και φυσικά ΔΕΝ είναι Not Started / Finished
    const live = !isFinishedLike(status) && (anyGame || liveFromStatus(status)) && !isNotStarted(status);

    // AI label μόνο για live από Set >= 3
    const label = String(m?.prediction?.label || '').toUpperCase();
    const showAI = live && currentSet >= 3 && AI_LABELS.has(label);

    // Τι γράφει το badge
    let badgeText = '';
    if (showAI) {
      badgeText = label; // SAFE/RISKY/AVOID
    } else if (live) {
      badgeText = `SET ${currentSet || 1}`;
    } else {
      if (dt && dt.getTime() > Date.now()) {
        const mins = Math.max(1, Math.round((dt.getTime() - Date.now())/60000));
        badgeText = `STARTS IN ${mins} MIN`;
      } else {
        badgeText = 'STARTS SOON';
      }
    }

    return {
      id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
      name1, name2, date, time, dt,
      status, categoryName: m.categoryName || m['@category'] || m.category || '',
      setNum: currentSet,
      live, label, showAI, badgeText
    };
  }), [rows]);

  // ενημέρωση TopBar counter
  useEffect(() => {
    onLiveCount(normalized.reduce((n, x) => n + (x.live ? 1 : 0), 0));
  }, [normalized, onLiveCount]);

  // Ταξινόμηση: live με AI -> live set3 -> set2 -> set1 -> upcoming by time
  const liveBucket = (m) => {
    if (!m.live) return 99;
    if (m.showAI) return 0;
    if (m.setNum >= 3) return 1;
    if (m.setNum === 2) return 2;
    return 3;
  };

  const list = useMemo(() => {
    const keep = normalized.filter((m) => !isFinishedLike(m.status));
    return keep.sort((a,b) => {
      const wa = liveBucket(a), wb = liveBucket(b);
      if (wa !== wb) return wa - wb;
      const ta = a.dt ? a.dt.getTime() : Infinity;
      const tb = b.dt ? b.dt.getTime() : Infinity;
      return ta - tb;
    });
  }, [normalized]);

  const badgeStyle = (m) => {
    if (m.showAI && m.label === 'SAFE')  return { bg:'#20b954', fg:'#fff' };
    if (m.showAI && m.label === 'RISKY') return { bg:'#ffbf0a', fg:'#151515' };
    if (m.showAI && m.label === 'AVOID') return { bg:'#e53935', fg:'#fff' };
    if (m.live)                           return { bg:'#6e42c1', fg:'#fff' }; // SET X
    return { bg:'#7a6fde', fg:'#fff' };                                   // STARTS...
  };

  return (
    <div style={{ background:'#0b0b0b', minHeight:'100vh' }}>
      <div style={{ maxWidth:1100, margin:'12px auto 40px', padding:'0 14px' }}>
        {err && (
          <div style={{ background:'#3a1b1b', border:'1px solid #5b2a2a', color:'#ffd7d7',
                        borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
            {err}
          </div>
        )}

        {list.map((m) => {
          const { bg, fg } = badgeStyle(m);
          return (
            <div key={m.id} style={{
              borderRadius:18, background:'#151718', border:'1px solid #202428',
              boxShadow:'0 14px 28px rgba(0,0,0,0.45)', padding:16, marginBottom:12
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
                  {/* dot: πράσινο = live, κόκκινο = όχι live */}
                  <span aria-hidden style={{
                    width:12, height:12, borderRadius:999,
                    background: m.live ? '#1fdd73' : '#e53935',
                    boxShadow: m.live ? '0 0 10px rgba(31,221,115,.8)' : '0 0 8px rgba(229,57,53,.6)'
                  }}/>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:16, fontWeight:800, color:'#f2f6f9',
                                  lineHeight:1.12, overflow:'hidden', textOverflow:'ellipsis' }}>
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
                  minWidth: (m.badgeText||'').startsWith('STARTS') ? 140 : 84,
                  textAlign:'center', background:bg, color:fg
                }}>
                  {m.badgeText}
                </span>
              </div>
            </div>
          );
        })}

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