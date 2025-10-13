// src/components/LiveTennis.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';
import { showToast } from '../utils/toast';
import useLiveCount from '../hooks/useLiveCount';

const FINISHED = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);
const isFinishedLike = (s) => FINISHED.has(String(s || '').toLowerCase());
const isUpcoming = (s) => String(s || '').toLowerCase() === 'not started';

const toInt = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [toInt(a.s1), toInt(a.s2), toInt(a.s3), toInt(a.s4), toInt(a.s5)];
  const sB = [toInt(b.s1), toInt(b.s2), toInt(b.s3), toInt(b.s4), toInt(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k || 0;
}

function parseStart(dateStr, timeStr) {
  const d = String(dateStr || '').trim();
  const t = String(timeStr || '').trim();
  if (!d || !t) return null;
  const dt = new Date(`${d}T${t}`);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function formatDiff(ms) {
  if (ms <= 0) return 'any minute';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return `${h}h ${rm}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d ${rh}h`;
}

// optional, θα αγνοηθεί αν δεν υπάρχει /api/tg
async function tryTg(text) {
  try {
    await fetch('/api/tg?text=' + encodeURIComponent(text));
  } catch {}
}

export default function LiveTennis({
  onLiveCount = () => {},
  notificationsOn = true,
  audioOn = true
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastLabelRef = useRef(new Map());

  async function load() {
    setLoading(true);
    try {
      const base = await fetchTennisLive();
      const keep = (Array.isArray(base) ? base : [])
        .filter(m => !isFinishedLike(m.status || m['@status']));

      const now = Date.now();

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
        const ai = analyzeMatch(m) || {};

        let startAt = null, startInMs = null, startInText = null;
        if (isUpcoming(status)) {
          const dt = parseStart(date, time);
          if (dt) {
            startAt = dt.getTime();
            startInMs = startAt - now;
            startInText = formatDiff(startInMs);
          }
        }

        return {
          id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}-${idx}`,
          name1, name2, date, time, status, setNum,
          categoryName: m.categoryName || m['@category'] || m.category || '',
          ai, players,
          startAt, startInMs, startInText
        };
      });

      setRows(enriched);
    } catch (e) {
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

  const labelPriority = {
    SAFE: 1,
    RISKY: 2,
    AVOID: 3,
    'SET 3': 4,
    'SET 2': 5,
    'SET 1': 6,
    UPCOMING: 7
  };

  const list = useMemo(() => {
    const items = rows.map((m) => {
      const s = m.status || '';
      const live = !!s && !isUpcoming(s) && !isFinishedLike(s);
      let label = m.ai?.label || null;

      if (!live && isUpcoming(s)) {
        label = 'UPCOMING';
      } else if (!label || label === 'PENDING') {
        label = live ? `SET ${m.setNum || 1}` : 'UPCOMING';
      }
      if (label && label.startsWith && label.startsWith('SET')) {
        const parts = label.split(/\s+/);
        const n = Number(parts[1]) || m.setNum || 1;
        label = `SET ${n}`;
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
      if (a.order >= 4 && a.order <= 6 && b.order >= 4 && b.order <= 6) {
        return a.order - b.order; // SET 3 -> SET 2 -> SET 1
      }
      if (a.live && b.live) return (b.setNum || 0) - (a.setNum || 0);
      if (a.uiLabel === 'UPCOMING' && b.uiLabel === 'UPCOMING') {
        const ax = a.startAt || 0, bx = b.startAt || 0;
        return ax - bx;
      }
      return 0;
    });
  }, [rows]);

  // Ζωντανά entries για counter
  const liveList = useMemo(() => list.filter(m => m.live), [list]);

  // ενημέρωση TopBar μέσω event
  useLiveCount(liveList);

  // παλιά ειδοποίηση σε γονέα αν τη χρειάζεσαι
  useEffect(() => {
    onLiveCount(liveList.length);
  }, [liveList, onLiveCount]);

  // ειδοποίηση όταν αλλάζει label (toasts) + Telegram ΜΟΝΟ για SAFE
  useEffect(() => {
    list.forEach((m) => {
      const cur = m.uiLabel || null;
      const prev = lastLabelRef.current.get(m.id) || null;
      const isPred = cur === 'SAFE' || cur === 'RISKY' || cur === 'AVOID';

      if (isPred && cur !== prev) {
        if (cur === 'SAFE' && audioOn) {
          try { new Audio('/notify.mp3').play().catch(() => {}); } catch {}
        }
        if (notificationsOn) {
          const t = `${cur}: ${m.name1} vs ${m.name2}${m.categoryName ? ` · ${m.categoryName}` : ''}`;
          showToast(t, 3500);
          // 🔔 Στείλε στο Telegram ΜΟΝΟ αν είναι SAFE
          if (cur === 'SAFE') tryTg(t);
        }
      }
      lastLabelRef.current.set(m.id, cur);
    });
  }, [list, notificationsOn, audioOn]);

  const Pill = ({ label }) => {
    let bg = '#5a5f68', fg = '#fff', text = label;
    if (label === 'SAFE') { bg = '#1fdd73'; text = 'SAFE'; }
    else if (label === 'RISKY') { bg = '#ffbf0a'; fg = '#151515'; }
    else if (label === 'AVOID') { bg = '#e53935'; }
    else if (label && label.startsWith('SET')) { bg = '#6e42c1'; }
    else if (label === 'UPCOMING') { bg = '#3a4452'; }
    return (
      <span style={{
        padding: '10px 14px',
        borderRadius: 14,
        fontWeight: 800,
        background: bg, color: fg, letterSpacing: .5,
        boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        display: 'inline-block', minWidth: 96, textAlign: 'center'
      }}>{text}</span>
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
    <div style={{ color: '#fff' }}>
      {loading && list.length === 0 ? (
        <div style={{ color: '#cfd3d7', padding: '8px 2px' }}>Loading...</div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map((m) => (
          <div key={m.id} style={{
            borderRadius: 18,
            background: '#1b1e22',
            border: '1px solid #22272c',      // ✅ fixed quotes
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
                {m.uiLabel === 'UPCOMING' && (
                  <span style={{ marginLeft: 8, color: '#9fb0c3' }}>
                    — starts in {m.startInText || 'n/a'}
                  </span>
                )}
              </div>
              {(m.ai?.label === 'SAFE' || m.ai?.label === 'RISKY') && m.ai?.tip && (
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: '#1fdd73' }}>
                  TIP: {m.ai.tip}
                </div>
              )}
            </div>
            <Pill label={m.uiLabel} />
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
            No live/upcoming matches found.
          </div>
        )}
      </div>
    </div>
  );
}