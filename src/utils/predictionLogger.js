// src/utils/predictionLogger.js
// Unified logger for LiveBet IQ v3.x
// v3.4 – robust favProb/favOdds derivation + pending + settlement

import reportResult from './reportResult';
import { recordPrediction } from './telemetry';

const ENABLED =
  String(process.env.REACT_APP_LOG_PREDICTIONS || '0') === '1';
const MODEL = process.env.REACT_APP_AI_ENGINE || 'aiV3.10';
const LS_KEY = 'lbq_pending_v1';

const DEDUPE_TTL = 15000; // 15s

// ---------------------------------------------------------------------------
// SID handling
// ---------------------------------------------------------------------------
function getSid() {
  try {
    if (typeof window === 'undefined') return 'srv';
    const key = 'lbq.sid';
    let v = window.localStorage.getItem(key);
    if (!v) {
      v = `web-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(
        36
      )}`;
      window.localStorage.setItem(key, v);
    }
    return v;
  } catch {
    return 'nosid';
  }
}

// ---------------------------------------------------------------------------
// Dedupe
// ---------------------------------------------------------------------------
const recent = new Map();

function dedupe(key, ttlMs = DEDUPE_TTL) {
  const now = Date.now();
  const hit = recent.get(key);
  if (hit && now - hit < ttlMs) return true;
  recent.set(key, now);

  // clean old
  for (const [k, t] of recent) {
    if (now - t > ttlMs) recent.delete(k);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Pending storage
// ---------------------------------------------------------------------------
function loadPending() {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(LS_KEY) || '[]';
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function savePending(list) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LS_KEY, JSON.stringify(list || []));
  } catch {
    // ignore
  }
}

/**
 * @param {{id:string, favName:string, label:'SAFE'|'RISKY'|'AVOID'}} p
 */
export function addPending(p) {
  if (!p || !p.id) return;
  const favName = (p.favName && String(p.favName).trim()) || null;
  const label = p.label || null;
  const list = loadPending().filter(x => x.id !== p.id);
  list.push({ id: p.id, favName, label, ts: Date.now() });
  savePending(list);
}

// ---------------------------------------------------------------------------
// Helpers για odds/prob
// ---------------------------------------------------------------------------
function normalizeNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function isProb(x) {
  return Number.isFinite(x) && x > 0 && x < 1;
}

function isOdds(x) {
  return Number.isFinite(x) && x > 1;
}

