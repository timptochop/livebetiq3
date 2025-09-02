import React, { useEffect, useMemo, useRef, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';

// ---------- helpers ----------
function parseDateTime(d, t) {
  const ds = String(d || '').trim();
  const ts = String(t || '').trim();
  if (!ds) return null;
  const [dd, mm, yyyy] = ds.split('.').map(Number);
  let HH = 0, MM = 0;
  if (ts.includes(':')) {
    const [h, m] = ts.split(':').map(Number);
    HH = h || 0; MM = m || 0;
  }
  const dt = new Date(yyyy || 1970, (mm || 1) - 1, dd || 1, HH, MM, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}

const isUpcoming = (s) => String(s || '').toLowerCase() === 'not started';
const isFinishedLike = (s) => {
  const x = String(s || '').toLowerCase();
  return ['finished', 'cancelled', 'retired', 'abandoned', 'postponed', 'walk over'].includes(x);
};
const isLiveLike = (s) => !isUpcoming(s) && !isFinishedLike(s);

// current set από scores
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
  return k;
}

const chip = (text, bg = '#6a1b9a') => (
  <span
    style={{
      background: bg,
      color: '#fff',
      padding: '8px 14px',
      borderRadius: 999,
      fontWeight: 700,
      letterSpacing: 0.3,
      fontSize: 14,
      display: 'inline-block',
      minWidth: 74,
      textAlign: 'center'
    }}
  >
    {text}
  </span>
);

// ---------- component ----------
export default function LiveTennis({ onLiveCount, notificationsOn }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Κρατάμε ποια matches έχουμε ειδοποιήσει ήδη (για να μη διπλο-χτυπήσουν)
  const notifiedIdsRef = useRef(new Set());

  // Φόρτωμα / auto refresh
  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const matches = await fetchTennisLive();
      setRows(Array.isArray(matches) ? matches : []);
    } catch (e) {
      setErr(e?.message || 'HTTP 500');
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

  // Normalize
  const normalized = useMemo(() => {
    return rows.map((m) => {
      const players = Array.isArray(m.players) ? m.players : Array.isArray(m.player) ? m.player : [];
      const p1 = players[0] || {}, p2 = players[1] || {};
      const name1 = p1.name || p1['@name'] || '';
      const name2 = p2.name || p2['@name'] || '';
      const date = m.date || m['@date'] || '';
      const time = m.time || m['@time'] || '';
      const dt = parseDateTime(date, time);
      const status = m.status || m['@status'] || '';
      const setNum = currentSetFromScores(players) || 0;
      const pr = m.prediction || {};
      const label = String(pr.label || 'PENDING').toUpperCase();
      let pickName = null;
      if (typeof pr.pick === 'number') pickName = pr.pick === 0 ? name1 : pr.pick === 1 ? name2 : null;
      else if (typeof pr.pick === 'string') pickName = pr.pick;

      return {
        id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
        date, time, dt, status, setNum,
        categoryName: m.categoryName || m['@category'] || m.category || '',
        name1, name2,
        prediction: {
          label,
          pick: pickName,
          confidence: pr.confidence ?? 0,
          source: pr.source || 'fallback',
        }
      };
    });
  }, [rows]);

  // Ταξινόμηση: live SAFE → live PENDING → live άλλα → upcoming
  const list = useMemo(() => {
    const keep = normalized.filter(m => !isFinishedLike(m.status));
    const score = (m) => {
      const liveScore = isLiveLike(m.status) ? 0 : 100;                       // live πρώτα
      const labelScore =
        m.prediction.label === 'SAFE' ? 0 :
        m.prediction.label === 'PENDING' ? 1 : 2;                             // SAFE, μετά PENDING
      const timeScore = m.dt ? m.dt.getTime() : Number.POSITIVE_INFINITY;     // νωρίτερα πρώτα
      return [liveScore, labelScore, -m.setNum, timeScore];
    };
    const sorted = [...keep].sort((a, b) => {
      const A = score(a), B = score(b);
      for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return A[i] - B[i];
      return 0;
    });
    // live counter
    const liveN = sorted.filter(m => isLiveLike(m.status)).length;
    onLiveCount?.(liveN);
    return sorted;
  }, [normalized, onLiveCount]);

  // -------- Notifications SAFE --------
  useEffect(() => {
    if (!notificationsOn) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notified = notifiedIdsRef.current;

    // Κανόνας: ειδοποιούμε για LIVE + SAFE, μία φορά ανά match id
    const candidates = list.filter(
      (m) => isLiveLike(m.status) && m.prediction.label === 'SAFE' && !notified.has(m.id)
    );

    if (candidates.length === 0) return;

    candidates.forEach((m) => {
      try {
        const title = `SAFE: ${m.name1} vs ${m.name2}`;
        const body = `${m.categoryName} • Set ${m.setNum || 1}`;
        const n = new Notification(title, {
          body,
          icon: '/logo192.png',
          badge: '/logo192.png',
        });
        // προαιρετικός ήχος
        const audio = new Audio('/notify.mp3');
        audio.play().catch(() => {});
        // μην ξαναστείλουμε
        notified.add(m.id);
        // κλείσιμο μετά από λίγο
        setTimeout(() => n.close(), 5000);
      } catch {}
    });
  }, [list, notificationsOn]);

  // ---------- UI ----------
  return (
    <div>
      {err && (
        <div style={{
          background: '#2a1c1c',
          color: '#ff8a80',
          padding: '10px 12px',
          borderRadius: 10,
          margin: '8px 6px'
        }}>
          {err}
        </div>
      )}

      {loading && list.length === 0 && (
        <div style={{ color: '#cfd3d7', margin: '8px 6px' }}>Φόρτωση…</div>
      )}

      {list.length === 0 && !loading && (
        <div style={{
          margin: '12px 6px',
          background: '#121212',
          border: '1px solid #1e1e1e',
          borderRadius: 12,
          padding: '14px'
        }}>
          Δεν βρέθηκαν αγώνες (live ή upcoming).
        </div>
      )}

      {list.map((m) => (
        <div
          key={m.id}
          style={{
            background: '#111',
            borderRadius: 18,
            padding: '14px 14px',
            margin: '10px 6px',
            boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
            border: '1px solid #1f1f1f'
          }}
        >
          {/* γραμμή τίτλου */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: isLiveLike(m.status) ? '#00e676' : '#d32f2f'
              }}
            />
            <div style={{ fontWeight: 800, color: '#fff', fontSize: 20, flex: 1 }}>
              {m.name1} <span style={{ color: '#9aa0a6', fontWeight: 400 }}>vs</span> {m.name2}
            </div>
            {/* SET badge (μωβ) */}
            {chip(`SET ${m.setNum || 1}`, '#6a1b9a')}
          </div>

          {/* λεπτομέρειες */}
          <div style={{ marginTop: 8, color: '#cfd3d7', fontSize: 14 }}>
            {m.date} {m.time} • {m.categoryName}
          </div>

          {/* prediction badge (SAFE/RISKY/AVOID/PENDING) – μόνο αν είναι LIVE */}
          {isLiveLike(m.status) && (
            <div style={{ marginTop: 10 }}>
              {m.prediction.label === 'SAFE' && chip('SAFE', '#1e8e3e')}
              {m.prediction.label === 'RISKY' && chip('RISKY', '#ffb300')}
              {m.prediction.label === 'AVOID' && chip('AVOID', '#c62828')}
              {m.prediction.label === 'PENDING' && chip('PENDING', '#546e7a')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}