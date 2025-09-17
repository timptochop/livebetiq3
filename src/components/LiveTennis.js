// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';
// Προαιρετικά, αν έχεις css: import './LiveTennis.css';

/* ----------------- helpers ----------------- */
const FINISHED_SET = new Set([
  'finished', 'cancelled', 'retired', 'abandoned', 'postponed', 'walk over',
]);

const isFinishedLike = (s) => FINISHED_SET.has(String(s || '').toLowerCase());
const isNotStarted   = (s) => String(s || '').toLowerCase() === 'not started';
const isLiveStatus   = (s) => !!s && !isNotStarted(s) && !isFinishedLike(s);

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [num(a.s1), num(a.s2), num(a.s3), num(a.s4), num(a.s5)];
  const sB = [num(b.s1), num(b.s2), num(b.s3), num(b.s4), num(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k || null;
}

function setFromStatus(status) {
  const s = String(status || '').toLowerCase();
  const m = s.match(/(?:^|\s)([1-5])(?:st|nd|rd|th)?\s*set|set\s*([1-5])/i);
  if (!m) return null;
  return parseInt(m[1] || m[2], 10);
}

/* ----------------- UI atoms ----------------- */
const Dot = ({ on }) => (
  <span
    style={{
      width: 12, height: 12, borderRadius: 999, display: 'inline-block',
      background: on ? '#1fdd73' : '#e53935',
      boxShadow: on ? '0 0 10px rgba(31,221,115,.8)' : '0 0 8px rgba(229,57,53,.6)',
    }}
    aria-label={on ? 'live' : 'not-live'}
  />
);

function RightBadge({ label, live, setNum }) {
  // Χρώματα: SAFE=πράσινο, RISKY=πορτοκαλί, AVOID=κόκκινο, SET=μοβ, UPCOMING=γκρι
  const L = String(label || '').toUpperCase();
  let bg = '#5a5f68', text = L || 'STARTS SOON';

  if (L === 'SAFE')  { bg = '#1fdd73'; text = 'SAFE'; }
  else if (L === 'RISKY') { bg = '#ff9900'; text = 'RISKY'; }
  else if (L === 'AVOID') { bg = '#ff2e2e'; text = 'AVOID'; }
  else if (live) { // Live χωρίς AI -> δείξε SET X σε μωβ
    bg = '#7c5cff'; text = `SET ${setNum || 1}`;
  } else {
    bg = '#5a5f68'; text = 'STARTS SOON';
  }

  return (
    <div
      style={{
        background: bg, color: '#ffffff', borderRadius: 16,
        padding: '8px 12px', fontWeight: 900, fontSize: 13,
        boxShadow: '0 8px 18px rgba(0,0,0,0.28)', minWidth: 84, textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
}

/* ----------------- component ----------------- */
export default function LiveTennis({ onLiveCount = () => {} }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const matches = await fetchTennisLive(); // επιστρέφει array ή {matches:[]}
      const arr = Array.isArray(matches) ? matches : (matches?.matches || []);
      setRows(Array.isArray(arr) ? arr : []);
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
                  : (Array.isArray(m.player) ? m.player : []);
    const p1 = players[0] || {}, p2 = players[1] || {};
    const name1 = p1.name || p1['@name'] || '';
    const name2 = p2.name || p2['@name'] || '';
    const status = m.status || m['@status'] || '';
    const setNum = setFromStatus(status) || currentSetFromScores(players) || null;
    const live = isLiveStatus(status);

    // AI v1.4 (επιστρέφει { label, pick, reason })
    const ai = analyzeMatch({
      ...m,
      players,
      categoryName: m.categoryName || m['@category'] || m.category || '',
    }) || {};

    // label/pick
    const label = ai.label || null;
    const pick  = ai.pick  || null;

    return {
      id: m.id || m['@id'] || `${name1}-${name2}-${status}`,
      name1, name2, status, live, setNum,
      categoryName: m.categoryName || m['@category'] || m.category || '',
      label, pick,
    };
  }), [rows]);

  // update live counter (πόσα είναι live τώρα)
  useEffect(() => {
    const liveCount = normalized.reduce((n, m) => n + (m.live ? 1 : 0), 0);
    onLiveCount(liveCount);
  }, [normalized, onLiveCount]);

  // φιλτράρουμε τα finished
  const filtered = useMemo(
    () => normalized.filter((m) => !isFinishedLike(m.status)),
    [normalized]
  );

  // ταξινόμηση:
  // 1) LIVE με AI: SAFE -> RISKY -> AVOID
  // 2) LIVE χωρίς AI: SET 3 -> 2 -> 1
  // 3) UPCOMING (not started): όπως έρχονται
  const sorted = useMemo(() => {
    const labelRank = (lbl) => {
      const L = String(lbl || '').toUpperCase();
      if (L === 'SAFE') return 0;
      if (L === 'RISKY') return 1;
      if (L === 'AVOID') return 2;
      return 9; // no AI
    };
    return [...filtered].sort((a, b) => {
      // live πρώτα
      if (a.live !== b.live) return a.live ? -1 : 1;

      if (a.live) {
        const ar = labelRank(a.label), br = labelRank(b.label);
        if (ar !== br) return ar - br;

        // χωρίς AI (labelRank=9): SET 3 -> 2 -> 1
        if (ar === 9 && br === 9) {
          const sa = a.setNum || 0, sb = b.setNum || 0;
          return sb - sa;
        }
        return 0; // ίδια κατηγορία
      }

      // upcoming: δεν έχει ιδιαίτερη σειρά εδώ
      return 0;
    });
  }, [filtered]);

  return (
    <div style={{ background: '#0a0c0e', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '12px auto 40px', padding: '0 14px' }}>
        {err && (
          <div style={{
            background: '#3a1b1b', border: '1px solid #5b2a2a', color: '#ffd7d7',
            borderRadius: 10, padding: '10px 12px', marginBottom: 12
          }}>
            {err}
          </div>
        )}

        {loading && sorted.length === 0 && (
          <div style={{ color: '#cfd3d7', padding: '8px 2px' }}>Φόρτωση…</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map((m) => (
            <div key={m.id} style={{
              borderRadius: 18,
              background: '#121416',
              border: '1px solid #1d2126',
              boxShadow: '0 14px 28px rgba(0,0,0,0.45)',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <Dot on={m.live} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2, color: '#f2f6f9' }}>
                  {m.name1}
                  <span style={{ color: '#96a5b4', fontWeight: 600 }}> &nbsp;vs&nbsp; </span>
                  {m.name2}
                </div>
                <div style={{ marginTop: 6, color: '#c7d1dc', fontSize: 13 }}>
                  {m.categoryName}
                </div>

                {/* TIP: μόνο κείμενο "TIP: <pick>", χωρίς EV/CONF */}
                {m.pick && (m.label === 'SAFE' || m.label === 'RISKY') && (
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: '#1fdd73' }}>
                    TIP: {m.pick}
                  </div>
                )}
              </div>

              <RightBadge label={m.label} live={m.live} setNum={m.setNum} />
            </div>
          ))}

          {sorted.length === 0 && !loading && (
            <div style={{
              marginTop: 12, padding: '14px 16px', borderRadius: 12,
              background: '#121416', border: '1px solid #22272c',
              color: '#c7d1dc', fontSize: 13,
            }}>
              Δεν βρέθηκαν αγώνες (live ή upcoming).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}