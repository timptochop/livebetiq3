// LiveTennis.js v0.96.3-labels-fix
import React, { useEffect, useMemo, useState, useRef } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';

const isUpcoming = (s) => String(s || '').toLowerCase() === 'not started';
const isFinishedLike = (s) => {
  const x = String(s || '').toLowerCase();
  return ['finished', 'cancelled', 'retired', 'abandoned', 'postponed', 'walk over'].includes(x);
};

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {};
  const b = p[1] || {};
  const sA = [num(a.s1), num(a.s2), num(a.s3)];
  const sB = [num(b.s1), num(b.s2), num(b.s3)];
  let k = 0;
  for (let i = 0; i < 3; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k || null;
}

function setFromStatus(status) {
  const s = String(status || '').toLowerCase().replace(/\s+/g, '');
  const patterns = [
    /set(\d)/i, /(\d)(?:st|nd|rd|th)?set/, /s(?:e?t)?(\d)/i, /set[-_#]?(\d)/i
  ];
  for (const pattern of patterns) {
    const match = s.match(pattern);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

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
    } catch (e) {
      console.warn('Failed to fetch matches:', e);
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

  const now = new Date();

  const normalized = useMemo(() => rows.map((m) => {
    const players = Array.isArray(m.players) ? m.players : (Array.isArray(m.player) ? m.player : []);
    const p1 = players[0] || {};
    const p2 = players[1] || {};
    const name1 = p1.name || p1['@name'] || '';
    const name2 = p2.name || p2['@name'] || '';
    const date = m.date || m['@date'] || '';
    const time = m.time || m['@time'] || '';
    const dt = (() => {
      const [dd, mm, yyyy] = date.split('.').map(Number);
      const [HH = 0, MM = 0] = String(time || '').split(':').map(Number);
      const d = new Date(yyyy, (mm || 1) - 1, dd, HH, MM);
      return isNaN(d.getTime()) ? null : d;
    })();
    const status = m.status || m['@status'] || '';
    const isLive = !isUpcoming(status) && !isFinishedLike(status);
    const setByStatus = setFromStatus(status);
    const setByScores = currentSetFromScores(players);
    const setNum = setByStatus || setByScores || (isUpcoming(status) ? 1 : null);

    const ai = analyzeMatch(m);
    let label = ai.label;

    if (isUpcoming(status) && dt && dt > now) {
      const diffMin = Math.round((dt - now) / 60000);
      label = `STARTS IN ${diffMin} MIN`;
    } else if (!label || ['PENDING', null].includes(label.toUpperCase())) {
      if (isLive && setNum) {
        label = `SET ${setNum}`;
      }
    }

    return {
      id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
      name1, name2, date, time, dt,
      status, setNum, isLive,
      categoryName: m.categoryName || m['@category'] || m.category || '',
      ...ai,
      displayLabel: label
    };
  }), [rows]);

  const labelPriority = {
    SAFE: 1,
    RISKY: 2,
    AVOID: 3,
    'SET 1': 4,
    'SET 2': 5,
    'SET 3': 6,
    DEFAULT: 9
  };

  const list = useMemo(() => {
    const active = normalized.filter((m) => !isFinishedLike(m.status));
    return active.sort((a, b) => {
      const la = labelPriority[a.displayLabel?.toUpperCase()] || 99;
      const lb = labelPriority[b.displayLabel?.toUpperCase()] || 99;
      if (la !== lb) return la - lb;
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      const ta = a.dt?.getTime() ?? Infinity;
      const tb = b.dt?.getTime() ?? Infinity;
      return ta - tb;
    });
  }, [normalized]);

  useEffect(() => {
    onLiveCount(list.filter(x => x.isLive).length);
    list.forEach((m) => {
      if (m.displayLabel === 'SAFE' && !notifiedRef.current.has(m.id)) {
        playNotification();
        notifiedRef.current.add(m.id);
      }
    });
  }, [list, onLiveCount]);

  const titleStyle = { fontSize: 16, fontWeight: 800, color: '#f2f6f9', lineHeight: 1.12 };
  const detailsStyle = { marginTop: 6, fontSize: 12, color: '#c7d1dc', lineHeight: 1.35 };
  const tipStyle = { marginTop: 6, fontSize: 13, fontWeight: 700, color: '#1fdd73' };

  const badgeColors = {
    SAFE: '#1fdd73',
    RISKY: '#f5d743',
    AVOID: '#b06c3b',
    SET: '#9370DB',
    DEFAULT: '#5a5f68'
  };

  const setBadge = (m) => {
    const label = m.displayLabel || '';
    const base = label.toUpperCase();

    let bg = badgeColors.DEFAULT;
    if (base.startsWith('SAFE')) bg = badgeColors.SAFE;
    else if (base.startsWith('RISKY')) bg = badgeColors.RISKY;
    else if (base.startsWith('AVOID')) bg = badgeColors.AVOID;
    else if (base.startsWith('SET')) bg = badgeColors.SET;
    else if (base.startsWith('STARTS')) bg = badgeColors.DEFAULT;

    return (
      <div
        title={m.reason || ''}
        style={{
          background: bg,
          color: '#ffffff',
          borderRadius: 16,
          padding: '6px 12px',
          fontWeight: 900,
          fontSize: 13,
          boxShadow: '0 8px 18px rgba(0,0,0,0.28)',
          minWidth: 64,
          textAlign: 'center'
        }}
      >
        {label}
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
                <span title={m.isLive ? 'Live' : 'Upcoming'} style={{
                  display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                  background: m.isLive ? '#1fdd73' : '#ff5d5d',
                  boxShadow: m.isLive ? '0 0 10px rgba(31,221,115,.8)' : '0 0 8px rgba(255,93,93,.6)',
                }}/>
                <div>
                  <div style={titleStyle}>
                    {m.name1} <span style={{ color: '#96a5b4', fontWeight: 600 }}>vs</span> {m.name2}
                  </div>
                  <div style={detailsStyle}>
                    {m.date} {m.time} • {m.categoryName}
                  </div>
                  {['SAFE', 'RISKY'].includes(m.displayLabel) && m.pick && (
                    <div style={tipStyle}>TIP: {m.pick}</div>
                  )}
                </div>
              </div>
              {setBadge(m)}
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