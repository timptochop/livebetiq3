import React, { useEffect, useMemo, useState } from 'react';
import TopBar from './TopBar';
import fetchTennisLive from '../utils/fetchTennisLive';

// ---- helpers ----
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
function isLive(s) {
  if (!s) return false;
  const low = String(s).toLowerCase();
  if (isFinishedLike(low)) return false;
  if (isUpcoming(low)) return false;
  return true;
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
function labelColor(tag) {
  const t = String(tag || '').toUpperCase();
  if (t === 'SAFE') return { bg: '#2e7d32', fg: '#fff' };
  if (t === 'RISKY') return { bg: '#ffb300', fg: '#000' };
  if (t === 'AVOID') return { bg: '#c62828', fg: '#fff' };
  if (t === 'PENDING') return { bg: '#546e7a', fg: '#fff' };
  return { bg: '#546e7a', fg: '#fff' };
}
const AI_LABELS = new Set(['SAFE', 'RISKY', 'AVOID']);

export default function LiveTennis() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [notificationsOn, setNotificationsOn] = useState(true);

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const matches = await fetchTennisLive();
      setRows(Array.isArray(matches) ? matches : []);
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
      const label = (pr.label || 'PENDING').toUpperCase();
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
        isLive: isLive(status),
        isUpcoming: isUpcoming(status),
        isFinished: isFinishedLike(status),
        prediction: {
          label,
          pick: pickName,
          confidence: pr.confidence ?? 0,
          source: pr.source || 'fallback',
          detail: pr.detail || '',
        },
      };
    });
  }, [rows]);

  const liveCount = useMemo(() => normalized.filter((m) => m.isLive).length, [normalized]);

  // ταξινόμηση: live with AI -> live pending -> upcoming (χωρίς AI φίλτρο πλέον)
  const filteredSorted = useMemo(() => {
    let keep = normalized.filter((m) => !m.isFinished);

    const rank = (m) => {
      if (m.isLive && AI_LABELS.has(m.prediction.label)) return 0;
      if (m.isLive) return 1;
      return 2;
    };

    return [...keep].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      const s = (b.setNum || 0) - (a.setNum || 0);
      if (s !== 0) return s;
      const ta = a.dt ? a.dt.getTime() : Number.POSITIVE_INFINITY;
      const tb = b.dt ? b.dt.getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }, [normalized]);

  const chip = (text, bg = '#546e7a', fg = '#fff') => (
    <span
      style={{
        background: bg,
        color: fg,
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 800,
        boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
      }}
    >
      {text}
    </span>
  );

  return (
    <div style={{ background: '#0b0b0b', color: '#fff', minHeight: '100vh' }}>
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        setNotificationsOn={setNotificationsOn}
        onSettingsClick={() => {}}
        onLoginClick={() => {}}
        logoSrc="/logo.png"
      />

      <div style={{ padding: 12, maxWidth: 1100, margin: '0 auto' }}>
        {/* Καμία αναζήτηση, κανένα empty-state */}
        {!loading && err && (
          <div
            style={{
              margin: '12px 0',
              background: '#2b1c1c',
              border: '1px solid #4d2222',
              borderRadius: 10,
              padding: 12,
              color: '#ff8a80',
            }}
          >
            {err}
          </div>
        )}

        {/* Κάρτες */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredSorted.map((m) => {
            const { label } = m.prediction;
            const setBadge =
              m.isLive && m.setNum > 0
                ? chip(`SET ${m.setNum}`, '#2e7d32')
                : m.isUpcoming
                ? chip('STARTS SOON', '#5c6770')
                : null;

            const dotColor = m.isLive ? '#1db954' : '#e53935';
            const lbl = label.toUpperCase();
            const aiPill =
              lbl === 'SAFE' || lbl === 'RISKY' || lbl === 'AVOID'
                ? chip(lbl, labelColor(lbl).bg, labelColor(lbl).fg)
                : null;

            return (
              <div
                key={m.id}
                style={{
                  background: '#151515',
                  border: '1px solid #222',
                  borderRadius: 18,
                  padding: 14,
                  boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: dotColor,
                    display: 'inline-block',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      letterSpacing: 0.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.name1} <span style={{ opacity: 0.6, fontWeight: 600 }}>vs</span> {m.name2}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#cfd3d7' }}>
                    {m.date} {m.time} • {m.categoryName}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {setBadge}
                  {aiPill}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}