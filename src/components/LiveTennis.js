// src/components/LiveTennis.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';

/* ----------------- helpers ----------------- */
const FINISHED_SET = new Set([
  'finished','cancelled','retired','abandoned','postponed','walk over','walkover',
  'wo','suspended','interrupted'
]);
const UPCOMING_SET = new Set(['not started','scheduled','ns','prematch']);

const LIVE_KEYWORDS = [
  'in progress','live','playing','ongoing',
  '1st set','2nd set','3rd set','4th set','5th set',
  'set 1','set 2','set 3','set 4','set 5'
];

const isFinishedLike = (s) => FINISHED_SET.has(String(s||'').toLowerCase());
const isUpcomingLike = (s) => UPCOMING_SET.has(String(s||'').toLowerCase());

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

const anyScoreEntered = (players) => {
  const p = Array.isArray(players) ? players : [];
  for (const side of [p[0]||{}, p[1]||{}]) {
    if ([side.s1,side.s2,side.s3,side.s4,side.s5].some(v => num(v) !== null)) return true;
    if (side.game_score && String(side.game_score).trim() !== '') return true;
    if (String(side.serve||'').toLowerCase() === 'true') return true;
  }
  return false;
};

const setFromStatus = (status) => {
  const s = String(status||'').toLowerCase();
  const m = s.match(/(?:^|\s)([1-5])(?:st|nd|rd|th)?\s*set|set\s*([1-5])/i);
  if (!m) return null;
  return parseInt(m[1] || m[2], 10);
};

const currentSetFromScores = (players) => {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [num(a.s1), num(a.s2), num(a.s3), num(a.s4), num(a.s5)];
  const sB = [num(b.s1), num(b.s2), num(b.s3), num(b.s4), num(b.s5)];
  let k = 0;
  for (let i=0;i<5;i++) if (sA[i] !== null || sB[i] !== null) k = i+1;
  return k || null;
};

