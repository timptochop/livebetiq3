// src/utils/predictionLogger.js
// Unified logger for LiveBet IQ v3.10
// - logPrediction(payload) -> POST /api/predictions (event:'prediction')
// - addPending({id, favName, label})
// - trySettleFinished(rawFeed) -> auto result reporting via reportResult()
// Guarantees: favName always real (no "Player A"); predicted uses pending.favName

import reportResult from './reportResult';

const ENABLED = String(process.env.REACT_APP_LOG_PREDICTIONS || '0') === '1';
const MODEL   = process.env.REACT_APP_AI_ENGINE || 'v3.10';
const LS_KEY  = 'lbq_pending_v1';

// -------- SID helpers --------
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

// -------- Dedupe predictor chatter (optional) --------
const recent = new Map();
function dedupe(key, ttlMs = 10_000) {
  const now = Date.now();
  const hit = recent.get(key);
  if (hit && now - hit < ttlMs) return true;
  recent.set(key, now);
  for (const [k, t] of recent) if (now - t > ttlMs) recent.delete(k);
  return false;
}

// -------- Local storage for pendings --------
function loadPending() {
  try {
    const raw = localStorage.getItem(LS_KEY) || '[]';
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function savePending(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

// =====================================================
// =============== PUBLIC API FUNCTIONS ================
// =====================================================

/**
 * Persist a pending pick so we can settle with the correct predicted later.
 * @param {{id:string, favName:string, label:'SAFE'|'RISKY'}} p
 */
export function addPending(p) {
  if (!p || !p.id) return;
  const favName = (p.favName && String(p.favName).trim()) || null;
  const label   = p.label || null;
  const list = loadPending().filter(x => x.id !== p.id);
  list.push({ id: p.id, favName, label, ts: Date.now() });
  savePending(list);
}

/**
 * Send a prediction to the unified endpoint.
 * payload shape:
 * {
 *   matchId, label, conf, tip, features:{ favName, favProb, favOdds, setNum, live, ... }
 * }
 */
export async function logPrediction(payload = {}) {
  if (!ENABLED) return { ok: true, skipped: 'logging disabled' };

  const matchId = payload.matchId || payload.id;
  const label   = payload.label;
  if (!matchId || !label) return { ok: false, error: 'missing matchId/label' };

  // Enforce real favName in features & human tip
  const favName = (payload.features?.favName && String(payload.features.favName).trim())
    ? payload.features.favName
    : null;
  const aiTip = (payload.tip && String(payload.tip).trim()) || '';
  const needsTip = !aiTip || /player\s*[ab]/i.test(aiTip);
  const tip = needsTip && favName ? `${favName} to win` : aiTip;

  const body = {
    ts: new Date().toISOString(),
    sid: getSid(),
    app: 'livebetiq3',
    model: MODEL,
    event: 'prediction',
    data: {
      matchId,
      label,
      conf: Number(payload.conf) || 0,
      tip,
      features: {
        ...(payload.features || {}),
        favName, // may be null; frontend already tries to force real name
      },
    },
  };

  // Small dedupe guard
  const key = [matchId, label, Math.round((body.data.conf || 0) * 100)].join('|');
  if (dedupe(key)) return { ok: true, deduped: true };

  try {
    const resp = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
    const json = await resp.json().catch(() => ({}));
    return json?.ok ? json : { ok: false, error: 'bad response', response: json };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Auto-settle finished matches from the RAW feed (must include finished).
 * @param {Array<any>} feed raw array from fetchTennisLive()
 */
export async function trySettleFinished(feed) {
  const pending = loadPending();
  if (!pending.length) return;

  const arr = Array.isArray(feed) ? feed : [];
  if (!arr.length) return;

  const byIdPending = new Map(pending.map(x => [x.id, x]));

  // Helper: normalize names for comparison
  const norm = (s) => String(s || '').trim().toLowerCase();

  // Extract winner from a match object
  const winnerFromMatch = (m) => {
    const direct = m?.winner || m?.['@winner'];
    if (direct) return String(direct);

    const players = Array.isArray(m.players) ? m.players
                 : Array.isArray(m.player)  ? m.player : [];
    const p1 = players[0] || {}, p2 = players[1] || {};
    const name1 = p1.name || p1['@name'] || '';
    const name2 = p2.name || p2['@name'] || '';

    const toInt = (v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (!s) return null;
      const x = parseInt(s.split(/[.:]/)[0], 10);
      return Number.isFinite(x) ? x : null;
    };
    const sA = [toInt(p1.s1), toInt(p1.s2), toInt(p1.s3), toInt(p1.s4), toInt(p1.s5)];
    const sB = [toInt(p2.s1), toInt(p2.s2), toInt(p2.s3), toInt(p2.s4), toInt(p2.s5)];
    let a = 0, b = 0;
    for (let i = 0; i < 5; i++) {
      const A = sA[i], B = sB[i];
      if (A === null || B === null) continue;
      if (A > B) a++; else if (B > A) b++;
    }
    if (a > b) return name1 || null;
    if (b > a) return name2 || null;
    return null;
  };

  const finished = arr.filter((m) => {
    const s = String(m?.status || m?.['@status'] || '').toLowerCase();
    return s === 'finished' || s === 'retired' || s === 'walk over' || s === 'walkover';
  });

  if (!finished.length) return;

  const stillPending = [];

  for (const m of finished) {
    const id = m?.id || m?.['@id'];
    if (!id) continue;

    const pend = byIdPending.get(id);
    if (!pend) continue; // we didn't predict this one (or already settled)

    const predicted = pend.favName || null;
    const winner    = winnerFromMatch(m);

    if (!predicted || !winner) {
      // not enough info; keep it for next cycle
      stillPending.push(pend);
      continue;
    }

    const result = norm(predicted) === norm(winner) ? 'win' : 'loss';

    // Send result to unified endpoint
    await reportResult({ matchId: id, result, winner, predicted });
    // Do not re-add to stillPending (settled)
  }

  savePending(stillPending);
}

// -----------------------------------------------------
// Backwards compatibility default export
// Some old code might call: log('prediction', payload)
export default function log(event, data = {}) {
  if (event === 'prediction') return logPrediction(data);
  // No other events supported in new contract
  return { ok: true, ignored: true };
}