// ---------------------------------------------------------------------------
// Main prediction logger
// ---------------------------------------------------------------------------
export async function logPrediction(payload = {}) {
  try {
    const matchId = payload.matchId || payload.id;
    const label = payload.label;
    if (!matchId || !label) {
      return { ok: false, error: 'missing matchId/label' };
    }

    const features = payload.features || {};

    // favName
    const favNameRaw =
      (features.favName && String(features.favName).trim()) ||
      payload.favName ||
      '';
    const favName = favNameRaw || null;

    // TIP
    const aiTip = (payload.tip && String(payload.tip).trim()) || '';
    const genericTip =
      /player\s*[ab]/i.test(aiTip) ||
      aiTip === 'Player A to win' ||
      aiTip === 'Player B to win';
    const tip =
      (!aiTip || genericTip) && favName ? `${favName} to win` : aiTip;

    // conf
    const confNum = normalizeNumber(payload.conf);
    const confVal = Number.isFinite(confNum) && confNum > 0 ? confNum : 0;

    // players
    const p1 =
      features.player1 ??
      features.p1 ??
      payload.p1 ??
      '';
    const p2 =
      features.player2 ??
      features.p2 ??
      payload.p2 ??
      '';

    // set / status / live
    const setNum =
      features.setNum != null ? features.setNum : payload.setNum ?? null;

    let status =
      features.status ??
      payload.status ??
      (features.live ? 'live' : 'upcoming');
    status = String(status || '').toLowerCase();

    const live =
      features.live != null
        ? Number(features.live ? 1 : 0)
        : payload.live != null
        ? Number(payload.live ? 1 : 0)
        : status === 'live'
        ? 1
        : 0;

    const statusForTelemetry = status || (live ? 'live' : 'upcoming');

    // Kelly
    const kellyFromPayload = normalizeNumber(
      payload.kelly ?? features.kelly ?? payload.kellyFraction
    );
    const kellyVal = Number.isFinite(kellyFromPayload)
      ? Math.max(0, kellyFromPayload)
      : 0;

    // ---- FAV ODDS: πάρε από ό,τι μπορείς ----------------------------------
    const rawOddsCandidates = [
      payload.favOdds,
      features.favOdds,
      features.pOdds,
      payload.pOdds,
    ];

    let favOdds = 0;
    for (const cand of rawOddsCandidates) {
      const n = normalizeNumber(cand);
      if (isOdds(n)) {
        favOdds = n;
        break;
      }
    }

    // ---- FAV PROB: από features, μετά conf, μετά 1/odds -------------------
    const rawProbCandidates = [
      payload.favProb,
      features.favProb,
      features.prob,
      features.prob1,
    ];

    let favProb = NaN;
    for (const cand of rawProbCandidates) {
      const n = normalizeNumber(cand);
      if (isProb(n)) {
        favProb = n;
        break;
      }
    }

    if (!isProb(favProb) && isProb(confVal)) {
      favProb = confVal;
    }

    if (!isProb(favProb) && isOdds(favOdds)) {
      favProb = 1 / favOdds;
    }

    if (!isProb(favProb)) favProb = 0;

    const ts = new Date().toISOString();

    // --- Local telemetry ---------------------------------------------------
    try {
      recordPrediction({
        ts,
        matchId,
        p1,
        p2,
        label,
        prob: favProb,
        odds: favOdds,
        kelly: kellyVal,
        status: statusForTelemetry,
        setNum,
        tip,
      });
    } catch {
      // ignore
    }

    if (!ENABLED) {
      return { ok: true, skipped: 'logging disabled' };
    }

    // --- HTTP body προς /api/log-prediction -------------------------------
    const body = {
      ts,
      sid: getSid(),
      app: 'livebetiq3',
      model: MODEL,
      event: 'prediction',
      data: {
        matchId,
        label,
        conf: confVal,
        tip,
        favProb,
        favOdds,
        features: {
          ...(payload.features || {}),
          favName,
          favProb,
          favOdds,
          p1,
          p2,
          setNum,
          live,
          status: statusForTelemetry,
        },
      },
    };

    const key = [
      matchId,
      label,
      Math.round((body.data.conf || 0) * 100),
    ].join('|');
    if (dedupe(key)) return { ok: true, deduped: true };

    const resp = await fetch('/api/log-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });

    const json = await resp.json().catch(() => ({}));
    return json?.ok ? json : { ok: false, error: 'bad response', response: json };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[LBQ] logPrediction error', e);
    return { ok: false, error: String(e) };
  }
}

// ---------------------------------------------------------------------------
// Settlement από GoalServe feed
// ---------------------------------------------------------------------------
/**
 * @param {Array<any>} feed raw array from fetchTennisLive()
 */
export async function trySettleFinished(feed) {
  const pending = loadPending();
  if (!pending.length) return;

  const arr = Array.isArray(feed) ? feed : [];
  if (!arr.length) return;

  const byIdPending = new Map(pending.map(x => [x.id, x]));
  const norm = s => String(s || '').trim().toLowerCase();

  const winnerFromMatch = m => {
    const direct = m?.winner || m?.['@winner'];
    if (direct) return String(direct);

    const players = Array.isArray(m.players)
      ? m.players
      : Array.isArray(m.player)
      ? m.player
      : [];
    const p1 = players[0] || {};
    const p2 = players[1] || {};
    const name1 = p1.name || p1['@name'] || '';
    const name2 = p2.name || p2['@name'] || '';

    const toInt = v => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (!s) return null;
      const x = parseInt(s.split(/[.:]/)[0], 10);
      return Number.isFinite(x) ? x : null;
    };

    const sA = [toInt(p1.s1), toInt(p1.s2), toInt(p1.s3), toInt(p1.s4), toInt(p1.s5)];
    const sB = [toInt(p2.s1), toInt(p2.s2), toInt(p2.s3), toInt(p2.s4), toInt(p2.s5)];

    let a = 0;
    let b = 0;
    for (let i = 0; i < 5; i++) {
      const A = sA[i];
      const B = sB[i];
      if (A === null || B === null) continue;
      if (A > B) a++;
      else if (B > A) b++;
    }
    if (a > b) return name1 || null;
    if (b > a) return name2 || null;
    return null;
  };

  const finished = arr.filter(m => {
    const s = String(m?.status || m?.['@status'] || '').toLowerCase();
    return (
      s === 'finished' ||
      s === 'retired' ||
      s === 'walk over' ||
      s === 'walkover'
    );
  });

  if (!finished.length) return;

  const stillPending = [];

  for (const m of finished) {
    const id = m?.id || m?.['@id'];
    if (!id) continue;

    const pend = byIdPending.get(id);
    if (!pend) continue;

    const predicted = pend.favName || null;
    const winner = winnerFromMatch(m);

    if (!predicted || !winner) {
      stillPending.push(pend);
      continue;
    }

    const result = norm(predicted) === norm(winner) ? 'win' : 'loss';

    try {
      await reportResult({ matchId: id, result, winner, predicted });
    } catch {
      stillPending.push(pend);
    }
  }

  savePending(stillPending);
}

// ---------------------------------------------------------------------------
// Default export (event router, backwards compatible)
// ---------------------------------------------------------------------------
export default function log(event, data = {}) {
  if (event === 'prediction') return logPrediction(data);
  if (event === 'settle') return trySettleFinished(data);
  return { ok: true, ignored: true };
}