const parseDateTime = (d, t) => {
  const ds = String(d||'').trim(); if (!ds) return null;
  const ts = String(t||'').trim();
  const [dd,mm,yyyy] = ds.split('.').map(Number);
  const [HH=0,MM=0] = ts.includes(':') ? ts.split(':').map(Number) : [0,0];
  const dt = new Date(yyyy||1970,(mm||1)-1,dd||1,HH,MM,0,0);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

/* “Σφιχτός” ορισμός LIVE */
const isLiveStrict = (status, players, dt) => {
  if (isFinishedLike(status)) return false;
  const s = String(status||'').toLowerCase();
  const kw = LIVE_KEYWORDS.some(k => s.includes(k));
  if (kw) return true;
  if (anyScoreEntered(players)) return true;
  if (!isUpcomingLike(status) && dt && dt.getTime() <= Date.now() + 2*60*1000) return true;
  return false;
};

/* ----------------- component ----------------- */
export default function LiveTennis({ onLiveCount = () => {} }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const notifiedRef = useRef(new Set());

  const playNotification = () => {
    const audio = new Audio('/notify.mp3');
    audio.play().catch(() => {});
  };

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

  const normalized = useMemo(() => rows.map((m) => {
    const players = Array.isArray(m.players) ? m.players
                  : (Array.isArray(m.player) ? m.player : []);
    const p1 = players[0] || {}, p2 = players[1] || {};
    const name1 = p1.name || p1['@name'] || '';
    const name2 = p2.name || p2['@name'] || '';
    const date = m.date || m['@date'] || '';
    const time = m.time || m['@time'] || '';
    const dt   = parseDateTime(date, time);
    const status = m.status || m['@status'] || '';
    const setByStatus = setFromStatus(status);
    const setByScores = currentSetFromScores(players);
    const setNum = setByStatus || setByScores;
    const live = isLiveStrict(status, players, dt);

    // AI eligibility: από 3ο σετ και μετά, και να “τρέχει” ο αγώνας
    const aiEligible = live && (setNum || 0) >= 3;

    let label = null, pick = null, reason = '';
    if (aiEligible) {
      const ai = analyzeMatch(m) || {};
      label = ai.label || null;         // SAFE / RISKY / AVOID
      pick  = ai.pick  || null;         // string
      reason = ai.reason || '';
    }

    return {
      id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
      name1, name2, date, time, dt, status,
      categoryName: m.categoryName || m['@category'] || m.category || '',
      players, live, setNum, label, pick, reason
    };
  }), [rows]);

  // ενημέρωση live counter (TopBar)
  useEffect(() => {
    const liveCount = normalized.reduce((acc, m) => acc + (m.live ? 1 : 0), 0);
    onLiveCount(liveCount);
  }, [normalized, onLiveCount]);

  // ταξινόμηση: (1) AI-labeled SAFE/RISKY/AVOID με προτεραιότητα SAFE
  // (2) υπόλοιπα live ανά Set: 3 > 2 > 1 > (unknown)
  // (3) upcoming κατά ώρα
  const labelPrio = { SAFE: 1, RISKY: 2, AVOID: 3 };
  const list = useMemo(() => {
    return [...normalized].sort((a,b) => {
      const aHas = !!a.label, bHas = !!b.label;
      if (aHas && bHas) {
        const pa = labelPrio[a.label] || 9, pb = labelPrio[b.label] || 9;
        if (pa !== pb) return pa - pb;
      } else if (aHas !== bHas) {
        return aHas ? -1 : 1;
      }

      if (a.live !== b.live) return a.live ? -1 : 1;
      if (a.live && b.live) {
        const sa = a.setNum || 0, sb = b.setNum || 0;
        if (sa !== sb) return sb - sa; // 3,2,1
      }
      const ta = a.dt ? a.dt.getTime() : Number.POSITIVE_INFINITY;
      const tb = b.dt ? b.dt.getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }, [normalized]);

  // ήχος μόνο όταν εμφανιστεί νέο SAFE
  useEffect(() => {
    list.forEach((m) => {
      if (m.label === 'SAFE' && !notifiedRef.current.has(m.id)) {
        playNotification();
        notifiedRef.current.add(m.id);
      }
    });
  }, [list]);

  // styles
  const titleStyle = { fontSize: 16, fontWeight: 800, color: '#f2f6f9', lineHeight: 1.12 };
  const detailsStyle = { marginTop: 6, fontSize: 12, color: '#c7d1dc', lineHeight: 1.35 };
  const tipStyle = { marginTop: 6, fontSize: 13, fontWeight: 700, color: '#1fdd73' };

  const renderBadge = (m) => {
    let text = '';
    let bg = '#5e6872'; // default grey

    if (m.label) {
      text = m.label; // SAFE/RISKY/AVOID
      bg = m.label === 'SAFE' ? '#12b76a' : m.label === 'RISKY' ? '#ff9900' : '#ff4747';
    } else if (m.live) {
      if (m.setNum) { text = `SET ${m.setNum}`; bg = '#6e42c1'; }  // purple για set
      else          { text = 'LIVE'; bg = '#2f8d5b'; }             // green για live χωρίς set
    } else if (m.dt && m.dt.getTime() > Date.now()) {
      const mins = Math.max(0, Math.round((m.dt.getTime() - Date.now())/60000));
      text = `STARTS IN ${mins} MIN`;
      bg = '#5e6872';
    } else {
      text = 'SOON';
      bg = '#5e6872';
    }

    return (
      <div
        style={{
          background: bg,
          color: '#fff',
          borderRadius: 18,
          padding: '7px 12px',
          fontWeight: 900,
          fontSize: 12,
          letterSpacing: 0.3,
          minWidth: 72,
          textAlign: 'center',
          boxShadow: '0 8px 18px rgba(0,0,0,.28)',
        }}
      >
        {text}
      </div>
    );
  };

  return (
    <div style={{ background: '#0a0c0e', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '12px auto 40px', padding: '0 14px' }}>
        {list.map((m) => (
          <div key={m.id} style={{
            borderRadius: 18,
            background: '#121416',
            border: '1px solid #1d2126',
            boxShadow: '0 14px 28px rgba(0,0,0,0.45)',
            padding: 16,
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* live / not-live dot */}
                <span
                  title={m.live ? 'Live' : 'Not live'}
                  style={{
                    display: 'inline-block',
                    width: 12, height: 12, borderRadius: '50%',
                    background: m.live ? '#1fdd73' : '#e53935',
                    boxShadow: m.live ? '0 0 10px rgba(31,221,115,.8)' : 'none',
                  }}
                />
                <div>
                  <div style={titleStyle}>
                    {m.name1} <span style={{ color: '#96a5b4', fontWeight: 600 }}>vs</span> {m.name2}
                  </div>
                  <div style={detailsStyle}>
                    {m.date} {m.time} • {m.categoryName}
                  </div>
                  {/* TIP: μόνο για SAFE & RISKY */}
                  {m.label && (m.label === 'SAFE' || m.label === 'RISKY') && m.pick && (
                    <div style={tipStyle}>TIP: {m.pick}</div>
                  )}
                </div>
              </div>
              {renderBadge(m)}
            </div>
          </div>
        ))}

        {list.length === 0 && !loading && (
          <div style={{
            marginTop: 12,
            padding: '14px 16px',
            borderRadius: 12,
            background: '#121416',
            border: '1px solid #22272c',
            color: '#c7d1dc',
            fontSize: 13,
          }}>
            Δεν βρέθηκαν αγώνες (live ή upcoming).
          </div>
        )}
      </div>
    </div>
  );
}