// src/components/LiveTennis.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';
import logger from '../utils/predictionLogger';

const FINISHED = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);
const isFinishedLike = (s) => FINISHED.has(String(s || '').toLowerCase());
const isUpcoming = (s) => String(s || '').toLowerCase() === 'not started';

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
  return k || 0;
}

export default function LiveTennis({ onLiveCount = () => {} }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const notifiedRef = useRef(new Set()); // για ήχο SAFE
  const loggedRef = useRef(new Set());   // για logger (by srcId)

  async function load() {
    setLoading(true);
    try {
      const base = await fetchTennisLive(); // αναμένουμε [{...match...}]

      // 🔄 ενημέρωσε τον logger με όλο το feed, ώστε να κλείνουν όσα τελείωσαν
      logger.syncWithFeed(Array.isArray(base) ? base : []);

      // φιλτράρουμε τελειωμένα για το UI
      const keep = (Array.isArray(base) ? base : []).filter(m => !isFinishedLike(m.status || m['@status']));

      // enrich με AI
      const enriched = keep.map((m, idx) => {
        const players = Array.isArray(m.players) ? m.players
                      : Array.isArray(m.player)  ? m.player : [];
        const p1 = players[0] || {}, p2 = players[1] || {};
        const name1 = p1.name || p1['@name'] || '';
        const name2 = p2.name || p2['@name'] || '';
        const date = m.date || m['@date'] || '';
        const time = m.time || m['@time'] || '';
        const status = m.status || m['@status'] || '';
        const setNum = currentSetFromScores(players);
        const ai = analyzeMatch(m);

        // UI id (unique), αλλά κρατάμε ΚΑΙ stable srcId για τον logger
        const srcId = String(m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`);
        return {
          id: `${srcId}-${idx}`, // UI unique
          srcId,                 // stable για logging
          name1, name2, date, time, status, setNum,
          categoryName: m.categoryName || m['@category'] || m.category || '',
          ai, players,
        };
      });
      setRows(enriched);
    } catch (e) {
      console.warn('[LiveTennis] load error:', e?.message);
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

  // live counter για top bar
  useEffect(() => {
    const n = rows.reduce((acc, m) => {
      const s = m.status || '';
      const live = !!s && !isUpcoming(s) && !isFinishedLike(s);
      return acc + (live ? 1 : 0);
    }, 0);
    onLiveCount(n);
  }, [rows, onLiveCount]);

  const labelPriority = {
    SAFE: 1,
    RISKY: 2,
    AVOID: 3,
    'SET 3': 4,
    'SET 2': 5,
    'SET 1': 6,
    SOON: 7,
  };

  const list = useMemo(() => {
    const items = rows.map((m) => {
      let label = m.ai?.label || null;
      const s = m.status || '';
      const live = !!s && !isUpcoming(s) && !isFinishedLike(s);

      if (!label || label === 'PENDING') {
        if (live) label = `SET ${m.setNum || 1}`;
        else label = 'SOON';
      }
      if (label.startsWith('SET')) {
        label = `SET ${label.split(' ')[1] || m.setNum || 1}`;
      }
      return {
        ...m,
        live,
        uiLabel: label,
        order: labelPriority[label] || 99,
      };
    });

    return items.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      if (a.live && b.live) return (b.setNum || 0) - (a.setNum || 0);
      return 0;
    });
  }, [rows]);

  // 🔔 ήχος για SAFE + ✍️ log prediction (SAFE/RISKY) μία φορά ανά match
  useEffect(() => {
    list.forEach((m) => {
      if (m.ai?.label === 'SAFE' && !notifiedRef.current.has(m.id)) {
        const a = new Audio('/notify.mp3');
        a.play().catch(() => {});
        notifiedRef.current.add(m.id);
      }
      if (['SAFE','RISKY'].includes(m.ai?.label) && !loggedRef.current.has(m.srcId)) {
        logger.logPrediction({
          id: m.srcId,
          name1: m.name1,
          name2: m.name2,
          setNum: m.setNum,
          label: m.ai.label,
          tip: m.ai.tip,
          kellyLevel: m.ai.kellyLevel,
          statusAtPick: m.status
        });
        loggedRef.current.add(m.srcId);
      }
    });
  }, [list]);

  // ---------- UI helpers ----------
  const Pill = ({ label, kellyLevel }) => {
    let bg = '#5a5f68', fg = '#fff';
    let text = label;
    if (label === 'SAFE') { bg = '#1fdd73'; text = 'SAFE'; }
    else if (label === 'RISKY') { bg = '#ffbf0a'; fg = '#151515'; }
    else if (label === 'AVOID') { bg = '#e53935'; }
    else if (label.startsWith('SET')) { bg = '#6e42c1'; }
    else if (label === 'SOON') { bg = '#5a5f68'; }

    let dots = '';
    if (kellyLevel === 'HIGH') dots = ' ●●●';
    else if (kellyLevel === 'MED') dots = ' ●●';
    else if (kellyLevel === 'LOW') dots = ' ●';

    return (
      <span style={{
        padding: '10px 14px',
        borderRadius: 14,
        fontWeight: 800,
        background: bg, color: fg, letterSpacing: .5,
        boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        display: 'inline-block', minWidth: 96, textAlign: 'center'
      }}>{text}{['SAFE','RISKY'].includes(label) ? dots : ''}</span>
    );
  };

  const Dot = ({ on }) => (
    <span style={{
      width: 10, height: 10, borderRadius: 999, display: 'inline-block',
      background: on ? '#1fdd73' : '#e53935',
      boxShadow: on ? '0 0 0 2px rgba(31,221,115,0.25)' : 'none',
    }} />
  );

  return (
    <div style={{ padding: '12px 14px 24px', color: '#fff' }}>
      {loading && list.length === 0 ? (
        <div style={{ color: '#cfd3d7', padding: '8px 2px' }}>Φόρτωση…</div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map((m) => (
          <div key={m.id} style={{
            borderRadius: 18,
            background: '#1b1e22',
            border: '1px solid #22272c',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Dot on={m.live} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25, color: '#fff' }}>
                <span>{m.name1}</span>
                <span style={{ color: '#98a0a6', fontWeight: 600 }}> &nbsp;vs&nbsp; </span>
                <span>{m.name2}</span>
              </div>
              <div style={{ marginTop: 6, color: '#c2c7cc', fontSize: 14 }}>
                {m.date} {m.time} · {m.categoryName}
              </div>

              {['SAFE','RISKY'].includes(m.ai?.label) && m.ai?.tip && (
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: '#1fdd73' }}>
                  TIP: {m.ai.tip}
                </div>
              )}
            </div>

            <Pill label={m.uiLabel} kellyLevel={m.ai?.kellyLevel} />
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