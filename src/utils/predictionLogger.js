// src/utils/predictionLogger.js
// Unified logger for LiveBet IQ v3.10
// - logPrediction(payload) -> POST /api/log-prediction (event:'prediction')
// - addPending({id, favName, label})
// - trySettleFinished(rawFeed) -> auto result reporting via reportResult()

import reportResult from './reportResult';
import { recordPrediction } from './telemetry';

const ENABLED = String(process.env.REACT_APP_LOG_PREDICTIONS || '0') === '1';
const MODEL = process.env.REACT_APP_AI_ENGINE || 'v3.10';
const LS_KEY = 'lbq_pending_v1';

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
  for (const [k, t] of recent) {
    if (now - t > ttlMs) recent.delete(k);
  }
  return false;
}

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
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Persist a pending pick so we can settle it later with the correct predicted.
 * @param {{id:string, favName:string, label:'SAFE'|'RISKY'|'AVOID'}} p
 */
export function addPending(p) {
  if (!p || !p.id) return;
  const favName = (p.favName && String(p.favName).trim()) || null;
  const label = p.label || null;
  const list = loadPending().filter((x) => x.id !== p.id);
  list.push({ id: p.id, favName, label, ts: Date.now() });
  savePending(list);
}

/**
 * Derive favourite probability and odds from payload/features.
 */
function deriveFavProbAndOdds(payload, favName, p1, p2) {
  const f = payload.features || {};

  let favProb = Number(
    f.favProb ??
      f.favProbability ??
      payload.prob ??
      payload.probability ??
      0,
  );
  let favOdds = Number(
    f.favOdds ??
      f.favPrice ??
      f.fairOddsFav ??
      payload.odds ??
      payload.price ??
      0,
  );

  const prob1 = Number(
    f.prob1 ??
      f.probHome ??
      f.fairProb1 ??
      f.impliedProb1 ??
      f.probA ??
      0,
  );
  const prob2 = Number(
    f.prob2 ??
      f.probAway ??
      f.fairProb2 ??
      f.impliedProb2 ??
      f.probB ??
      0,
  );
  const odds1 = Number(
    f.fairOdds1 ??
      f.odds1 ??
      f.price1 ??
      f.homeOdds ??
      f.oddsA ??
      0,
  );
  const odds2 = Number(
    f.fairOdds2 ??
      f.odds2 ??
      f.price2 ??
      f.awayOdds ??
      f.oddsB ??
      0,
  );

  const favNameNorm = String(favName || '').trim().toLowerCase();
  const p1Norm = String(p1 || '').trim().toLowerCase();
  const p2Norm = String(p2 || '').trim().toLowerCase();

  const isValidProb = (x) => Number.isFinite(x) && x > 0 && x < 1;
  const isValidOdds = (x) => Number.isFinite(x) && x > 1;

  if (!isValidProb(favProb) && favNameNorm) {
    if (p1Norm && favNameNorm === p1Norm && isValidProb(prob1)) {
      favProb = prob1;
    } else if (p2Norm && favNameNorm === p2Norm && isValidProb(prob2)) {
      favProb = prob2;
    }
  }

  if (!isValidOdds(favOdds) && favNameNorm) {
    if (p1Norm && favNameNorm === p1Norm && isValidOdds(odds1)) {
      favOdds = odds1;
    } else if (p2Norm && favNameNorm === p2Norm && isValidOdds(odds2)) {
      favOdds = odds2;
    }
  }

  const probClean = isValidProb(favProb) ? favProb : 0;
  const oddsClean = isValidOdds(favOdds) ? favOdds : 0;

  return { favProb: probClean, favOdds: oddsClean };
}

/**
 * Send a prediction to the unified endpoint.
 * payload shape:
 * {
 *   matchId, label, conf, tip,
 *   features:{ favName, favProb, favOdds, setNum, live, player1, player2, ... }
 * }
 */
export async function logPrediction(payload = {}) {
  const matchId = payload.matchId || payload.id;
  const label = payload.label;
  if (!matchId || !label) return { ok: false, error: 'missing matchId/label' };

  const rawFavName =
    payload.features?.favName !== undefined &&
    payload.features?.favName !== null
      ? payload.features.favName
      : null;

  const favName =
    (rawFavName && String(rawFavName).trim()) || null;

  const aiTip = (payload.tip && String(payload.tip).trim()) || '';
  const needsTip = !aiTip || /player\s*[ab]/i.test(aiTip);
  const tip = needsTip && favName ? `${favName} to win` : aiTip;

  const confVal = Number(payload.conf) || 0;

  const kellyVal =
    Number(payload.kelly ?? payload.features?.kelly ?? 0) || 0;

  const p1 =
    payload.features?.player1 ??
    payload.features?.p1 ??
    payload.p1 ??
    '';
  const p2 =
    payload.features?.player2 ??
    payload.features?.p2 ??
    payload.p2 ??
    '';

  const setNum =
    payload.features?.setNum ??
    payload.setNum ??
    null;

  const status =
    payload.features?.status ??
    payload.status ??
    (payload.features?.live ? 'live' : 'upcoming');

  const { favProb, favOdds } = deriveFavProbAndOdds(
    payload,
    favName,
    p1,
    p2,
  );

  const ts = new Date().toISOString();

  try {
    recordPrediction({
      ts,
      matchId,
      p1,
      p2,
      label,
      prob: favProb,
      kelly: kellyVal,
      status,
      setNum,
      tip,
    });
  } catch {}

  if (!ENABLED) {
    return { ok: true, skipped: 'logging disabled' };
  }

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
      features: {
        ...(payload.features || {}),
        favName,
        favProb,
        favOdds,
        p1,
        p2,
        status,
        setNum,
        kelly: kellyVal,
      },
    },
  };

  const key = [matchId, label, Math.round((body.data.conf || 0) * 100)].join(
    '|',
  );
  if (dedupe(key)) return { ok: true, deduped: true };

  try {
    const resp = await fetch('/api/log-prediction', {
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

  const byIdPending = new Map(pending.map((x) => [x.id, x]));
  const norm = (s) => String(s || '').trim().toLowerCase();

  const winnerFromMatch = (m) => {
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

    const toInt = (v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (!s) return null;
      const x = parseInt(s.split(/[.:]/)[0], 10);
      return Number.isFinite(x) ? x : null;
    };

    const sA = [
      toInt(p1.s1),
      toInt(p1.s2),
      toInt(p1.s3),
      toInt(p1.s4),
      toInt(p1.s5),
    ];
    const sB = [
      toInt(p2.s1),
      toInt(p2.s2),
      toInt(p2.s3),
      toInt(p2.s4),
      toInt(p2.s5),
    ];

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

  const finished = arr.filter((m) => {
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

    await reportResult({ matchId: id, result, winner, predicted });
  }

  savePending(stillPending);
}

export default function log(event, data = {}) {
  if (event === 'prediction') return logPrediction(data);
  return { ok: true, ignored: true };
}