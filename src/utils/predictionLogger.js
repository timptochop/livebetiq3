// src/utils/predictionLogger.js
// Drop-in: κρατά pending SAFE/RISKY, κάνει auto-settle, στέλνει σε /api/log-prediction.
// Συμβατό με το παλιό API: default export log(event,data), + logPrediction(payload)

const ENABLED = String(process.env.REACT_APP_LOG_PREDICTIONS || '0') === '1';
const MODEL = process.env.REACT_APP_AI_ENGINE || 'v2';
const LS_KEY = 'LB3_PENDING_PICKS';

function getSid() {
  try {
    const k = 'lbq.sid';
    let v = localStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return 'nosid';
  }
}

const recent = new Map();
function dedupe(key, ttlMs = 10_000) {
  const now = Date.now();
  const hit = recent.get(key);
  if (hit && now - hit < ttlMs) return true;
  recent.set(key, now);
  for (const [k, t] of recent) if (now - t > ttlMs) recent.delete(k);
  return false;
}

function slimData(data = {}) {
  const clone = { ...data };
  if (clone.features && typeof clone.features === 'object') {
    const { pOdds, momentum, drift, setNum, live, ..._rest } = clone.features;
    clone.features = { pOdds, momentum, drift, setNum, live };
  }
  if (typeof clone.conf === 'number') clone.conf = Math.round(clone.conf * 1000) / 1000;
  return clone;
}

function sendToServer(payload) {
  try {
    // πάντα κονσόλα αν ENABLED
    if (ENABLED) { try { console.debug('[pred-log]', payload); } catch {} }
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/log-prediction', blob);
      return;
    }
    if (typeof fetch === 'function') {
      fetch('/api/log-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}
}

export default function log(event, data = {}) {
  if (!ENABLED) return;

  const base = {
    ts: new Date().toISOString(),
    sid: getSid(),
    app: 'livebetiq3',
    model: MODEL,
    event,
    data: slimData(data),
  };

  const d = base.data || {};
  const key = [event || '', d.matchId || d.id || '', d.label || '', Math.round((d.conf || 0) * 100)].join('|');
  if (dedupe(key)) return;

  sendToServer(base);
}

export function logPrediction(payload = {}) {
  // Για συμβατότητα με το παλιό usage
  return log('prediction', payload);
}

// ---------- Pending & auto-settle ----------

function loadPending() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch { return []; }
}
function savePending(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

/**
 * Κάλεσέ το όταν εμφανιστεί ΝΕΟ label SAFE/RISKY:
 * addPending({ id, favName, label })
 */
export function addPending({ id, favName, label }) {
  if (!id || !favName || !label) return;
  const list = loadPending().filter(x => x.id !== id); // 1 ανά match
  list.push({ id, favName, label, ts: Date.now() });
  savePending(list);
}

/**
 * Υπολόγισε νικητή από per-set σκορ.
 */
function computeWinnerFromSets(match) {
  try {
    const players = Array.isArray(match.players) ? match.players
                  : (Array.isArray(match.player) ? match.player : []);
    const A = players[0] || {}, B = players[1] || {};
    let setsA = 0, setsB = 0;
    for (let i=1;i<=5;i++){
      const a = +(A['s'+i] ?? NaN), b = +(B['s'+i] ?? NaN);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        if (a>b) setsA++; else if (b>a) setsB++;
      }
    }
    if (setsA>setsB) return (A.name || A['@name'] || 'Player A');
    if (setsB>setsA) return (B.name || B['@name'] || 'Player B');
    return null;
  } catch { return null; }
}

/**
 * Κάλεσέ το μετά το setRows(enriched): trySettleFinished(enriched)
 * Θα στείλει SETTLE events για τελειωμένους αγώνες και θα καθαρίσει τα pending.
 */
export function trySettleFinished(rows) {
  const list = loadPending();
  if (!list.length) return;

  const byId = new Map(rows.map(r => [r.id, r]));
  const stillOpen = [];
  list.forEach(item => {
    const m = byId.get(item.id);
    const status = String(m?.status || m?.['@status'] || '').toLowerCase();
    const finishedLike = /(finished|retired|walk ?over|abandoned|cancelled|postponed)/.test(status);

    if (!m || finishedLike) {
      const winner = m ? computeWinnerFromSets(m) : null;
      const result = winner && item.favName
        ? (winner.trim().toLowerCase() === item.favName.trim().toLowerCase() ? 'WIN' : 'LOSE')
        : 'UNKNOWN';

      sendToServer({
        ts: new Date().toISOString(),
        sid: getSid(),
        app: 'livebetiq3',
        model: MODEL,
        event: 'settle',
        data: {
          id: item.id,
          pickLabel: item.label,
          favName: item.favName,
          winner: winner || 'n/a',
          result,
        },
      });
    } else {
      stillOpen.push(item);
    }
  });
  savePending(stillOpen);
}