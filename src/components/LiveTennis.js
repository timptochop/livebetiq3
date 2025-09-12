import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';

const FINISHED_SET = new Set([
  'finished', 'cancelled', 'retired', 'abandoned', 'postponed', 'walk over',
]);

const isFinishedLike = (s) => FINISHED_SET.has((s || '').toLowerCase());
const isNotStarted = (s) => (s || '').toLowerCase() === 'not started';
const isLive = (s) => !!s && !isNotStarted(s) && !isFinishedLike(s);

const num = (v) => {
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
  const sA = [num(a.s1), num(a.s2), num(a.s3), num(a.s4), num(a.s5)];
  const sB = [num(b.s1), num(b.s2), num(b.s3), num(b.s4), num(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k;
};

const parseDateTime = (d, t) => {
  const ds = String(d || '').trim();
  const ts = String(t || '').trim();
  const [dd, mm, yyyy] = ds.split('.').map(Number);
  let HH = 0, MM = 0;
  if (ts.includes(':')) {
    const parts = ts.split(':').map(Number);
    HH = parts[0] || 0; MM = parts[1] || 0;
  }
  const dt = new Date(yyyy || 1970, (mm || 1) - 1, dd || 1, HH, MM, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const predictionChip = (label) => {
  const t = (label || '').toUpperCase();
  if (t === 'SAFE')   return { bg: '#20b954', fg: '#ffffff', text: 'SAFE' };
  if (t === 'RISKY')  return { bg: '#ffbf0a', fg: '#151515', text: 'RISKY' };
  if (t === 'AVOID')  return { bg: '#e53935', fg: '#ffffff', text: 'AVOID' };
  return null;
};

const Dot = ({ on }) => (
  <span style={{
    width: 10, height: 10, borderRadius: 999,
    display: 'inline-block',
    background: on ? '#24d06a' : '#5f6b75',
    boxShadow: on ? '0 0 0 2px rgba(36,208,106,0.25)' : 'none',
    marginRight: 10,
  }} />
);

const RightPill = ({ label, setNum, live }) => {
  const pr = predictionChip(label);
  if (pr) {
    return (
      <span style={{
        padding: '10px 14px',
        borderRadius: 14,
        fontWeight: 800,
        background: pr.bg, color: pr.fg,
        boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        display: 'inline-block', minWidth: 84, textAlign: 'center'
      }}>{pr.text}</span>
    );
  }
  if (live) {
    return (
      <span style={{
        padding: '10px 14px',
        borderRadius: 14,
        fontWeight: 800,
        background: '#6e42c1', color: '#fff',
        boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        display: 'inline-block', minWidth: 84, textAlign: 'center'
      }}>{`SET ${setNum || 1}`}</span>
    );
  }
  return (
    <span style={{
      padding: '10px 14px',
      borderRadius: 14,
      fontWeight: 800,
      background: '#5e6872', color: '#e9eef2',
      boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
      display: 'inline-block', minWidth: 124, textAlign: 'center'
    }}>STARTS SOON</span>
  );
};

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

  const normalized = useMemo(() => {
    return rows.map((m) => {
      const players = Array.isArray(m.players) ? m.players : [];
      const p1 = players[0] || {};
      const p2 = players[1] || {};
      const name1 = p1.name || p1['@name'] || '';
      const name2 = p2.name || p2['@name'] || '';
      const date = m.date || m['@date'] || '';
      const time = m.time || m['@time'] || '';
      const dt = parseDateTime(date, time);
      const status = m.status || m['@status'] || '';
      const setNum = currentSetFromScores(players);
      const pr = m.prediction || {};
      const label = (pr.label || 'PENDING').toUpperCase();

      return {
        id: m.id || `${date}-${time}-${name1}-${name2}`,
        name1, name2,
        categoryName: m.categoryName || m['@category'] || '',
        date, time, dt, status, setNum,
        prediction: {
          label,
          confidence: pr.confidence ?? 0,
          pick: typeof pr.pick === 'string' ? pr.pick : null,
        },
      };
    });
  }, [rows]);

  const filtered = useMemo(
    () => normalized.filter((m) => !isFinishedLike(m.status)),
    [normalized]
  );

  useEffect(() => {
    const liveCount = filtered.reduce((n, m) => n + (isLive(m.status) ? 1 : 0), 0);
    onLiveCount(liveCount);
  }, [filtered, onLiveCount]);

  const sorted = useMemo(() => {
    const getPriority = (m) => {
      const live = isLive(m.status);
      const label = m.prediction.label;
      if (label === 'SAFE') return 0;
      if (label === 'RISKY') return 1;
      if (label === 'AVOID') return 2;
      if (live) return 3; // SET X
      return 4; // STARTS SOON
    };
    return [...filtered].sort((a, b) => {
      const w = getPriority(a) - getPriority(b);
      if (w !== 0) return w;
      const ta = a.dt ? a.dt.getTime() : Infinity;
      const tb = b.dt ? b.dt.getTime() : Infinity;
      return ta - tb;
    });
  }, [filtered]);

  return (
    <div style={{ padding: '12px 14px 24px 14px', color: '#fff' }}>
      {err && (
        <div style={{
          background: '#3a1b1b', border: '1px solid #5b2a2a', color: '#ffd7d7',
          borderRadius: 10, padding: '10px 12px', marginBottom: 12
        }}>
          {err}
        </div>
      )}

      {loading && sorted.length === 0 ? (
        <div style={{ color: '#cfd3d7', padding: '8px 2px' }}>Loading…</div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map((m) => {
          const live = isLive(m.status);
          const { label } = m.prediction;

          return (
            <div key={m.id} style={{
              borderRadius: 18,
              background: '#1b1e22',
              border: '1px solid #22272c',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <Dot on={live} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25, color: '#fff' }}>
                  <span>{m.name1}</span>
                  <span style={{ color: '#98a0a6', fontWeight: 600 }}> &nbsp;vs&nbsp; </span>
                  <span>{m.name2}</span>
                </div>
                <div style={{ marginTop: 6, color: '#c2c7cc', fontSize: 14 }}>
                  {m.date} {m.time} · {m.categoryName}
                </div>
              </div>
              <RightPill label={label} setNum={m.setNum} live={live} />
            </div>
          );
        })}
      </div>
    </div>
  );
}